import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { AudioPlayerStatus, VoiceConnectionStatus } from "@discordjs/voice";
import { DiscordVoiceTransport } from "../../../../src/games/deadlock/voice.js";
import type { VoiceTarget } from "../../../../src/games/deadlock/types.js";

const sdk = vi.hoisted(() => ({ join: vi.fn(), player: vi.fn(), resource: vi.fn(), ready: vi.fn(), stream: vi.fn() }));
vi.mock("node:fs", async (original) => ({
  ...await original<typeof import("node:fs")>(), createReadStream: sdk.stream,
}));
vi.mock("@discordjs/voice", async (original) => ({
  ...await original<typeof import("@discordjs/voice")>(),
  joinVoiceChannel: sdk.join, createAudioPlayer: sdk.player, createAudioResource: sdk.resource, entersState: sdk.ready,
}));

const target: VoiceTarget = { guildId: "guild", channelId: "voice", adapterCreator: () => ({ sendPayload: () => true, destroy() {} }) };

function discord() {
  const played: string[] = [];
  const player = Object.assign(new EventEmitter(), {
    play: (resource: { path: string }) => { played.push(resource.path); },
    stop: () => { player.emit(AudioPlayerStatus.Idle); },
  });
  const connection = Object.assign(new EventEmitter(), {
    state: { status: VoiceConnectionStatus.Ready }, subscribe: () => ({ unsubscribe() {} }),
    destroy: vi.fn(),
  });
  sdk.join.mockReturnValue(connection); sdk.player.mockReturnValue(player);
  sdk.stream.mockImplementation((path: string) => ({ path }));
  sdk.resource.mockImplementation((input: { path: string }) => ({ path: input.path })); sdk.ready.mockResolvedValue(connection);
  return { player, connection, played };
}

describe("Discord voice playback adapter", () => {
  it("plays combined announcements in sequence and leaves when closed", async () => {
    const { player, connection, played } = discord();
    const voice = await new DiscordVoiceTransport().connect(target, vi.fn(), new AbortController().signal);
    const batch = voice.play([{ sound: "beep", path: "large.ogg" }, { sound: "beep", path: "sinners.ogg" }]);
    expect(played).toEqual(["large.ogg"]);
    player.emit(AudioPlayerStatus.Idle);
    expect(played).toEqual(["large.ogg", "sinners.ogg"]);
    player.emit(AudioPlayerStatus.Idle);
    await batch;
    voice.close();
    expect(connection.destroy).toHaveBeenCalledOnce();
  });

  it("cancels the recovery deadline when the connection becomes ready again", async () => {
    vi.useFakeTimers();
    try {
      const { connection } = discord();
      const lost = vi.fn();
      const voice = await new DiscordVoiceTransport().connect(target, lost, new AbortController().signal);
      connection.emit("stateChange", { status: VoiceConnectionStatus.Ready }, { status: VoiceConnectionStatus.Connecting });
      await vi.advanceTimersByTimeAsync(10_000);
      connection.emit("stateChange", { status: VoiceConnectionStatus.Connecting }, { status: VoiceConnectionStatus.Ready });
      await vi.advanceTimersByTimeAsync(20_000);
      expect(lost).not.toHaveBeenCalled();
      voice.close();
    } finally { vi.useRealTimers(); }
  });

  it.each([VoiceConnectionStatus.Signalling, VoiceConnectionStatus.Connecting, VoiceConnectionStatus.Disconnected])("bounds recovery after Ready transitions directly to %s", async (status) => {
    vi.useFakeTimers();
    try {
      const { connection } = discord();
      const lost = vi.fn();
      const voice = await new DiscordVoiceTransport().connect(target, lost, new AbortController().signal);
      const previous = connection.state;
      connection.state = { status };
      connection.emit("stateChange", previous, connection.state);
      await vi.advanceTimersByTimeAsync(19_999);
      expect(lost).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(lost).toHaveBeenCalledWith("Voice connection could not reconnect.");
      expect(connection.destroy).toHaveBeenCalledOnce();
      voice.close();
    } finally { vi.useRealTimers(); }
  });

  it("cancels both current and queued callouts without playing them after a clock correction", async () => {
    const { player, played } = discord();
    const voice = await new DiscordVoiceTransport().connect(target, vi.fn(), new AbortController().signal);
    const current = voice.play([{ sound: "beep", path: "first.ogg" }]);
    const queued = voice.play([{ sound: "beep", path: "queued.ogg" }]);
    voice.cancel();
    await Promise.all([current, queued]);
    player.emit(AudioPlayerStatus.Idle);
    expect(played).toEqual(["first.ogg"]);
    const next = voice.play([{ sound: "beep", path: "new.ogg" }]);
    player.emit(AudioPlayerStatus.Idle);
    await next;
    expect(played).toEqual(["first.ogg", "new.ogg"]);
    voice.close();
  });

  it("drops a countdown that expires behind another sound before playing the due ding", async () => {
    vi.useFakeTimers();
    try {
      const { player, played } = discord();
      const voice = await new DiscordVoiceTransport().connect(target, vi.fn(), new AbortController().signal);
      await vi.advanceTimersByTimeAsync(119_800);
      const earlier = voice.play([{ sound: "ding", path: "earlier-ding.ogg" }], 120_000);
      const countdown = voice.play([{ sound: "beep", path: "countdown.ogg" }], 120_000);
      await vi.advanceTimersByTimeAsync(700);
      player.emit(AudioPlayerStatus.Idle);
      expect(played).toEqual(["earlier-ding.ogg"]);
      await Promise.all([earlier, countdown]);
      const due = voice.play([{ sound: "ding", path: "due.ogg" }], 122_000);
      player.emit(AudioPlayerStatus.Idle);
      await due;
      expect(played).toEqual(["earlier-ding.ogg", "due.ogg"]);
      voice.close();
    } finally { vi.useRealTimers(); }
  });
});
