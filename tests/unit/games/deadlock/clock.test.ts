import { describe, expect, it } from "vitest";
import { ReminderRun } from "../../../../src/games/deadlock/clock.js";
import type { PreparedObjective } from "../../../../src/games/deadlock/types.js";

function camp(name = "Small camps", firstAt = 120): PreparedObjective {
  return {
    objective: {
      id: name, name, enabled: true, spoken: false, firstAt, repeatEvery: null,
      first: { announce: true, warningSeconds: 30, countdownSeconds: null },
      recurring: { announce: true, warningSeconds: null, countdownSeconds: null },
    },
    first: { warning: { sound: "beep", path: `${name}-warning.ogg` }, due: { sound: "ding", path: `${name}.ogg` } },
    recurring: { due: { sound: "ding", path: `${name}-repeat.ogg` } },
  };
}

describe("Deadlock match clock", () => {
  it("beeps at 1:30 and 1:55 through 1:59, then dings at 2:00", () => {
    let now = 0;
    const small = camp();
    small.objective.first.countdownSeconds = 5;
    small.first.countdown = { sound: "beep", path: "beep.ogg" };
    small.first.warning = { sound: "beep", path: "beep.ogg" };
    small.first.due = { sound: "ding", path: "ding.ogg" };
    const run = new ReminderRun([small], 0, () => now);
    const heard: [number, string, number][] = [];
    for (const second of [90, 115, 116, 117, 118, 119, 120]) {
      now = second * 1000;
      for (const event of run.takeDue()) heard.push([event.at, event.clips[0]!.sound, event.expiresAt]);
    }
    expect(heard).toEqual([[90, "beep", 92000], [115, "beep", 116000], [116, "beep", 117000], [117, "beep", 118000], [118, "beep", 119000], [119, "beep", 120000], [120, "ding", 122000]]);
  });
  it("announces a camp at 1:30 and 2:00 once each", () => {
    let now = 0;
    const small = camp();
    const run = new ReminderRun([small], 0, () => now);
    expect(run.status().nextAt).toBe(90);
    now = 90_000;
    expect(run.takeDue()).toMatchObject([{ at: 90, clips: [small.first.warning] }]);
    expect(run.takeDue()).toMatchObject([]);
    now = 120_000;
    expect(run.takeDue()).toMatchObject([{ at: 120, clips: [small.first.due] }]);
    expect(run.status().nextAt).toBeNull();
  });

  it("freezes during pause, skips forward, and re-arms callouts after a rewind", () => {
    let now = 0;
    const small = camp();
    const run = new ReminderRun([small], 0, () => now);
    now = 80_000;
    run.pause();
    now = 200_000;
    expect(run.status()).toMatchObject({ elapsed: 80, paused: true, nextAt: null });
    expect(run.takeDue()).toMatchObject([]);
    run.resume();
    now = 210_000;
    expect(run.takeDue()).toMatchObject([{ at: 90, clips: [small.first.warning] }]);
    run.sync(150);
    expect(run.takeDue()).toMatchObject([]);
    run.sync(90);
    now += 30_000;
    expect(run.takeDue()).toMatchObject([{ at: 120, clips: [small.first.due] }]);
    run.sync(90);
    now += 30_000;
    expect(run.takeDue()).toMatchObject([{ at: 120, clips: [small.first.due] }]);
  });

  it("combines simultaneous objectives and repeats checks without playing a stalled backlog", () => {
    let now = 0;
    const small = camp();
    small.objective.repeatEvery = 90;
    const sinners = camp("Sinners", 480);
    sinners.objective.repeatEvery = 300;
    const large = camp("Large camps", 480);
    const run = new ReminderRun([small, sinners, large], 0, () => now);
    now = 210_000;
    expect(run.takeDue()).toMatchObject([{ at: 210, clips: [small.recurring.due] }]);
    now = 480_000;
    expect(run.takeDue()).toMatchObject([{ at: 480, clips: [small.recurring.due] }]);
    now = 780_000;
    expect(run.takeDue()).toMatchObject([{ at: 780, clips: [sinners.recurring.due] }]);
  });

  it("supports recurring warnings independently of first and recurring due callouts", () => {
    let now = 0;
    const small = camp();
    small.objective.repeatEvery = 90;
    small.objective.first = { ...small.objective.first, announce: false, warningSeconds: null };
    small.objective.recurring = { ...small.objective.recurring, announce: false, warningSeconds: 20 };
    small.recurring.warning = { sound: "beep", path: "repeat-warning.ogg" };
    const run = new ReminderRun([small], 0, () => now);
    expect(run.status().nextAt).toBe(190);
    now = 190_000;
    expect(run.takeDue()).toMatchObject([{ at: 190, clips: [small.recurring.warning] }]);
    now = 210_000;
    expect(run.takeDue()).toMatchObject([]);
    expect(run.status().nextAt).toBe(280);
  });

  it("supports countdown-only repeats and re-arms ticks after a backward sync", () => {
    let now = 0;
    const small = camp();
    small.objective.repeatEvery = 90;
    small.objective.first = { announce: false, warningSeconds: null, countdownSeconds: null };
    small.objective.recurring = { announce: false, warningSeconds: null, countdownSeconds: 3 };
    small.recurring.countdown = { sound: "beep", path: "beep.ogg" };
    const run = new ReminderRun([small], 0, () => now);
    expect(run.status().nextAt).toBe(207);
    run.sync(206);
    now = 1000;
    expect(run.takeDue()).toMatchObject([{ at: 207, clips: [small.recurring.countdown] }]);
    run.sync(205);
    now = 3000;
    expect(run.takeDue()).toMatchObject([{ at: 207, clips: [small.recurring.countdown] }]);
    run.sync(300);
    expect(run.takeDue()).toMatchObject([]);
    expect(run.status().nextAt).toBe(387);
  });

  it("coalesces overlapping beeps, prioritizes a due ding, and skips stale countdown ticks", () => {
    let now = 0;
    const first = camp();
    first.objective.first.warningSeconds = 5;
    first.objective.first.countdownSeconds = 5;
    first.first.countdown = { sound: "beep", path: "beep.ogg" };
    const other = camp("Another reminder", 115);
    const run = new ReminderRun([first, other], 0, () => now);
    now = 115_000;
    expect(run.takeDue()).toMatchObject([{ at: 115, clips: [other.first.due] }]);
    now = 118_500;
    expect(run.takeDue()).toMatchObject([{ at: 118, clips: [first.first.countdown] }]);
    now = 119_000;
    expect(run.takeDue()).toMatchObject([{ at: 119, clips: [first.first.countdown] }]);
  });

  it("speaks every simultaneous warning after a ding instead of collapsing them into one beep", () => {
    let now = 0;
    const medium = camp("Medium camps", 300);
    const bridge = camp("Bridge buffs", 300);
    const small = camp("Small camps", 270);
    medium.first.warning = { sound: "voice", path: "medium-camps.ogg" };
    bridge.first.warning = { sound: "voice", path: "bridge-buffs.ogg" };
    const run = new ReminderRun([medium, bridge, small], 0, () => now);
    now = 270_000;
    expect(run.takeDue()).toEqual([{ at: 270, clips: [small.first.due, medium.first.warning, bridge.first.warning], expiresAt: 272000 }]);
  });

  it("lets a spoken warning replace an overlapping countdown beep", () => {
    let now = 0;
    const small = camp();
    small.objective.first.warningSeconds = 5;
    small.objective.first.countdownSeconds = 5;
    small.first.warning = { sound: "voice", path: "small-camps.ogg" };
    small.first.countdown = { sound: "beep", path: "beep.ogg" };
    const run = new ReminderRun([small], 0, () => now);
    now = 115_000;
    expect(run.takeDue()).toEqual([{ at: 115, clips: [small.first.warning], expiresAt: 117000 }]);
    now = 116_000;
    expect(run.takeDue()).toEqual([{ at: 116, clips: [small.first.countdown], expiresAt: 117000 }]);
  });

  it("does not revive an expired countdown through an overlapping advance beep", () => {
    let now = 0;
    const small = camp();
    small.objective.first.warningSeconds = 5;
    small.objective.first.countdownSeconds = 5;
    small.first.countdown = { sound: "beep", path: "beep.ogg" };
    const run = new ReminderRun([small], 0, () => now);
    now = 116_500;
    expect(run.takeDue()).toEqual([{ at: 116, clips: [small.first.countdown], expiresAt: 117000 }]);
  });
});
