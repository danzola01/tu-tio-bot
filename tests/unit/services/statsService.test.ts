import { describe, expect, it } from "vitest";
import { calculateWinRate } from "../../../src/services/statsService.js";

describe("statsService", () => {
  describe("calculateWinRate", () => {
    it("returns 0 when there are no matches", () => {
      expect(calculateWinRate(0, 0, 0)).toBe(0);
    });

    it("returns 100 for all wins", () => {
      expect(calculateWinRate(5, 0, 0)).toBe(100);
    });

    it("returns 0 for all losses", () => {
      expect(calculateWinRate(0, 3, 0)).toBe(0);
    });

    it("returns the correct percentage for mixed results", () => {
      expect(calculateWinRate(1, 1, 0)).toBe(50);
      expect(calculateWinRate(2, 1, 0)).toBeCloseTo(66.6667, 3);
      expect(calculateWinRate(3, 1, 0)).toBe(75);
    });

    it("includes draws in the total", () => {
      expect(calculateWinRate(1, 1, 1)).toBeCloseTo(33.3333, 3);
      expect(calculateWinRate(2, 0, 2)).toBe(50);
    });
  });
});

