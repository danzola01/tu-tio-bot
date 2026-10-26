import { describe, expect, it } from "vitest";
import { ReminderRun } from "../../../../src/games/deadlock/clock.js";
import type { PreparedObjective } from "../../../../src/games/deadlock/types.js";

function camp(name = "Small camps", firstAt = 120): PreparedObjective {
  return {
    objective: {
      id: name, name, enabled: true, firstAt, repeatEvery: null,
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
    const heard: [number, string][] = [];
    for (const second of [90, 115, 116, 117, 118, 119, 120]) {
      now = second * 1000;
      for (const event of run.takeDue()) heard.push([event.at, event.clips[0]!.sound]);
    }
    expect(heard).toEqual([[90, "beep"], [115, "beep"], [116, "beep"], [117, "beep"], [118, "beep"], [119, "beep"], [120, "ding"]]);
  });
  it("announces a camp at 1:30 and 2:00 once each", () => {
    let now = 0;
    const small = camp();
    const run = new ReminderRun([small], 0, () => now);
    expect(run.status().nextAt).toBe(90);
    now = 90_000;
    expect(run.takeDue()).toEqual([{ at: 90, clips: [small.first.warning] }]);
    expect(run.takeDue()).toEqual([]);
    now = 120_000;
    expect(run.takeDue()).toEqual([{ at: 120, clips: [small.first.due] }]);
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
    expect(run.takeDue()).toEqual([]);
    run.resume();
    now = 210_000;
    expect(run.takeDue()).toEqual([{ at: 90, clips: [small.first.warning] }]);
    run.sync(150);
    expect(run.takeDue()).toEqual([]);
    run.sync(90);
    now += 30_000;
    expect(run.takeDue()).toEqual([{ at: 120, clips: [small.first.due] }]);
    run.sync(90);
    now += 30_000;
    expect(run.takeDue()).toEqual([{ at: 120, clips: [small.first.due] }]);
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
    expect(run.takeDue()).toEqual([{ at: 210, clips: [small.recurring.due] }]);
    now = 480_000;
    expect(run.takeDue()).toEqual([{ at: 480, clips: [small.recurring.due] }]);
    now = 780_000;
    expect(run.takeDue()).toEqual([{ at: 780, clips: [sinners.recurring.due] }]);
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
    expect(run.takeDue()).toEqual([{ at: 190, clips: [small.recurring.warning] }]);
    now = 210_000;
    expect(run.takeDue()).toEqual([]);
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
    expect(run.takeDue()).toEqual([{ at: 207, clips: [small.recurring.countdown] }]);
    run.sync(205);
    now = 3000;
    expect(run.takeDue()).toEqual([{ at: 207, clips: [small.recurring.countdown] }]);
    run.sync(300);
    expect(run.takeDue()).toEqual([]);
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
    expect(run.takeDue()).toEqual([{ at: 115, clips: [other.first.due] }]);
    now = 118_500;
    expect(run.takeDue()).toEqual([{ at: 118, clips: [first.first.countdown] }]);
    now = 119_000;
    expect(run.takeDue()).toEqual([{ at: 119, clips: [first.first.countdown] }]);
  });
});
