import { describe, expect, it } from "vitest";
import { createAudioResource, StreamType } from "@discordjs/voice";
import { BundledSounds } from "../../../../src/games/deadlock/sounds.js";

describe("bundled Deadlock sounds", () => {
  it("prepares distinct playable beeps and dings without speech or conversion tools", async () => {
    const sounds = new BundledSounds();
    const beep = await sounds.prepare("beep");
    const ding = await sounds.prepare("ding");
    expect(beep.path).not.toBe(ding.path);
    for (const clip of [beep, ding]) {
      const resource = createAudioResource(clip.path, { inputType: StreamType.OggOpus });
      let packets = 0;
      for await (const _packet of resource.playStream) packets++;
      expect(packets).toBeGreaterThan(0);
      expect(packets * 20).toBeLessThan(1000);
    }
    await expect(new BundledSounds("/missing-deadlock-assets").prepare("beep")).rejects.toThrow("sound");
  });
});
