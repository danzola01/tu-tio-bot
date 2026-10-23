import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { ChannelType, Events, type AutocompleteInteraction, type Client, type VoiceState, type ChatInputCommandInteraction } from "discord.js";
import { createDeadlockModule } from "../../../../src/games/deadlock/index.js";
import { testDb } from "../../../setup.js";

function commandCall(subcommand: string, values: Record<string, string | boolean> = {}, userId = "owner", group: string | null = null) {
  const editReply = vi.fn(async (_value: unknown) => {});
  const interaction = {
    guildId: "server", user: { id: userId },
    options: {
      getSubcommand: () => subcommand, getSubcommandGroup: () => group,
      getString: (key: string) => typeof values[key] === "string" ? values[key] : null,
      getBoolean: (key: string) => typeof values[key] === "boolean" ? values[key] : null,
    },
    deferReply: vi.fn(async () => {}), editReply,
  } as unknown as ChatInputCommandInteraction;
  return { interaction, editReply };
}

describe("Deadlock Discord commands", () => {
  it("restricts objective edits to the bot owner and exposes saved additions in the schedule", async () => {
    const game = createDeadlockModule(testDb, { ownerId: "owner", speech: { prepare: async (text) => ({ text, path: "/audio.ogg" }) } });
    const command = game.commands[0]!;
    expect(command.data.toJSON().name).toBe("deadlock");
    const denied = commandCall("add", { name: "Urn", first: "10:00" }, "friend", "objective");
    await command.execute(denied.interaction);
    expect(denied.editReply).toHaveBeenCalledWith(expect.stringContaining("Only the bot owner"));
    const add = commandCall("add", { name: "Urn", first: "10:00", repeat: "off" }, "owner", "objective");
    await command.execute(add.interaction);
    expect(add.editReply).toHaveBeenCalledWith(expect.stringContaining("next start"));
    const schedule = commandCall("schedule");
    await command.execute(schedule.interaction);
    const message = schedule.editReply.mock.calls[0]![0] as { embeds: { toJSON(): { fields: { name: string; value: string }[] } }[] };
    expect(message.embeds[0]!.toJSON().fields).toEqual(expect.arrayContaining([expect.objectContaining({ name: expect.stringContaining("Urn"), value: expect.stringContaining("10:00") })]));
  });

  it("edits speech and warning preferences, shows them to friends, and removes objectives", async () => {
    const game = createDeadlockModule(testDb, { ownerId: "owner", speech: { prepare: async (text) => ({ text, path: "/audio.ogg" }) } });
    const command = game.commands[0]!;
    const edit = commandCall("edit", { objective: "small-camps", repeat: "off", warning: "off", "first-text": "Farm only when safe." }, "owner", "objective");
    await command.execute(edit.interaction);
    expect(edit.editReply).toHaveBeenCalledWith(expect.stringContaining("next start"));
    const show = commandCall("show", { objective: "small-camps" }, "friend", "objective");
    await command.execute(show.interaction);
    const shown = show.editReply.mock.calls[0]![0] as { embeds: { toJSON(): { fields: { value: string }[] } }[] };
    expect(shown.embeds[0]!.toJSON().fields).toEqual(expect.arrayContaining([expect.objectContaining({ value: "Farm only when safe." })]));
    const remove = commandCall("remove", { objective: "small-camps" }, "owner", "objective");
    await command.execute(remove.interaction);
    expect(remove.editReply).toHaveBeenCalledWith(expect.stringContaining("next start"));
    const schedule = commandCall("schedule");
    await command.execute(schedule.interaction);
    const saved = schedule.editReply.mock.calls[0]![0] as { embeds: { toJSON(): { fields: { name: string }[] } }[] };
    expect(saved.embeds[0]!.toJSON().fields.some((field) => field.name.includes("small-camps"))).toBe(false);
  });

  it("lets friends join their voice channel, share clock controls, and stop playback", async () => {
    let joined = "";
    let closed = false;
    const game = createDeadlockModule(testDb, { ownerId: "owner", speech: { prepare: async (text) => ({ text, path: "/audio.ogg" }) }, voice: { connect: async (target) => {
      joined = target.channelId;
      return { play: async () => {}, cancel() {}, close() { closed = true; } };
    } } });
    const command = game.commands[0]!;
    const start = commandCall("start", { time: "01:15" }, "friend");
    const guild = {
      id: "server", voiceAdapterCreator: () => ({ sendPayload: () => true, destroy() {} }),
      members: { me: { id: "bot" } },
      voiceStates: { cache: new Map([["friend", { channel: { id: "voice", type: ChannelType.GuildVoice, permissionsFor: () => ({ has: () => true }) } }]]) },
    };
    Object.assign(start.interaction, { guild });
    await command.execute(start.interaction);
    expect(joined).toBe("voice");
    expect(start.editReply).toHaveBeenCalledWith(expect.stringContaining("1:15"));
    const pause = commandCall("pause", {}, "another-friend");
    await command.execute(pause.interaction);
    expect(pause.editReply).toHaveBeenCalledWith(expect.stringContaining("Paused"));
    const sync = commandCall("sync", { time: "02:30" }, "another-friend");
    await command.execute(sync.interaction);
    expect(sync.editReply).toHaveBeenCalledWith(expect.stringContaining("2:30"));
    const stop = commandCall("stop", {}, "friend");
    await command.execute(stop.interaction);
    expect(closed).toBe(true);
  });

  it("stops when the voice channel empties and detaches its listener on shutdown", async () => {
    let closed = false;
    const game = createDeadlockModule(testDb, { speech: { prepare: async (text) => ({ text, path: "/audio.ogg" }) }, voice: { connect: async () => ({ play: async () => {}, cancel() {}, close() { closed = true; } }) } });
    const client = Object.assign(new EventEmitter(), { user: { id: "bot" } }) as unknown as Client;
    game.attach!(client);
    const members = new Map([["friend", { user: { bot: false } }], ["bot", { user: { bot: true } }]]);
    const channel = { id: "voice", type: ChannelType.GuildVoice, members, isVoiceBased: () => true, permissionsFor: () => ({ has: () => true }) };
    const guild = { id: "server", members: { me: { id: "bot" } }, channels: { cache: new Map([["voice", channel]]) }, voiceStates: { cache: new Map([["friend", { channel }]]) }, voiceAdapterCreator: () => ({ sendPayload: () => true, destroy() {} }) };
    const start = commandCall("start", {}, "friend");
    Object.assign(start.interaction, { guild });
    await game.commands[0]!.execute(start.interaction);
    members.delete("friend");
    client.emit(Events.VoiceStateUpdate, { guild, id: "friend", channelId: "voice" } as unknown as VoiceState, { guild, id: "friend", channelId: null } as unknown as VoiceState);
    expect(closed).toBe(true);
    await game.dispose!();
    expect(client.listenerCount(Events.VoiceStateUpdate)).toBe(0);
  });

  it("refuses to connect without voice permissions and offers objective autocomplete", async () => {
    let joined = false;
    const game = createDeadlockModule(testDb, { voice: { connect: async () => { joined = true; throw new Error("Should not connect"); } } });
    const command = game.commands[0]!;
    const start = commandCall("start", {}, "friend");
    Object.assign(start.interaction, { guild: {
      id: "server", members: { me: { id: "bot" } },
      voiceStates: { cache: new Map([["friend", { channel: { id: "voice", type: ChannelType.GuildVoice, permissionsFor: () => ({ has: () => false }) } }]]) },
    } });
    await command.execute(start.interaction);
    expect(start.editReply).toHaveBeenCalledWith(expect.stringContaining("Connect"));
    expect(joined).toBe(false);
    const respond = vi.fn(async (_choices: unknown) => {});
    await command.autocomplete!({ guildId: "server", options: { getFocused: () => "sin" }, respond } as unknown as AutocompleteInteraction);
    expect(respond).toHaveBeenCalledWith([{ name: "Sinners", value: "sinners" }]);
    await game.dispose!();
  });
});
