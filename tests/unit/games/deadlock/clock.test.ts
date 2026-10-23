import { describe, expect, it } from "vitest";
import { ReminderRun } from "../../../../src/games/deadlock/clock.js";
import type { PreparedObjective } from "../../../../src/games/deadlock/types.js";

function camp(name = "Small camps", firstAt = 120): PreparedObjective {
  return {
    objective: {
      id: name, name, enabled: true, firstAt, repeatEvery: null,
      first: { announce: true, warningSeconds: 30, text: "{name} are available.", warningText: "{name} in {seconds} seconds." },
      recurring: { announce: true, warningSeconds: null, text: "Check {name}.", warningText: "Check {name} in {seconds} seconds." },
    },
    first: { warning: { text: `${name} in thirty seconds.`, path: `${name}-warning.ogg` }, due: { text: `${name} are available.`, path: `${name}.ogg` } },
    recurring: { due: { text: `Check ${name}.`, path: `${name}-repeat.ogg` } },
  };
}

describe("Deadlock match clock", () => {
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
    expect(run.takeDue()).toEqual([{ at: 480, clips: [small.recurring.due, sinners.first.due, large.first.due] }]);
    now = 780_000;
    expect(run.takeDue()).toEqual([{ at: 780, clips: [sinners.recurring.due] }]);
  });

  it("supports recurring warnings independently of first and recurring due callouts", () => {
    let now = 0;
    const small = camp();
    small.objective.repeatEvery = 90;
    small.objective.first = { ...small.objective.first, announce: false, warningSeconds: null };
    small.objective.recurring = { ...small.objective.recurring, announce: false, warningSeconds: 20 };
    small.recurring.warning = { text: "Check Small camps in 20 seconds.", path: "repeat-warning.ogg" };
    const run = new ReminderRun([small], 0, () => now);
    expect(run.status().nextAt).toBe(190);
    now = 190_000;
    expect(run.takeDue()).toEqual([{ at: 190, clips: [small.recurring.warning] }]);
    now = 210_000;
    expect(run.takeDue()).toEqual([]);
    expect(run.status().nextAt).toBe(280);
  });
});
