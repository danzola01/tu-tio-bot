import { describe, expect, it } from "vitest";
import { StatsService } from "../../../src/services/statsService.js";
import { MatchService } from "../../../src/services/matchService.js";
import { testDb } from "../../setup.js";

describe("StatsService integration", () => {
  const statsService = new StatsService(testDb);
  const matchService = new MatchService(testDb);

  it("calculates stats correctly for multiple matches", async () => {
    const guildId = "guild-stats-1";
    
    // Add 2 wins and 1 loss
    await matchService.addMatch({
      guildId,
      reportedByUserId: "user-1",
      mode: "ESCORT",
      map: "Dorado",
      result: "WIN",
      players: [{ userId: "user-1" }]
    });
    await matchService.addMatch({
      guildId,
      reportedByUserId: "user-1",
      mode: "ESCORT",
      map: "Route 66",
      result: "WIN",
      players: [{ userId: "user-1" }]
    });
    await matchService.addMatch({
      guildId,
      reportedByUserId: "user-1",
      mode: "ESCORT",
      map: "Dorado",
      result: "LOSS",
      players: [{ userId: "user-1" }]
    });

    const stats = await statsService.getStats({ guildId });

    expect(stats.total).toBe(3);
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(1);
    expect(stats.winRate).toBeCloseTo(66.6667, 3);
  });

  it("filters stats by mode", async () => {
    const guildId = "guild-stats-2";
    
    // ESCORT win
    await matchService.addMatch({
      guildId,
      reportedByUserId: "user-1",
      mode: "ESCORT",
      map: "Dorado",
      result: "WIN",
      players: [{ userId: "user-1" }]
    });
    // CONTROL loss
    await matchService.addMatch({
      guildId,
      reportedByUserId: "user-1",
      mode: "CONTROL",
      map: "Busan",
      result: "LOSS",
      players: [{ userId: "user-1" }]
    });

    const escortStats = await statsService.getStats({ guildId, mode: "ESCORT" });
    expect(escortStats.total).toBe(1);
    expect(escortStats.wins).toBe(1);
    expect(escortStats.losses).toBe(0);

    const controlStats = await statsService.getStats({ guildId, mode: "CONTROL" });
    expect(controlStats.total).toBe(1);
    expect(controlStats.wins).toBe(0);
    expect(controlStats.losses).toBe(1);
  });

  it("filters stats by map", async () => {
    const guildId = "guild-stats-3";
    
    await matchService.addMatch({
      guildId,
      reportedByUserId: "user-1",
      mode: "ESCORT",
      map: "Dorado",
      result: "WIN",
      players: [{ userId: "user-1" }]
    });
    await matchService.addMatch({
      guildId,
      reportedByUserId: "user-1",
      mode: "ESCORT",
      map: "Route 66",
      result: "LOSS",
      players: [{ userId: "user-1" }]
    });

    const doradoStats = await statsService.getStats({ guildId, map: "Dorado" });
    expect(doradoStats.total).toBe(1);
    expect(doradoStats.wins).toBe(1);
    
    const route66Stats = await statsService.getStats({ guildId, map: "Route 66" });
    expect(route66Stats.total).toBe(1);
    expect(route66Stats.losses).toBe(1);
  });

  it("handles match draws correctly", async () => {
    const guildId = "guild-stats-4";
    
    // Add 1 win, 1 loss, 1 draw
    await matchService.addMatch({
      guildId,
      reportedByUserId: "user-1",
      mode: "ESCORT",
      map: "Dorado",
      result: "WIN",
      players: [{ userId: "user-1" }]
    });
    await matchService.addMatch({
      guildId,
      reportedByUserId: "user-1",
      mode: "ESCORT",
      map: "Dorado",
      result: "LOSS",
      players: [{ userId: "user-1" }]
    });
    await matchService.addMatch({
      guildId,
      reportedByUserId: "user-1",
      mode: "ESCORT",
      map: "Dorado",
      result: "DRAW",
      players: [{ userId: "user-1" }]
    });

    const stats = await statsService.getStats({ guildId });

    expect(stats.total).toBe(3);
    expect(stats.wins).toBe(1);
    expect(stats.losses).toBe(1);
    expect(stats.draws).toBe(1);
    expect(stats.winRate).toBeCloseTo(33.3333, 3);
  });
});
