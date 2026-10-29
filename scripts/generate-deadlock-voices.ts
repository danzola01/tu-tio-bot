// Development-only generator. Runtime plays the checked-in Ogg Opus files.
// Usage: npm run generate:voices [-- "Objective name" ...]; defaults to the built-in objectives.
import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultObjectives, objectiveId } from "../src/games/deadlock/objectives.js";

try { process.loadEnvFile(); } catch { /* The key may be exported instead of kept in .env. */ }

const key = process.env.OPENROUTER_API_KEY;
const model = process.env.DEADLOCK_TTS_MODEL ?? "elevenlabs/eleven-v3";
const voice = process.env.DEADLOCK_TTS_VOICE ?? "brian";
const directory = fileURLToPath(new URL("../assets/deadlock/voice/", import.meta.url));
const requested = process.argv.slice(2);
const objectives = requested.length ? requested.map((name) => ({ id: objectiveId(name), name: name.trim() })) : defaultObjectives();
// Trim leading/trailing silence so the line starts on the scheduled second, then match the beep's loudness.
const filters = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-2";

try {
  if (!key) throw new Error("Set OPENROUTER_API_KEY in .env or the environment.");
  await mkdir(directory, { recursive: true });
  for (const { id, name } of objectives) {
    if (!id) throw new Error(`Cannot derive an objective ID from "${name}".`);
    const response = await fetch("https://openrouter.ai/api/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model, voice, input: `${name} coming up.`, response_format: "mp3",
        instructions: "Brisk, clear game-announcer callout. Neutral tone, no pause before speaking.",
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`OpenRouter could not voice ${name} (${response.status}): ${(await response.text()).slice(0, 500)}`);
    const output = join(directory, `${id}.ogg`);
    const result = spawnSync("ffmpeg", ["-nostdin", "-y", "-loglevel", "error", "-i", "pipe:0", "-af", filters, "-c:a", "libopus", "-b:a", "64k", "-ar", "48000", "-ac", "2", output], {
      input: Buffer.from(await response.arrayBuffer()), stdio: ["pipe", "inherit", "inherit"], timeout: 15_000,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`FFmpeg could not encode ${name}`);
    console.log(`${name} → assets/deadlock/voice/${id}.ogg`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Voice generation failed");
  process.exitCode = 1;
}
