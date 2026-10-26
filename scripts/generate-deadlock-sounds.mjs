// Development-only generator. Runtime uses the checked-in Ogg Opus files.
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const sampleRate = 48000;
const directory = fileURLToPath(new URL("../assets/deadlock/", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "tu-tio-sounds-"));

function wave(duration, sample) {
  const frames = Math.round(duration * sampleRate);
  const result = Buffer.alloc(44 + frames * 4);
  result.write("RIFF", 0);
  result.writeUInt32LE(result.length - 8, 4);
  result.write("WAVEfmt ", 8);
  result.writeUInt32LE(16, 16);
  result.writeUInt16LE(1, 20);
  result.writeUInt16LE(2, 22);
  result.writeUInt32LE(sampleRate, 24);
  result.writeUInt32LE(sampleRate * 4, 28);
  result.writeUInt16LE(4, 32);
  result.writeUInt16LE(16, 34);
  result.write("data", 36);
  result.writeUInt32LE(frames * 4, 40);
  for (let frame = 0; frame < frames; frame++) {
    const time = frame / sampleRate;
    const fade = Math.min(1, time / 0.008, (duration - time) / 0.02);
    const value = Math.round(Math.max(-1, Math.min(1, sample(time) * fade)) * 32767);
    result.writeInt16LE(value, 44 + frame * 4);
    result.writeInt16LE(value, 46 + frame * 4);
  }
  return result;
}

try {
  await mkdir(directory, { recursive: true });
  for (const [name, duration, sample] of [
    ["beep", 0.16, (time) => 0.22 * Math.sin(2 * Math.PI * 880 * time)],
    ["ding", 0.70, (time) => Math.exp(-7 * time) * (0.22 * Math.sin(2 * Math.PI * 1046.5 * time) + 0.08 * Math.sin(2 * Math.PI * 2893 * time))],
  ]) {
    const input = join(temporary, `${name}.wav`);
    await writeFile(input, wave(duration, sample));
    const result = spawnSync("ffmpeg", ["-nostdin", "-y", "-loglevel", "error", "-i", input, "-c:a", "libopus", "-b:a", "64k", "-ar", "48000", "-ac", "2", join(directory, `${name}.ogg`)], { stdio: "inherit", timeout: 15000 });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`FFmpeg could not encode ${name}`);
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
