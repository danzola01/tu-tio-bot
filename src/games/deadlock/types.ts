export interface CalloutSettings {
  announce: boolean;
  warningSeconds: number | null;
  text: string;
  warningText: string;
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
  text: string;
  path: string;
}

export interface Speech {
  prepare(text: string): Promise<AudioClip>;
}

export interface PreparedCallouts {
  due?: AudioClip;
  warning?: AudioClip;
}

export interface PreparedObjective {
  objective: Objective;
  first: PreparedCallouts;
  recurring: PreparedCallouts;
}

export interface Callout {
  at: number;
  clips: readonly AudioClip[];
}
import type { DiscordGatewayAdapterCreator } from "@discordjs/voice";


export interface VoiceTarget {
  guildId: string;
  channelId: string;
  adapterCreator: DiscordGatewayAdapterCreator;
}

export interface VoiceSession {
  play(clips: readonly AudioClip[]): Promise<void>;
  cancel(): void;
  close(): void;
}

export interface VoiceTransport {
  connect(target: VoiceTarget, onLost: (reason: string) => void, signal: AbortSignal): Promise<VoiceSession>;
}
