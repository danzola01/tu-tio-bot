import { DeadlockError } from "./errors.js";
import {
  AudioPlayerStatus, NoSubscriberBehavior, StreamType, VoiceConnectionStatus,
  createAudioPlayer, createAudioResource, entersState, joinVoiceChannel,
} from "@discordjs/voice";
import type { AudioClip, VoiceSession, VoiceTarget, VoiceTransport } from "./types.js";

interface Announcement {
  clips: AudioClip[];
  created: number;
  resolve(): void;
  reject(error: Error): void;
}

export class DiscordVoiceTransport implements VoiceTransport {
  async connect(target: VoiceTarget, onLost: (reason: string) => void, signal: AbortSignal): Promise<VoiceSession> {
    signal.throwIfAborted();
    const connection = joinVoiceChannel({ ...target, selfDeaf: true, selfMute: false });
    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
    const subscription = connection.subscribe(player);
    let closed = false;
    let busy = false;
    let current: Announcement | undefined;
    let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
    const queue: Announcement[] = [];

    const clear = (error?: Error) => {
      const waiting = [...(current ? [current] : []), ...queue];
      current = undefined; queue.length = 0; busy = false;
      player.stop(true);
      for (const item of waiting) error ? item.reject(error) : item.resolve();
    };
    const close = (error?: Error) => {
      if (closed) return;
      closed = true;
      if (recoveryTimer) clearTimeout(recoveryTimer);
      signal.removeEventListener("abort", abort);
      clear(error);
      subscription?.unsubscribe();
      if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
    };
    const fail = (reason: string) => {
      if (closed) return;
      close(new Error(reason));
      onLost(reason);
    };
    const abort = () => close();
    const pump = () => {
      if (closed || busy) return;
      if (!current) {
        current = queue.shift();
        while (current && performance.now() - current.created > 2000) { current.resolve(); current = queue.shift(); }
      }
      if (!current) return;
      const clip = current.clips.shift();
      if (!clip) { current.resolve(); current = undefined; pump(); return; }
      try {
        busy = true;
        player.play(createAudioResource(clip.path, { inputType: StreamType.OggOpus }));
      } catch { fail("Voice playback failed."); }
    };
    player.on(AudioPlayerStatus.Idle, () => { busy = false; pump(); });
    player.on("error", () => fail("Voice playback failed."));
    connection.on("error", () => fail("Voice connection failed."));
    connection.on(VoiceConnectionStatus.Destroyed, () => fail("Voice connection ended."));
    connection.on("stateChange", (before, after) => {
      if (closed) return;
      if (after.status === VoiceConnectionStatus.Ready) {
        if (recoveryTimer) clearTimeout(recoveryTimer);
        recoveryTimer = undefined;
      } else if (before.status === VoiceConnectionStatus.Ready) {
        // The SDK may leave Ready directly for Signalling or Connecting, too.
        clear();
        recoveryTimer = setTimeout(() => fail("Voice connection could not reconnect."), 20_000);
      }
    });
    signal.addEventListener("abort", abort, { once: true });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, AbortSignal.any([signal, AbortSignal.timeout(20_000)]));
      if (closed) throw new Error("Voice connection cancelled.");
    } catch (error) {
      close();
      throw new DeadlockError("Could not join voice. Check channel permissions and UDP connectivity.", { cause: error });
    }

    return {
      play: (clips) => new Promise<void>((resolve, reject) => {
        if (closed) { reject(new Error("Voice connection is closed")); return; }
        if (connection.state.status !== VoiceConnectionStatus.Ready) { resolve(); return; }
        queue.push({ clips: [...clips], created: performance.now(), resolve, reject });
        if (queue.length > 2) queue.shift()?.resolve();
        pump();
      }),
      cancel: () => clear(),
      close: () => close(),
    };
  }
}
