import { describe, expect, it } from "vitest";
import { isMapValidForMode, GameMode } from "../../../src/services/mapService.js";

describe("mapService", () => {
  describe("isMapValidForMode", () => {
    it("returns true for a valid map-mode combination", () => {
      expect(isMapValidForMode("ESCORT", "Dorado")).toBe(true);
      expect(isMapValidForMode("CONTROL", "Ilios")).toBe(true);
    });

    it("returns false for an invalid map-mode combination", () => {
      expect(isMapValidForMode("CONTROL", "Dorado")).toBe(false);
      expect(isMapValidForMode("ESCORT", "Busan")).toBe(false);
    });

    it("returns false for a non-existent map", () => {
      // @ts-expect-error - testing invalid input
      expect(isMapValidForMode("ESCORT", "Non-existent Map")).toBe(false);
    });
  });
});
