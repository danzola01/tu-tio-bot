import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeadlockMatches } from "../../../../src/games/deadlock/matches.js";
import { ObjectiveSettings } from "../../../../src/games/deadlock/settings.js";
import { testDb } from "../../../setup.js";
import type { VoiceSession, VoiceTarget, VoiceTransport } from "../../../../src/games/deadlock/types.js";

const target: VoiceTarget = { guildId: "server", channelId: "voice", adapterCreator: () => ({ sendPayload: () => true, destroy() {} }) };
const settings = () => new ObjectiveSettings(testDb, { prepare: async (sound) => ({ sound, path: `/audio/${sound}.ogg` }) });

describe("Deadlock match controls", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] }));
  afterEach(() => vi.useRealTimers());

  it("runs a saved snapshot, shares clock controls, replays after rewind, and leaves on stop", async () => {
    const heard: string[][] = [];
    let closed = false;
    const voice: VoiceTransport = { connect: async () => ({ play: async (clips) => { heard.push(clips.map((clip) => clip.sound)); }, cancel() {}, close() { closed = true; } }) };
    const saved = settings();
    const matches = new DeadlockMatches(saved, voice);
    await matches.start(target);
    await expect(matches.start(target)).rejects.toThrow("already");
    await vi.advanceTimersByTimeAsync(90_000);
    expect(heard).toEqual([["beep"]]);
    const first = (await saved.list("server"))[0]!;
    await saved.save("server", { ...first, firstAt: 180 });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(heard.at(-1)).toEqual(["ding"]);
    matches.pause("server");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(matches.status("server")).toMatchObject({ elapsed: 120, paused: true });
    matches.sync("server", 90);
    matches.resume("server");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(heard.at(-1)).toEqual(["ding"]);
    expect(heard).toHaveLength(13);
    matches.stop("server");
    expect(matches.status("server")).toBeNull();
    expect(closed).toBe(true);
  });

  it("previews a selected callout and leaves voice afterward", async () => {
    const heard: string[][] = [];
    let closed = false;
    const matches = new DeadlockMatches(settings(), { connect: async () => ({
      play: async (clips) => { heard.push(clips.map((clip) => clip.sound)); }, cancel() {}, close() { closed = true; },
    }) });
    await matches.preview(target, "sinners", "repeat");
    expect(heard).toEqual([["ding"]]);
    expect(closed).toBe(true);
    expect(matches.status("server")).toBeNull();
  });

  it("closes a late voice connection when start was cancelled", async () => {
    let joined = () => {};
    const connecting = new Promise<void>((resolve) => { joined = resolve; });
    let finish = (_voice: VoiceSession) => {};
    const pending = new Promise<VoiceSession>((resolve) => { finish = resolve; });
    let closed = false;
    const matches = new DeadlockMatches(settings(), { connect: async () => { joined(); return pending; } });
    const starting = matches.start(target);
    await connecting;
    matches.stop("server");
    finish({ play: async () => {}, cancel() {}, close() { closed = true; } });
    await expect(starting).rejects.toThrow("cancelled");
    expect(closed).toBe(true);
    expect(matches.status("server")).toBeNull();
  });

  it("ends the timer on voice failure and ignores stale failure callbacks after restarting", async () => {
    const callbacks: ((reason: string) => void)[] = [];
    const notify = vi.fn(async (_reason: string) => {});
    const matches = new DeadlockMatches(settings(), { connect: async (_target, lost) => {
      callbacks.push(lost);
      return { play: async () => {}, cancel() {}, close() {} };
    } });
    await matches.start(target, 0, notify);
    callbacks[0]!("Connection lost.");
    expect(matches.status("server")).toBeNull();
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("/deadlock start"));
    await matches.start(target);
    callbacks[0]!("Old callback.");
    expect(matches.status("server")?.phase).toBe("running");
    matches.dispose();
  });
});
