import { DeadlockError } from "./errors.js";
import { logger } from "../../infra/logger.js";
import { ReminderRun } from "./clock.js";
import type { ObjectiveSettings } from "./settings.js";
import type { VoiceSession, VoiceTarget, VoiceTransport } from "./types.js";

interface ActiveMatch {
  target: VoiceTarget;
  requestedAt: number;
  initialTime: number;
  abort: AbortController;
  voice: VoiceSession | undefined;
  run: ReminderRun | undefined;
  timer: ReturnType<typeof setTimeout> | undefined;
  phase: "starting" | "running" | "preview";
  notify: (reason: string) => Promise<void>;
}

export class DeadlockMatches {
  private readonly matches = new Map<string, ActiveMatch>();

  constructor(private readonly settings: ObjectiveSettings, private readonly transport: VoiceTransport, private readonly now = () => performance.now()) {}

  private reserve(target: VoiceTarget, seconds: number, phase: ActiveMatch["phase"], notify: ActiveMatch["notify"] = async () => {}) {
    if (this.matches.has(target.guildId)) throw new DeadlockError("A Deadlock timer is already active. Stop it first.");
    if (!Number.isFinite(seconds) || seconds < 0) throw new DeadlockError("Match time must be nonnegative");
    const match: ActiveMatch = { target, requestedAt: this.now(), initialTime: seconds, abort: new AbortController(), voice: undefined, run: undefined, timer: undefined, phase, notify };
    this.matches.set(target.guildId, match);
    return match;
  }

  private async connect(match: ActiveMatch) {
    if (!this.current(match)) throw new DeadlockError("Timer start cancelled.");
    const voice = await this.transport.connect(match.target, (reason) => this.fail(match, reason), match.abort.signal);
    if (!this.current(match)) { voice.close(); throw new DeadlockError("Timer start cancelled."); }
    match.voice = voice;
    return voice;
  }

  async start(target: VoiceTarget, seconds = 0, notify: ActiveMatch["notify"] = async () => {}) {
    const match = this.reserve(target, seconds, "starting", notify);
    try {
      const schedule = await this.settings.prepare(target.guildId);
      if (!schedule.some((item) => item.first.due || item.first.warning || item.recurring.due || item.recurring.warning)) throw new DeadlockError("Enable at least one objective callout before starting.");
      await this.connect(match);
      match.run = new ReminderRun(structuredClone(schedule), seconds + (this.now() - match.requestedAt) / 1000, this.now);
      match.phase = "running";
      this.arm(match);
      return this.status(target.guildId);
    } catch (error) {
      if (this.current(match)) this.stop(target.guildId);
      throw error;
    }
  }

  async preview(target: VoiceTarget, id: string, kind: "first" | "first-warning" | "repeat" | "repeat-warning" = "first") {
    const match = this.reserve(target, 0, "preview");
    try {
      const item = (await this.settings.prepare(target.guildId)).find((item) => item.objective.id === id);
      if (!item) throw new DeadlockError("Objective not found or disabled.");
      const clip = { first: item.first.due, "first-warning": item.first.warning, repeat: item.recurring.due, "repeat-warning": item.recurring.warning }[kind];
      if (!clip) throw new DeadlockError("This callout is disabled. Edit its settings first.");
      const voice = await this.connect(match);
      await voice.play([clip]);
    } finally {
      if (this.current(match)) this.stop(target.guildId);
    }
  }

  status(guildId: string) {
    const match = this.matches.get(guildId);
    if (!match) return null;
    return {
      channelId: match.target.channelId, phase: match.phase, connected: match.voice !== undefined,
      ...(match.run?.status() ?? { elapsed: match.initialTime + (this.now() - match.requestedAt) / 1000, paused: false, nextAt: null }),
    };
  }

  private current(match: ActiveMatch) { return this.matches.get(match.target.guildId) === match; }

  private running(guildId: string) {
    const match = this.matches.get(guildId);
    if (!match?.run) throw new DeadlockError("No running timer. It may still be starting.");
    return { match, run: match.run };
  }

  pause(guildId: string) {
    const { match, run } = this.running(guildId);
    run.pause(); match.voice?.cancel(); this.arm(match);
  }

  resume(guildId: string) {
    const { match, run } = this.running(guildId);
    run.resume(); this.arm(match);
  }

  sync(guildId: string, seconds: number) {
    const { match, run } = this.running(guildId);
    run.sync(seconds); match.voice?.cancel(); this.arm(match);
  }

  stop(guildId: string) {
    const match = this.matches.get(guildId);
    if (!match) return;
    this.matches.delete(guildId);
    if (match.timer) clearTimeout(match.timer);
    match.abort.abort();
    match.voice?.close();
  }

  dispose() { for (const guildId of this.matches.keys()) this.stop(guildId); }

  private fail(match: ActiveMatch, reason: string) {
    if (!this.current(match)) return;
    this.stop(match.target.guildId);
    void match.notify(`${reason} Timer stopped; use /deadlock start with the current game time.`)
      .catch((error: unknown) => logger.error({ err: error }, "Could not report the Deadlock voice failure"));
  }

  private arm(match: ActiveMatch) {
    if (match.timer) clearTimeout(match.timer);
    const state = match.run?.status();
    if (!state || state.nextAt === null || !this.current(match)) return;
    match.timer = setTimeout(() => {
      if (!this.current(match) || !match.run || !match.voice) return;
      for (const callout of match.run.takeDue()) {
        void match.voice.play(callout.clips).catch((error: unknown) => {
          logger.error({ err: error }, "Deadlock playback failed");
          this.fail(match, "Voice playback failed.");
        });
      }
      this.arm(match);
    }, Math.max(1, Math.ceil((state.nextAt - state.elapsed) * 1000)));
  }
}
