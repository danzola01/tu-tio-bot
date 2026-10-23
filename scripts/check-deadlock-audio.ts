import "dotenv/config";
import { fileURLToPath } from "node:url";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { createAudioResource, StreamType } from "@discordjs/voice";
import { CachedSpeech } from "../src/games/deadlock/speech.js";

let probeDirectory: string | undefined;
try {
  const directory = process.env.DEADLOCK_AUDIO_DIR ?? fileURLToPath(new URL("../data/deadlock-audio/", import.meta.url));
  await mkdir(directory, { recursive: true, mode: 0o700 });
  probeDirectory = await mkdtemp(join(directory, ".probe-"));
  const clip = await new CachedSpeech(probeDirectory).prepare("Deadlock voice reminders are ready.");
  const resource = createAudioResource(clip.path, { inputType: StreamType.OggOpus });
  let packets = 0;
  for await (const _packet of resource.playStream) packets++;
  if (!packets) throw new Error("The audio file contained no Opus packets");
  console.log(`Deadlock audio ready: ${packets} Opus packets. No Discord connection was opened.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Deadlock speech check failed");
  process.exitCode = 1;
} finally {
  if (probeDirectory) await rm(probeDirectory, { recursive: true, force: true });
}
