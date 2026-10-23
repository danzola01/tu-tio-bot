import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAudioResource, StreamType } from "@discordjs/voice";
import { CachedSpeech } from "../../../../src/games/deadlock/speech.js";

const directories: string[] = [];
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }); });

describe("local Deadlock speech", () => {
  it("prepares playable Ogg Opus and reuses it without requiring synthesis again", async () => {
    const directory = await mkdtemp(join(tmpdir(), "tu-tio-speech-"));
    directories.push(directory);
    const speech = new CachedSpeech(directory);
    const clip = await speech.prepare("Small camps in thirty seconds.");
    const resource = createAudioResource(clip.path, { inputType: StreamType.OggOpus });
    let packets = 0;
    for await (const _packet of resource.playStream) packets++;
    expect(packets).toBeGreaterThan(0);
    const restarted = new CachedSpeech(directory, { espeak: "/missing-espeak-ng" });
    expect(await restarted.prepare(clip.text)).toEqual(clip);
    await expect(restarted.prepare("A new objective.")).rejects.toThrow("speech");
  });
});
