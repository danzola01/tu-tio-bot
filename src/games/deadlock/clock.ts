import type { AudioClip, Callout, PreparedObjective } from "./types.js";

export class ReminderRun {
  private anchor: number;
  private last: number;
  private paused = false;

  constructor(
    private readonly schedule: readonly PreparedObjective[],
    private elapsedAtAnchor = 0,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.anchor = now();
    this.last = elapsedAtAnchor;
  }

  private elapsed() {
    return this.elapsedAtAnchor + (this.paused ? 0 : (this.now() - this.anchor) / 1000);
  }

  pause() {
    this.elapsedAtAnchor = this.elapsed();
    this.last = this.elapsedAtAnchor;
    this.paused = true;
  }

  resume() {
    if (!this.paused) return;
    this.anchor = this.now();
    this.paused = false;
  }

  sync(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error("Match time must be nonnegative");
    this.elapsedAtAnchor = seconds;
    this.anchor = this.now();
    this.last = seconds;
  }

  private events(after: number): { at: number; interval: number | null; clip: AudioClip; countdown?: boolean }[] {
    return this.schedule.filter((item) => item.objective.enabled).flatMap((item) => {
      const { firstAt, repeatEvery, first, recurring } = item.objective;
      const events: { at: number; interval: number | null; clip: AudioClip; countdown?: boolean }[] = [];
      const countdown = (at: number, seconds: number | null, clip: AudioClip | undefined, interval: number | null) => {
        if (seconds !== null && clip) {
          for (let lead = seconds; lead >= 1; lead--) events.push({ at: at - lead, interval, clip, countdown: true });
        }
      };
      countdown(firstAt, first.countdownSeconds, item.first.countdown, null);
      if (item.first.warning && first.warningSeconds !== null) events.push({ at: firstAt - first.warningSeconds, interval: null, clip: item.first.warning });
      if (item.first.due && first.announce) events.push({ at: firstAt, interval: null, clip: item.first.due });
      if (repeatEvery !== null) {
        countdown(firstAt + repeatEvery, recurring.countdownSeconds, item.recurring.countdown, repeatEvery);
        if (item.recurring.warning && recurring.warningSeconds !== null) events.push({ at: firstAt + repeatEvery - recurring.warningSeconds, interval: repeatEvery, clip: item.recurring.warning });
        if (item.recurring.due && recurring.announce) events.push({ at: firstAt + repeatEvery, interval: repeatEvery, clip: item.recurring.due });
      }
      return events.map((event) => ({
        ...event,
        at: event.interval !== null && event.at <= after
          ? event.at + (Math.floor((after - event.at) / event.interval) + 1) * event.interval
          : event.at,
      })).filter((event) => event.at > after);
    });
  }

  status() {
    const elapsed = this.elapsed();
    const future = this.events(elapsed);
    return { elapsed, paused: this.paused, nextAt: !this.paused && future.length ? Math.min(...future.map((event) => event.at)) : null };
  }

  takeDue(): Callout[] {
    if (this.paused) return [];
    const elapsed = this.elapsed();
    const groups = new Map<number, { clip: AudioClip; expiresAt: number }[]>();
    // Discard stale announcements after a stalled event loop or interrupted connection.
    for (const event of this.events(Math.max(this.last, elapsed - 2))) {
      while (event.at <= elapsed) {
        if (!event.countdown || elapsed - event.at < 1) {
          const expiresAt = this.anchor + (event.at - this.elapsedAtAnchor) * 1000 + (event.countdown ? 1000 : 2000);
          groups.set(event.at, [...(groups.get(event.at) ?? []), { clip: event.clip, expiresAt }]);
        }
        if (event.interval === null) break;
        event.at += event.interval;
      }
    }
    this.last = elapsed;
    return [...groups].sort(([a], [b]) => a - b).map(([at, sounds]) => {
      const selected = sounds.find(({ clip }) => clip.sound === "ding")
        ?? sounds.reduce((earliest, sound) => sound.expiresAt < earliest.expiresAt ? sound : earliest);
      return { at, clips: [selected.clip], expiresAt: selected.expiresAt };
    });
  }
}
