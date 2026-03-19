import { describe, expect, it, beforeAll } from "vitest";
import { MatchService } from "../../../src/services/matchService.js";
import { testDb } from "../../setup.js";

describe("MatchService integration", () => {
  const matchService = new MatchService(testDb);

  it("adds a match successfully", async () => {
    const input = {
      guildId: "guild-1",
      reportedByUserId: "user-1",
      mode: "ESCORT",
      map: "Dorado",
      result: "WIN",
      players: [{ userId: "user-1" }]
    };

    const match = await matchService.addMatch(input);

    expect(match).toBeDefined();
    expect(match.id).toBeTypeOf("string");
    expect(match.guildId).toBe(input.guildId);
    expect(match.mode).toBe(input.mode);
    expect(match.map).toBe(input.map);
    expect(match.result).toBe(input.result);
  });

  it("returns most used maps correctly", async () => {
    const guildId = "guild-maps";
    const add = (map: string) => matchService.addMatch({
      guildId,
      reportedByUserId: "user-1",
      mode: "ESCORT",
      map,
      result: "WIN",
      players: [{ userId: "user-1" }]
    });

    await add("Dorado");
    await add("Dorado");
    await add("Circuit Royal");
    await add("Rialto");
    await add("Rialto");
    await add("Rialto");

    const mostUsed = await matchService.getMostUsedMaps(guildId);
    expect(mostUsed).toEqual(["Rialto", "Dorado", "Circuit Royal"]);
  });

  it("returns most used heroes correctly", async () => {
    const guildId = "guild-heroes";
    const userId = "user-hero";
    const add = (hero: string) => matchService.addMatch({
      guildId,
      reportedByUserId: userId,
      mode: "ESCORT",
      map: "Dorado",
      result: "WIN",
      players: [{ userId, hero }]
    });

    await add("Ana");
    await add("Ana");
    await add("Kiriko");
    await add("Kiriko");
    await add("Kiriko");
    await add("Mercy");

    const mostUsed = await matchService.getMostUsedHeroes(guildId, userId);
    expect(mostUsed).toEqual(["Kiriko", "Ana", "Mercy"]);
  });
});
