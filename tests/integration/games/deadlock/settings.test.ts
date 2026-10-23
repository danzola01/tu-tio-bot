import { describe, expect, it } from "vitest";
import { ObjectiveSettings } from "../../../../src/games/deadlock/settings.js";
import { testDb } from "../../../setup.js";
import type { Speech } from "../../../../src/games/deadlock/types.js";

const speech: Speech = { prepare: async (text) => ({ text, path: `/audio/${text}.ogg` }) };

describe("Deadlock objective settings", () => {
  it("persists editable timing, recurrence, warnings, and wording across settings instances", async () => {
    const settings = new ObjectiveSettings(testDb, speech);
    const initial = await settings.list("server");
    expect(initial.map(({ id, firstAt, repeatEvery }) => [id, firstAt, repeatEvery])).toEqual([
      ["small-camps", 120, 90], ["medium-camps", 300, null], ["large-camps", 480, null], ["bridge-buffs", 300, 300], ["sinners", 480, 300],
    ]);
    const small = initial[0]!;
    await settings.save("server", {
      ...small, name: "Small jungle camps", firstAt: 180, repeatEvery: 120,
      first: { ...small.first, announce: false, warningSeconds: 15, warningText: "{name}: {seconds} seconds." },
      recurring: { ...small.recurring, warningSeconds: 10, text: "Time to farm." },
    });
    const restarted = new ObjectiveSettings(testDb, speech);
    expect((await restarted.list("server"))[0]).toMatchObject({ name: "Small jungle camps", firstAt: 180, repeatEvery: 120, first: { announce: false, warningSeconds: 15 }, recurring: { warningSeconds: 10, text: "Time to farm." } });
    const prepared = (await restarted.prepare("server"))[0]!;
    expect(prepared.first).toEqual({ warning: { text: "Small jungle camps: 15 seconds.", path: "/audio/Small jungle camps: 15 seconds..ogg" } });
    expect(prepared.recurring.due?.text).toBe("Time to farm.");
    expect((await restarted.list("other-server"))[0]!.name).toBe("Small camps");
  });

  it("keeps the saved schedule when speech preparation for an edit fails", async () => {
    const settings = new ObjectiveSettings(testDb, { prepare: async () => { throw new Error("Speech unavailable"); } });
    const original = await settings.list("server");
    await expect(settings.save("server", { ...original[0]!, name: "Changed camps" })).rejects.toThrow("Speech unavailable");
    expect(await settings.list("server")).toEqual(original);
  });

  it("rejects a concurrent stale edit instead of overwriting another saved change", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let arrivals = 0;
    const settings = new ObjectiveSettings(testDb, { prepare: async (text) => {
      if (++arrivals === 2) release();
      await gate;
      return { text, path: "/audio/clip.ogg" };
    } });
    const initial = await settings.list("server");
    const results = await Promise.allSettled([
      settings.edit("server", initial[0]!.id, (objective) => ({ ...objective, name: "New small camps" })),
      settings.edit("server", initial[1]!.id, (objective) => ({ ...objective, name: "New medium camps" })),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: expect.objectContaining({ message: expect.stringContaining("changed") }) });
  });

  it("applies partial edits to the latest saved objective", async () => {
    const settings = new ObjectiveSettings(testDb, speech);
    const original = (await settings.list("server"))[0]!;
    await settings.save("server", { ...original, name: "Renamed camps" });
    await settings.edit("server", original.id, (objective) => ({ ...objective, repeatEvery: 180 }));
    expect((await settings.list("server"))[0]).toMatchObject({ name: "Renamed camps", repeatEvery: 180 });
  });

  it("adds disabled objectives without speaking them and allows their removal", async () => {
    const settings = new ObjectiveSettings(testDb, speech);
    const initial = await settings.list("server");
    await settings.save("server", { ...initial[0]!, id: "urn", name: "Urn", enabled: false, firstAt: 600, repeatEvery: null });
    expect((await settings.list("server")).map((objective) => objective.id)).toContain("urn");
    expect((await settings.prepare("server")).map((item) => item.objective.id)).not.toContain("urn");
    await settings.remove("server", "urn");
    expect(await settings.list("server")).toEqual(initial);
  });

  it("rejects impossible warnings and unknown speech placeholders without changing settings", async () => {
    const settings = new ObjectiveSettings(testDb, speech);
    const original = await settings.list("server");
    const small = original[0]!;
    await expect(settings.save("server", { ...small, first: { ...small.first, warningSeconds: 120 } })).rejects.toThrow("before");
    await expect(settings.save("server", { ...small, recurring: { ...small.recurring, text: "Check {unknown}." } })).rejects.toThrow("placeholder");
    expect(await settings.list("server")).toEqual(original);
  });
});
