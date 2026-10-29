import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defaultObjectives } from "../src/games/deadlock/objectives.js";
import { BundledSounds } from "../src/games/deadlock/sounds.js";
import type { AudioClip } from "../src/games/deadlock/types.js";
import { createSoundResource } from "../src/games/deadlock/voice.js";

try {
  const sounds = new BundledSounds();
  const voiced = (await readdir(fileURLToPath(new URL("../assets/deadlock/voice/", import.meta.url)))).filter((file) => file.endsWith(".ogg")).map((file) => file.slice(0, -4));
  const missing = defaultObjectives().filter(({ id }) => !voiced.includes(id));
  if (missing.length) throw new Error(`Missing spoken warnings: ${missing.map(({ id }) => id).join(", ")}`);
  const clips = [["beep", await sounds.prepare("beep")], ["ding", await sounds.prepare("ding")]] as [string, AudioClip][];
  for (const id of voiced) clips.push([`${id} voice`, await sounds.prepare("voice", id)]);
  for (const [label, clip] of clips) {
    const resource = createSoundResource(clip);
    let packets = 0;
    for await (const _packet of resource.playStream) packets++;
    if (!packets) throw new Error(`${label} contained no Opus packets`);
    console.log(`${label}: ${packets} Opus packets.`);
  }
  console.log("Bundled sounds ready. No Discord connection or external audio tools used.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Deadlock sound check failed");
  process.exitCode = 1;
}
