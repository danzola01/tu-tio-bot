import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { ActivityType, ChannelType, Events, GatewayIntentBits, type AutocompleteInteraction, type Client, type Interaction, type Presence, type VoiceState, type ChatInputCommandInteraction } from "discord.js";
import { DeadlockError } from "../../../../src/games/deadlock/errors.js";
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
  it.each([{ id: "owner" }, { ownerId: "owner" }])("uses application or team ownership when no override is set: %j", async (owner) => {
    const game = createDeadlockModule(testDb, { sounds: { prepare: async (sound) => ({ sound, path: "/audio.ogg" }) } });
    const edit = commandCall("edit", { objective: "small-camps", enabled: false }, "owner", "objective");
    Object.assign(edit.interaction, { client: { application: { owner: null, fetch: async () => ({ owner }) } } });
    await game.commands[0]!.execute(edit.interaction);
    expect(edit.editReply).toHaveBeenCalledWith(expect.stringContaining("next start"));
    await game.dispose!();
  });

  it("restricts objective edits to the bot owner and exposes saved additions in the schedule", async () => {
    const game = createDeadlockModule(testDb, { ownerId: "owner", sounds: { prepare: async (sound) => ({ sound, path: "/audio.ogg" }) } });
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

  it("edits beep and countdown preferences, shows them to friends, and removes objectives", async () => {
    const game = createDeadlockModule(testDb, { ownerId: "owner", sounds: { prepare: async (sound) => ({ sound, path: "/audio.ogg" }) } });
    const command = game.commands[0]!;
    const edit = commandCall("edit", { objective: "small-camps", repeat: "2:00", warning: "off", countdown: "off", "repeat-countdown": "5", announce: false }, "owner", "objective");
    await command.execute(edit.interaction);
    expect(edit.editReply).toHaveBeenCalledWith(expect.stringContaining("next start"));
    const show = commandCall("show", { objective: "small-camps" }, "friend", "objective");
    await command.execute(show.interaction);
    const shown = show.editReply.mock.calls[0]![0] as { embeds: { toJSON(): { fields: { value: string }[] } }[] };
    expect(shown.embeds[0]!.toJSON().fields).toEqual(expect.arrayContaining([expect.objectContaining({ value: expect.stringContaining("Countdown: off") }), expect.objectContaining({ value: expect.stringContaining("Countdown: 5s") })]));
    const remove = commandCall("remove", { objective: "small-camps" }, "owner", "objective");
    await command.execute(remove.interaction);
    expect(remove.editReply).toHaveBeenCalledWith(expect.stringContaining("next start"));
    const schedule = commandCall("schedule");
    await command.execute(schedule.interaction);
    const saved = schedule.editReply.mock.calls[0]![0] as { embeds: { toJSON(): { fields: { name: string }[] } }[] };
    expect(saved.embeds[0]!.toJSON().fields.some((field) => field.name.includes("Small camps"))).toBe(false);
  });

  it("speaks built-in warnings by default and toggles every objective with one owner-only command", async () => {
    const game = createDeadlockModule(testDb, { ownerId: "owner", sounds: { prepare: async (sound, id) => {
      if (sound === "voice" && id === "urn") throw new DeadlockError("No spoken warning is recorded for urn.");
      return { sound, path: `/${id ?? sound}.ogg` };
    } } });
    const command = game.commands[0]!;
    const fields = async () => {
      const schedule = commandCall("schedule");
      await command.execute(schedule.interaction);
      const saved = schedule.editReply.mock.calls[0]![0] as { embeds: { toJSON(): { fields: { name: string; value: string }[] } }[] };
      return Object.fromEntries(saved.embeds[0]!.toJSON().fields.map((field) => [field.name.replace(/^On · /, ""), field.value]));
    };
    expect(await fields()).toMatchObject({ "Small camps": expect.stringContaining("Voice 30s"), Sinners: expect.stringContaining("Voice 30s") });
    await command.execute(commandCall("add", { name: "Urn", first: "10:00" }, "owner", "objective").interaction);
    const denied = commandCall("spoken", { enabled: false }, "friend");
    await command.execute(denied.interaction);
    expect(denied.editReply).toHaveBeenCalledWith(expect.stringContaining("Only the bot owner"));
    const off = commandCall("spoken", { enabled: false }, "owner");
    await command.execute(off.interaction);
    expect(off.editReply).toHaveBeenCalledWith("Spoken warnings off for every objective. Changes apply on the next start.");
    expect(Object.values(await fields()).every((value) => value.includes("Beep 30s"))).toBe(true);
    const on = commandCall("spoken", { enabled: true }, "owner");
    await command.execute(on.interaction);
    expect(on.editReply).toHaveBeenCalledWith(expect.stringContaining("except Urn, which have no recorded voice"));
    expect(await fields()).toMatchObject({ "Small camps": expect.stringContaining("Voice 30s"), Urn: expect.stringContaining("Beep 30s") });
  });

  it("turns spoken warnings on per objective and shows them in the schedule", async () => {
    const game = createDeadlockModule(testDb, { ownerId: "owner", sounds: { prepare: async (sound, id) => ({ sound, path: `/${id ?? sound}.ogg` }) } });
    const command = game.commands[0]!;
    await command.execute(commandCall("edit", { objective: "small-camps", spoken: false }, "owner", "objective").interaction);
    const edit = commandCall("edit", { objective: "sinners", spoken: true }, "owner", "objective");
    await command.execute(edit.interaction);
    expect(edit.editReply).toHaveBeenCalledWith(expect.stringContaining("next start"));
    const show = commandCall("show", { objective: "sinners" }, "friend", "objective");
    await command.execute(show.interaction);
    const shown = show.editReply.mock.calls[0]![0] as { embeds: { toJSON(): { fields: { value: string }[] } }[] };
    expect(shown.embeds[0]!.toJSON().fields[0]!.value).toContain("Advance voice: 30s");
    const schedule = commandCall("schedule");
    await command.execute(schedule.interaction);
    const saved = schedule.editReply.mock.calls[0]![0] as { embeds: { toJSON(): { fields: { name: string; value: string }[] } }[] };
    const fields = saved.embeds[0]!.toJSON().fields;
    expect(fields.find((field) => field.name.includes("Sinners"))!.value).toContain("Voice 30s");
    expect(fields.find((field) => field.name.includes("Small camps"))!.value).toContain("Beep 30s");
  });

  it("lets friends join their voice channel, share clock controls, and stop playback", async () => {
    let joined = "";
    let closed = false;
    const game = createDeadlockModule(testDb, { ownerId: "owner", sounds: { prepare: async (sound) => ({ sound, path: "/audio.ogg" }) }, voice: { connect: async (target) => {
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
    const game = createDeadlockModule(testDb, { sounds: { prepare: async (sound) => ({ sound, path: "/audio.ogg" }) }, voice: { connect: async () => ({ play: async () => {}, cancel() {}, close() { closed = true; } }) } });
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

  it("offers a Start clock button only when enabled, and starts the clock from it", async () => {
    expect(createDeadlockModule(testDb).intents).not.toContain(GatewayIntentBits.GuildPresences);
    const game = createDeadlockModule(testDb, { startPrompt: true, sounds: { prepare: async (sound) => ({ sound, path: "/audio.ogg" }) }, voice: { connect: async () => ({ play: async () => {}, cancel() {}, close() {} }) } });
    expect(game.intents).toContain(GatewayIntentBits.GuildPresences);
    const client = Object.assign(new EventEmitter(), { user: { id: "bot" } }) as unknown as Client;
    game.attach!(client);
    const message = { delete: vi.fn(async () => {}) };
    const channel = { id: "voice", type: ChannelType.GuildVoice, send: vi.fn(async (_options: unknown) => message), permissionsFor: () => ({ has: () => true }) };
    const guild = { id: "server", members: { me: { id: "bot" } }, voiceStates: { cache: new Map([["friend", { channel }]]) }, voiceAdapterCreator: () => ({ sendPayload: () => true, destroy() {} }) };
    const member = { id: "friend", guild, user: { bot: false }, voice: { channel } };
    const playing = { member, activities: [{ type: ActivityType.Playing, name: "Deadlock" }] } as unknown as Presence;
    client.emit(Events.PresenceUpdate, playing, playing);
    client.emit(Events.PresenceUpdate, null, playing);
    await vi.waitFor(() => expect(channel.send).toHaveBeenCalledOnce());
    const editReply = vi.fn(async (_options: unknown) => {});
    client.emit(Events.InteractionCreate, { isButton: () => true, customId: "deadlock:start", guild, channel, user: { id: "friend" }, deferUpdate: async () => {}, editReply } as unknown as Interaction);
    await vi.waitFor(() => expect(editReply).toHaveBeenCalledWith(expect.objectContaining({ components: [] })));
    const status = commandCall("status", {}, "friend");
    await game.commands[0]!.execute(status.interaction);
    expect(status.editReply).toHaveBeenCalledWith(expect.stringContaining("Running"));
    await game.dispose!();
    expect(client.listenerCount(Events.PresenceUpdate) + client.listenerCount(Events.InteractionCreate)).toBe(0);
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

  it.each([
    { action: "start", phase: "preparing" }, { action: "preview", phase: "preparing" },
    { action: "start", phase: "connecting" }, { action: "preview", phase: "connecting" },
  ])("handles bot departures during $action while $phase", async ({ action, phase }) => {
    let block = false;
    let closed = 0;
    let preparing = () => {};
    let release = () => {};
    const entered = new Promise<void>((resolve) => { preparing = resolve; });
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const game = createDeadlockModule(testDb, {
      sounds: { prepare: async (sound) => { if (block && phase === "preparing") { preparing(); await pending; } return { sound, path: "/audio.ogg" }; } },
      voice: { connect: async () => {
        if (block && phase === "connecting") { preparing(); await pending; }
        return { play: async () => {}, cancel() {}, close() { closed++; } };
      } },
    });
    const client = Object.assign(new EventEmitter(), { user: { id: "bot" } }) as unknown as Client;
    game.attach!(client);
    const channel = { id: "voice", type: ChannelType.GuildVoice, isVoiceBased: () => true, members: new Map([["friend", { user: { bot: false } }]]), permissionsFor: () => ({ has: () => true }) };
    const guild = { id: "server", members: { me: { id: "bot" } }, channels: { cache: new Map([["voice", channel]]) }, voiceStates: { cache: new Map([["friend", { channel }]]) }, voiceAdapterCreator: () => ({ sendPayload: () => true, destroy() {} }) };
    const call = (name: string, values: Record<string, string> = {}) => {
      const result = commandCall(name, values, "friend");
      Object.assign(result.interaction, { guild });
      return result;
    };
    await game.commands[0]!.execute(call("start").interaction);
    await game.commands[0]!.execute(call("stop").interaction);
    block = true;
    const next = call(action, { objective: "sinners" });
    const starting = game.commands[0]!.execute(next.interaction);
    await entered;
    const botState = (channelId: string | null) => ({ guild, id: "bot", channelId }) as unknown as VoiceState;
    if (phase === "connecting") client.emit(Events.VoiceStateUpdate, botState(null), botState("voice"));
    client.emit(Events.VoiceStateUpdate, botState("voice"), botState(phase === "connecting" ? "other-channel" : null));
    release();
    await starting;
    expect(next.editReply).toHaveBeenCalledWith(expect.stringContaining(phase === "connecting" ? "cancelled" : action === "preview" ? "Preview ended" : "Running"));
    if (phase === "connecting") expect(closed).toBe(2);
    await game.dispose!();
  });
});
