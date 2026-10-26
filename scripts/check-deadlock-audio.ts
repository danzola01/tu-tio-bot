import { BundledSounds } from "../src/games/deadlock/sounds.js";
import { createSoundResource } from "../src/games/deadlock/voice.js";

try {
  const sounds = new BundledSounds();
  for (const sound of ["beep", "ding"] as const) {
    const clip = await sounds.prepare(sound);
    const resource = createSoundResource(clip);
    let packets = 0;
    for await (const _packet of resource.playStream) packets++;
    if (!packets) throw new Error(`${sound} contained no Opus packets`);
    console.log(`${sound}: ${packets} Opus packets.`);
  }
  console.log("Bundled sounds ready. No Discord connection or external audio tools used.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Deadlock sound check failed");
  process.exitCode = 1;
}
