import { DeadlockError } from "./errors.js";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rename, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { AudioClip, Speech } from "./types.js";

async function run(executable: string, args: string[], input = ""): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, { stdio: ["pipe", "ignore", "pipe"], timeout: 15_000, killSignal: "SIGKILL" });
    let diagnostic = "";
    child.stderr.on("data", (chunk: Buffer) => { if (diagnostic.length < 4096) diagnostic += chunk.toString(); });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`${executable} failed (${code}): ${diagnostic}`)));
    child.stdin.on("error", () => { /* A process that exits early closes stdin; its exit reports the failure. */ });
    child.stdin.end(input);
  });
}

export class CachedSpeech implements Speech {
  private readonly directory: string;
  private readonly pending = new Map<string, Promise<AudioClip>>();

  constructor(directory: string, private readonly programs: { espeak?: string; ffmpeg?: string } = {}) {
    this.directory = resolve(directory);
  }

  async prepare(text: string): Promise<AudioClip> {
    if (!text.trim() || text.length > 400) throw new DeadlockError("Speech must contain 1–400 characters");
    const key = createHash("sha256").update(`espeak-ng:en-us:175:ogg-opus:v1:${text}`).digest("hex");
    const pending = this.pending.get(key);
    if (pending) return pending;
    const operation = this.render(text, key);
    this.pending.set(key, operation);
    try { return await operation; }
    finally { this.pending.delete(key); }
  }

  private async render(text: string, key: string): Promise<AudioClip> {
    const path = join(this.directory, `${key}.ogg`);
    let temporary: string | undefined;
    try {
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      try {
        const file = await stat(path);
        if (file.isFile() && file.size > 0) return { text, path };
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
      }
      temporary = await mkdtemp(join(this.directory, ".speech-"));
      const wave = join(temporary, "callout.wav");
      const opus = join(temporary, "callout.ogg");
      await run(this.programs.espeak ?? "espeak-ng", ["-v", "en-us", "-s", "175", "-w", wave, "--stdin"], text);
      await run(this.programs.ffmpeg ?? "ffmpeg", ["-nostdin", "-y", "-loglevel", "error", "-i", wave, "-c:a", "libopus", "-ar", "48000", "-ac", "2", opus]);
      await rename(opus, path);
      return { text, path };
    } catch (error) {
      throw new DeadlockError("Could not prepare speech. Check eSpeak NG, FFmpeg with libopus, and audio-cache permissions.", { cause: error });
    } finally {
      if (temporary) await rm(temporary, { recursive: true, force: true });
    }
  }
}
