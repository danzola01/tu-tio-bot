import { afterEach, describe, expect, it, vi } from "vitest";
import { ActivityType, ChannelType, MessageFlags, type ButtonInteraction, type GuildMember, type Presence } from "discord.js";
import { DeadlockError } from "../../../../src/games/deadlock/errors.js";
import type { DeadlockMatches } from "../../../../src/games/deadlock/matches.js";
import { playingDeadlock, START_BUTTON, StartPrompts } from "../../../../src/games/deadlock/prompt.js";

vi.mock("../../../../src/infra/logger.js", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

function server() {
  const message = { delete: vi.fn(async () => {}) };
  const channel = { id: "voice", type: ChannelType.GuildVoice, send: vi.fn(async (_options: unknown) => message), permissionsFor: () => ({ has: () => true }) };
  const guild = { id: "guild", voiceAdapterCreator: () => ({}), members: { me: {} }, voiceStates: { cache: new Map([["player", { channel }]]) } };
  const member = (id = "player", bot = false, voice: unknown = channel) => ({ id, guild, user: { bot }, voice: { channel: voice } }) as unknown as GuildMember;
  const matches = { status: vi.fn((_guildId: string): object | null => null), start: vi.fn(async (..._args: unknown[]) => ({})) };
  return { message, channel, guild, member, matches, prompts: new StartPrompts(matches as unknown as DeadlockMatches, 60_000) };
}

function press(guild: unknown, channel: unknown) {
  const interaction = {
    guild, channel, user: { id: "player" }, deferUpdate: vi.fn(async () => {}),
    editReply: vi.fn(async (_options: unknown) => {}), followUp: vi.fn(async (_options: unknown) => {}),
  };
  return interaction;
}

describe("Deadlock start prompt", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("recognizes Discord's detected Deadlock activity only", () => {
    const presence = (type: ActivityType, name: string) => ({ activities: [{ type, name }] }) as unknown as Presence;
    expect(playingDeadlock(presence(ActivityType.Playing, "Deadlock"))).toBe(true);
    expect(playingDeadlock(presence(ActivityType.Listening, "Deadlock"))).toBe(false);
    expect(playingDeadlock(presence(ActivityType.Playing, "Overwatch 2"))).toBe(false);
    expect(playingDeadlock(null)).toBe(false);
  });

  it("posts one Start clock button in the voice chat and skips bots, players outside voice, and running clocks", async () => {
    const { channel, member, matches, prompts } = server();
    await prompts.offer(member("bot", true));
    await prompts.offer(member("player", false, null));
    matches.status.mockReturnValueOnce({ phase: "running" });
    await prompts.offer(member());
    expect(channel.send).not.toHaveBeenCalled();
    await Promise.all([prompts.offer(member()), prompts.offer(member("friend"))]);
    expect(channel.send).toHaveBeenCalledTimes(1);
    const sent = channel.send.mock.calls[0]![0] as { content: string; allowedMentions: unknown; components: { toJSON(): { components: { custom_id: string }[] } }[] };
    expect(sent.content).toContain("<@player> launched Deadlock");
    expect(sent.allowedMentions).toEqual({ users: ["player"] });
    expect(sent.components[0]!.toJSON().components[0]!.custom_id).toBe(START_BUTTON);
    prompts.dispose();
  });

  it("removes an unanswered prompt after it expires and can offer again", async () => {
    vi.useFakeTimers();
    const { message, channel, member, prompts } = server();
    await prompts.offer(member());
    await vi.advanceTimersByTimeAsync(60_000);
    expect(message.delete).toHaveBeenCalledOnce();
    await prompts.offer(member());
    expect(channel.send).toHaveBeenCalledTimes(2);
    prompts.dispose();
  });

  it("starts the clock at 0:00 in the presser's voice channel and closes the prompt", async () => {
    vi.useFakeTimers();
    const { message, channel, guild, member, matches, prompts } = server();
    await prompts.offer(member());
    const interaction = press(guild, channel);
    await prompts.press(interaction as unknown as ButtonInteraction);
    expect(interaction.deferUpdate).toHaveBeenCalled();
    expect(matches.start).toHaveBeenCalledWith(expect.objectContaining({ guildId: "guild", channelId: "voice" }), 0, expect.any(Function));
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("started the clock at 0:00"), components: [] }));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(message.delete).not.toHaveBeenCalled();
  });

  it("explains privately why the clock could not start", async () => {
    const { channel, guild, matches, prompts } = server();
    matches.start.mockRejectedValueOnce(new DeadlockError("A Deadlock timer is already active. Stop it first."));
    const interaction = press(guild, channel);
    await prompts.press(interaction as unknown as ButtonInteraction);
    expect(interaction.followUp).toHaveBeenCalledWith({ content: "❌ A Deadlock timer is already active. Stop it first.", flags: MessageFlags.Ephemeral });
    const outside = press({ ...guild, voiceStates: { cache: new Map() } }, channel);
    await prompts.press(outside as unknown as ButtonInteraction);
    expect(outside.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("Join a regular voice channel") }));
    expect(interaction.editReply).not.toHaveBeenCalled();
  });
});
