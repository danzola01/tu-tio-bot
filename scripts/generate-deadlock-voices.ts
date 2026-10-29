// Development-only generator. Runtime plays the checked-in Ogg Opus files.
// Usage: npm run generate:voices [-- "Objective name" ...]; defaults to the built-in objectives.
import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultObjectives, objectiveId } from "../src/games/deadlock/objectives.js";

try { process.loadEnvFile(); } catch { /* The key may be exported instead of kept in .env. */ }

const key = process.env.OPENROUTER_API_KEY;
// Top of the Artificial Analysis TTS arena as of October 2026.
const model = process.env.DEADLOCK_TTS_MODEL ?? "elevenlabs/eleven-v4-turbo";
const voice = process.env.DEADLOCK_TTS_VOICE ?? "brian";
const directory = fileURLToPath(new URL("../assets/deadlock/voice/", import.meta.url));
const requested = process.argv.slice(2);
const objectives = requested.length ? requested.map((name) => ({ id: objectiveId(name), name: name.trim() })) : defaultObjectives();
// Trim trailing silence only: speech starts within milliseconds, so trimming the head clips soft first consonants.
// A short lead-in keeps players (Discord included) from swallowing the first word.
const shape = "areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,adelay=150:all=1";
const loudness = "loudnorm=I=-16:TP=-1:LRA=11";

function ffmpeg(audio: Buffer, args: string[]) {
  const result = spawnSync("ffmpeg", ["-nostdin", "-hide_banner", "-y", "-i", "pipe:0", ...args], { input: audio, timeout: 15_000, maxBuffer: 1 << 24 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`FFmpeg failed: ${result.stderr.toString().slice(-500)}`);
  return result.stderr.toString();
}

// Two-pass loudnorm applies one linear gain; single-pass mode ramps volume at the start of short clips.
function normalize(audio: Buffer) {
  const report = ffmpeg(audio, ["-af", `${shape},${loudness}:print_format=json`, "-f", "null", "-"]);
  const measured = JSON.parse(report.slice(report.lastIndexOf("{"), report.lastIndexOf("}") + 1)) as Record<string, string>;
  return `${shape},${loudness}:linear=true:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}`;
}

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
    const audio = Buffer.from(await response.arrayBuffer());
    ffmpeg(audio, ["-loglevel", "error", "-af", normalize(audio), "-c:a", "libopus", "-b:a", "64k", "-ar", "48000", "-ac", "2", join(directory, `${id}.ogg`)]);
    console.log(`${name} → assets/deadlock/voice/${id}.ogg`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Voice generation failed");
  process.exitCode = 1;
}
