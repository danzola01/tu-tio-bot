import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ObjectiveSettings } from "../../../../src/games/deadlock/settings.js";
import { testDb } from "../../../setup.js";
import type { SoundLibrary } from "../../../../src/games/deadlock/types.js";

const sounds: SoundLibrary = { prepare: async (sound, id) => ({ sound, path: `/audio/${id ?? sound}.ogg` }) };

describe("Deadlock objective settings", () => {
  it("persists editable timing, recurrence, warnings, and countdowns across settings instances", async () => {
    const settings = new ObjectiveSettings(testDb, sounds);
    const initial = await settings.list("server");
    expect(initial.map(({ id, firstAt, repeatEvery }) => [id, firstAt, repeatEvery])).toEqual([
      ["small-camps", 120, 90], ["medium-camps", 300, null], ["large-camps", 480, null], ["bridge-buffs", 300, 300], ["sinners", 480, 300],
    ]);
    const small = initial[0]!;
    await settings.save("server", {
      ...small, name: "Small jungle camps", firstAt: 180, repeatEvery: 120,
      first: { ...small.first, announce: false, warningSeconds: 15, countdownSeconds: 5 },
      recurring: { ...small.recurring, warningSeconds: 10, countdownSeconds: 3 },
    });
    const restarted = new ObjectiveSettings(testDb, sounds);
    expect((await restarted.list("server"))[0]).toMatchObject({ name: "Small jungle camps", firstAt: 180, repeatEvery: 120, first: { announce: false, warningSeconds: 15 }, recurring: { warningSeconds: 10, countdownSeconds: 3 } });
    const prepared = (await restarted.prepare("server"))[0]!;
    expect(prepared.first).toEqual({ warning: { sound: "voice", path: "/audio/small-camps.ogg" }, countdown: { sound: "beep", path: "/audio/beep.ogg" } });
    expect(prepared.recurring.due?.sound).toBe("ding");
    expect(prepared.recurring.countdown?.sound).toBe("beep");
    expect((await restarted.list("other-server"))[0]!.name).toBe("Small camps");
  });

  it("keeps the saved schedule when sound preparation for an edit fails", async () => {
    const settings = new ObjectiveSettings(testDb, { prepare: async () => { throw new Error("SoundLibrary unavailable"); } });
    const original = await settings.list("server");
    await expect(settings.save("server", { ...original[0]!, name: "Changed camps" })).rejects.toThrow("SoundLibrary unavailable");
    expect(await settings.list("server")).toEqual(original);
  });

  it("rejects a concurrent stale edit instead of overwriting another saved change", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let arrivals = 0;
    const settings = new ObjectiveSettings(testDb, { prepare: async (sound) => {
      if (++arrivals === 2) release();
      await gate;
      return { sound, path: "/audio/clip.ogg" };
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
    const settings = new ObjectiveSettings(testDb, sounds);
    const original = (await settings.list("server"))[0]!;
    await settings.save("server", { ...original, name: "Renamed camps" });
    await settings.edit("server", original.id, (objective) => ({ ...objective, repeatEvery: 180 }));
    expect((await settings.list("server"))[0]).toMatchObject({ name: "Renamed camps", repeatEvery: 180 });
  });

  it("adds disabled objectives without speaking them and allows their removal", async () => {
    const settings = new ObjectiveSettings(testDb, sounds);
    const initial = await settings.list("server");
    await settings.save("server", { ...initial[0]!, id: "urn", name: "Urn", enabled: false, firstAt: 600, repeatEvery: null });
    expect((await settings.list("server")).map((objective) => objective.id)).toContain("urn");
    expect((await settings.prepare("server")).map((item) => item.objective.id)).not.toContain("urn");
    await settings.remove("server", "urn");
    expect(await settings.list("server")).toEqual(initial);
  });

  it("prepares the objective's voice clip for every advance warning when spoken", async () => {
    const settings = new ObjectiveSettings(testDb, sounds);
    expect((await settings.list("server")).every((objective) => objective.spoken)).toBe(true);
    await settings.edit("server", "sinners", (objective) => ({ ...objective, recurring: { ...objective.recurring, warningSeconds: 30 } }));
    const sinners = (await settings.prepare("server")).find((item) => item.objective.id === "sinners")!;
    expect(sinners.first).toMatchObject({ warning: { sound: "voice", path: "/audio/sinners.ogg" }, countdown: { sound: "beep" }, due: { sound: "ding" } });
    expect(sinners.recurring.warning).toEqual({ sound: "voice", path: "/audio/sinners.ogg" });
  });

  it("keeps the saved schedule when an objective has no recorded voice", async () => {
    const settings = new ObjectiveSettings(testDb, { prepare: async (sound, id) => {
      if (sound === "voice") throw new Error(`No spoken warning is recorded for ${id}`);
      return { sound, path: `/audio/${sound}.ogg` };
    } });
    const original = await settings.list("server");
    await expect(settings.edit("server", "small-camps", (objective) => ({ ...objective, spoken: true }))).rejects.toThrow("small-camps");
    expect(await settings.list("server")).toEqual(original);
  });

  it("migrates saved built-in objectives to spoken warnings and leaves custom objectives alone", async () => {
    const saved = (id: string, extra: object = {}) => ({
      id, name: id, enabled: true, firstAt: 120, repeatEvery: null, ...extra,
      first: { announce: true, warningSeconds: 30, countdownSeconds: 5 }, recurring: { announce: true, warningSeconds: null, countdownSeconds: null },
    });
    await testDb.deadlockSchedule.create({ data: { guildId: "saved-server", revision: 4, objectives: [saved("sinners"), saved("urn"), saved("small-camps", { spoken: false })] } });
    const migration = new URL("../../../../prisma/migrations/20261029120000_default_spoken_warnings/migration.sql", import.meta.url);
    await testDb.$executeRawUnsafe(readFileSync(migration, "utf8"));
    const settings = new ObjectiveSettings(testDb, sounds);
    expect((await settings.list("saved-server")).map(({ id, spoken }) => [id, spoken])).toEqual([["sinners", true], ["urn", false], ["small-camps", true]]);
    expect((await testDb.deadlockSchedule.findUniqueOrThrow({ where: { guildId: "saved-server" } })).revision).toBe(5);
  });

  it("rejects impossible warning and countdown settings without changing settings", async () => {
    const settings = new ObjectiveSettings(testDb, sounds);
    const original = await settings.list("server");
    const small = original[0]!;
    await expect(settings.save("server", { ...small, first: { ...small.first, warningSeconds: 120 } })).rejects.toThrow("before");
    await expect(settings.save("server", { ...small, recurring: { ...small.recurring, countdownSeconds: 90 } })).rejects.toThrow("countdown");
    expect(await settings.list("server")).toEqual(original);
  });

  it("reads earlier speech schedules as sounds while preserving saved timing preferences", async () => {
    await testDb.deadlockSchedule.create({ data: { guildId: "old-server", objectives: [{
      id: "small-camps", name: "Small camps", enabled: true, firstAt: 120, repeatEvery: 90,
      first: { announce: true, warningSeconds: 30, text: "Old speech", warningText: "Old warning" },
      recurring: { announce: false, warningSeconds: null, text: "Old repeat", warningText: "Old warning" },
    }] } });
    const settings = new ObjectiveSettings(testDb, sounds);
    expect((await settings.list("old-server"))[0]).toMatchObject({ spoken: false, firstAt: 120, repeatEvery: 90, first: { announce: true, warningSeconds: 30, countdownSeconds: null }, recurring: { announce: false } });
    expect((await settings.prepare("old-server"))[0]!.first).toEqual({ due: { sound: "ding", path: "/audio/ding.ogg" }, warning: { sound: "beep", path: "/audio/beep.ogg" } });
    await settings.edit("old-server", "small-camps", (objective) => ({ ...objective, first: { ...objective.first, countdownSeconds: 5 } }));
    expect((await new ObjectiveSettings(testDb, sounds).list("old-server"))[0]!.first.countdownSeconds).toBe(5);
  });
});
