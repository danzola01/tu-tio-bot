import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { AudioPlayerStatus, VoiceConnectionStatus } from "@discordjs/voice";
import { DiscordVoiceTransport } from "../../../../src/games/deadlock/voice.js";
import type { VoiceTarget } from "../../../../src/games/deadlock/types.js";

const sdk = vi.hoisted(() => ({ join: vi.fn(), player: vi.fn(), resource: vi.fn(), ready: vi.fn() }));
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
  sdk.resource.mockImplementation((path: string) => ({ path })); sdk.ready.mockResolvedValue(connection);
  return { player, connection, played };
}

describe("Discord voice playback adapter", () => {
  it("plays combined announcements in sequence and leaves when closed", async () => {
    const { player, connection, played } = discord();
    const voice = await new DiscordVoiceTransport().connect(target, vi.fn(), new AbortController().signal);
    const batch = voice.play([{ text: "Large camps", path: "large.ogg" }, { text: "Sinners", path: "sinners.ogg" }]);
    expect(played).toEqual(["large.ogg"]);
    player.emit(AudioPlayerStatus.Idle);
    expect(played).toEqual(["large.ogg", "sinners.ogg"]);
    player.emit(AudioPlayerStatus.Idle);
    await batch;
    voice.close();
    expect(connection.destroy).toHaveBeenCalledOnce();
  });

  it("reports a permanent disconnection and closes the connection", async () => {
    const { connection } = discord();
    const lost = vi.fn();
    await new DiscordVoiceTransport().connect(target, lost, new AbortController().signal);
    sdk.ready.mockRejectedValue(new Error("No reconnect"));
    connection.emit(VoiceConnectionStatus.Disconnected);
    await vi.waitFor(() => expect(lost).toHaveBeenCalledWith("Voice connection could not reconnect."));
    expect(connection.destroy).toHaveBeenCalledOnce();
  });

  it("cancels both current and queued callouts without playing them after a clock correction", async () => {
    const { player, played } = discord();
    const voice = await new DiscordVoiceTransport().connect(target, vi.fn(), new AbortController().signal);
    const current = voice.play([{ text: "First", path: "first.ogg" }]);
    const queued = voice.play([{ text: "Queued", path: "queued.ogg" }]);
    voice.cancel();
    await Promise.all([current, queued]);
    player.emit(AudioPlayerStatus.Idle);
    expect(played).toEqual(["first.ogg"]);
    const next = voice.play([{ text: "New", path: "new.ogg" }]);
    player.emit(AudioPlayerStatus.Idle);
    await next;
    expect(played).toEqual(["first.ogg", "new.ogg"]);
    voice.close();
  });
});
