import { describe, expect, it } from "vitest";
import { Role, HeroesByRole, AllHeroes, getRoleForHero } from "../../../src/services/heroService.js";

describe("heroService", () => {
  describe("Role", () => {
    it("has keys equal to values (enum-like pattern)", () => {
      for (const key of Object.keys(Role)) {
        expect(Role[key as keyof typeof Role]).toBe(key);
      }
    });

    it("defines TANK, DAMAGE, and SUPPORT roles", () => {
      expect(Role.TANK).toBe("TANK");
      expect(Role.DAMAGE).toBe("DAMAGE");
      expect(Role.SUPPORT).toBe("SUPPORT");
    });
  });

  describe("HeroesByRole", () => {
    it("has an entry for every role", () => {
      for (const role of Object.keys(Role) as (keyof typeof Role)[]) {
        expect(HeroesByRole[role]).toBeDefined();
        expect(HeroesByRole[role].length).toBeGreaterThan(0);
      }
    });

    it("lists known tank heroes", () => {
      expect(HeroesByRole.TANK).toContain("Reinhardt");
      expect(HeroesByRole.TANK).toContain("D.Va");
      expect(HeroesByRole.TANK).toContain("Zarya");
    });

    it("lists known damage heroes", () => {
      expect(HeroesByRole.DAMAGE).toContain("Genji");
      expect(HeroesByRole.DAMAGE).toContain("Tracer");
      expect(HeroesByRole.DAMAGE).toContain("Widowmaker");
    });

    it("lists known support heroes", () => {
      expect(HeroesByRole.SUPPORT).toContain("Ana");
      expect(HeroesByRole.SUPPORT).toContain("Mercy");
      expect(HeroesByRole.SUPPORT).toContain("Lúcio");
    });
  });

  describe("AllHeroes", () => {
    it("contains all heroes from every role", () => {
      const total = Object.values(HeroesByRole).reduce((sum, heroes) => sum + heroes.length, 0);
      expect(AllHeroes.length).toBe(total);
    });

    it("is sorted alphabetically", () => {
      const sorted = [...AllHeroes].sort();
      expect(AllHeroes).toEqual(sorted);
    });

    it("contains known heroes from multiple roles", () => {
      expect(AllHeroes).toContain("Reinhardt");
      expect(AllHeroes).toContain("Genji");
      expect(AllHeroes).toContain("Ana");
    });
  });

  describe("getRoleForHero", () => {
    it("returns the correct role for a tank hero", () => {
      expect(getRoleForHero("Reinhardt")).toBe("TANK");
      expect(getRoleForHero("D.Va")).toBe("TANK");
    });

    it("returns the correct role for a damage hero", () => {
      expect(getRoleForHero("Genji")).toBe("DAMAGE");
      expect(getRoleForHero("Tracer")).toBe("DAMAGE");
    });

    it("returns the correct role for a support hero", () => {
      expect(getRoleForHero("Ana")).toBe("SUPPORT");
      expect(getRoleForHero("Mercy")).toBe("SUPPORT");
    });

    it("returns undefined for an unknown hero", () => {
      expect(getRoleForHero("Unknown Hero")).toBeUndefined();
    });
  });
});
