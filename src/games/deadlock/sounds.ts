import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DeadlockError } from "./errors.js";
import type { AudioClip, SoundLibrary } from "./types.js";

export class BundledSounds implements SoundLibrary {
  constructor(private readonly directory = fileURLToPath(new URL("../../../assets/deadlock/", import.meta.url))) {}

  async prepare(sound: AudioClip["sound"], objectiveId?: string): Promise<AudioClip> {
    if (sound !== "voice") {
      return this.check(sound, join(this.directory, `${sound}.ogg`), "Bundled reminder sound is unavailable. Restore assets/deadlock and check file read permissions.");
    }
    if (!objectiveId || !/^[a-z0-9][a-z0-9-]{0,47}$/.test(objectiveId)) throw new DeadlockError("A spoken warning needs a valid objective ID.");
    return this.check(sound, join(this.directory, "voice", `${objectiveId}.ogg`),
      `No spoken warning is recorded for ${objectiveId}. Generate assets/deadlock/voice/${objectiveId}.ogg with npm run generate:voices, then redeploy.`);
  }

  private async check(sound: AudioClip["sound"], path: string, unavailable: string): Promise<AudioClip> {
    try {
      const file = await stat(path);
      if (!file.isFile() || !file.size) throw new Error("Empty sound file");
      await access(path, constants.R_OK);
      return { sound, path };
    } catch (error) {
      throw new DeadlockError(unavailable, { cause: error });
    }
  }
}
