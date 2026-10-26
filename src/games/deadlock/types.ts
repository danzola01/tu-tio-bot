export interface CalloutSettings {
  announce: boolean;
  warningSeconds: number | null;
  countdownSeconds: number | null;
}

export interface Objective {
  id: string;
  name: string;
  enabled: boolean;
  firstAt: number;
  repeatEvery: number | null;
  first: CalloutSettings;
  recurring: CalloutSettings;
}

export interface AudioClip {
  sound: "beep" | "ding";
  path: string;
}

export interface SoundLibrary {
  prepare(sound: AudioClip["sound"]): Promise<AudioClip>;
}

export interface PreparedCallouts {
  due?: AudioClip;
  warning?: AudioClip;
  countdown?: AudioClip;
}

export interface PreparedObjective {
  objective: Objective;
  first: PreparedCallouts;
  recurring: PreparedCallouts;
}

export interface Callout {
  at: number;
  clips: readonly AudioClip[];
  /** Absolute performance.now() milliseconds; queueing must not extend this. */
  expiresAt: number;
}
import type { DiscordGatewayAdapterCreator } from "@discordjs/voice";


export interface VoiceTarget {
  guildId: string;
  channelId: string;
  adapterCreator: DiscordGatewayAdapterCreator;
}

export interface VoiceSession {
  play(clips: readonly AudioClip[], expiresAt?: number): Promise<void>;
  cancel(): void;
  close(): void;
}

export interface VoiceTransport {
  connect(target: VoiceTarget, onLost: (reason: string) => void, signal: AbortSignal): Promise<VoiceSession>;
}
