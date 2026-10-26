import { afterEach, describe, expect, it, vi } from "vitest";
import { BundledSounds } from "../../../../src/games/deadlock/sounds.js";
import { createSoundResource } from "../../../../src/games/deadlock/voice.js";

afterEach(() => vi.unstubAllEnvs());

describe("bundled Deadlock sounds", () => {
  it("prepares distinct playable beeps and dings without speech or conversion tools", async () => {
    vi.stubEnv("PATH", "/no-external-audio-tools");
    const sounds = new BundledSounds();
    const beep = await sounds.prepare("beep");
    const ding = await sounds.prepare("ding");
    expect(beep.path).not.toBe(ding.path);
    for (const clip of [beep, ding]) {
      const resource = createSoundResource(clip);
      let packets = 0;
      for await (const _packet of resource.playStream) packets++;
      expect(packets).toBeGreaterThan(0);
      expect(packets * 20).toBeLessThan(1000);
    }
    await expect(new BundledSounds("/missing-deadlock-assets").prepare("beep")).rejects.toThrow("sound");
  });
});
