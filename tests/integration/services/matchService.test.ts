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
      playerIds: ["user-1"]
    };

    const match = await matchService.addMatch(input);

    expect(match).toBeDefined();
    expect(match.id).toBeTypeOf("string");
    expect(match.guildId).toBe(input.guildId);
    expect(match.mode).toBe(input.mode);
    expect(match.map).toBe(input.map);
    expect(match.result).toBe(input.result);
  });
});
