import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DeadlockError } from "./errors.js";
import type { AudioClip, SoundLibrary } from "./types.js";

export class BundledSounds implements SoundLibrary {
  constructor(private readonly directory = fileURLToPath(new URL("../../../assets/deadlock/", import.meta.url))) {}

  async prepare(sound: AudioClip["sound"]): Promise<AudioClip> {
    const path = join(this.directory, `${sound}.ogg`);
    try {
      const file = await stat(path);
      if (!file.isFile() || !file.size) throw new Error("Empty sound file");
      await access(path, constants.R_OK);
      return { sound, path };
    } catch (error) {
      throw new DeadlockError("Bundled reminder sound is unavailable. Restore assets/deadlock and check file read permissions.", { cause: error });
    }
  }
}
