import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { counterGuides, counterHeroChoices, findCounterGuide } from "../../../../src/games/deadlock/counters/guides.js";
import { counterGuideMessage, counterGuidePageCount } from "../../../../src/games/deadlock/counters/messages.js";
import { counterItems } from "../../../../src/games/deadlock/counters/items.js";

describe("curated Deadlock counter guides", () => {
  it.each([
    ["gray talon", "Grey Talon"], ["Holiday", "Holliday"], ["MO & KRILL", "Mo & Krill"],
    ["mo-and-krill", "Mo & Krill"], ["Viper", "Vyper"], ["Doorman", "The Doorman"],
  ])("resolves %s to %s", (query, hero) => expect(findCounterGuide(query)?.hero).toBe(hero));

  it("does not invent coverage or exceed Discord's autocomplete limit", () => {
    expect(findCounterGuide("not a hero")).toBeUndefined();
    expect(counterHeroChoices("not a hero")).toEqual([]);
    expect(counterHeroChoices("").length).toBeLessThanOrEqual(25);
    expect(new Set(counterGuides.map((guide) => guide.id)).size).toBe(counterGuides.length);
    expect(new Set(counterGuides.flatMap((guide) => guide.recommendations.map((entry) => entry.item))))
      .toEqual(new Set(Object.keys(counterItems)));
  });

  it("renders all recommendations within Discord limits with matching bundled PNGs", () => {
    for (const guide of counterGuides) {
      const rendered: string[] = [];
      for (let page = 0; page < counterGuidePageCount(guide); page++) {
        const payload = counterGuideMessage(guide, page);
        const embeds = payload.embeds.map((embed) => embed.toJSON());
        expect(embeds.length).toBeLessThanOrEqual(10);
        let total = 0;
        for (const embed of embeds) {
          expect((embed.title ?? "").length).toBeLessThanOrEqual(256);
          expect((embed.description ?? "").length).toBeLessThanOrEqual(4096);
          expect((embed.fields ?? []).length).toBeLessThanOrEqual(25);
          total += (embed.title ?? "").length + (embed.description ?? "").length + (embed.footer?.text ?? "").length;
          for (const field of embed.fields ?? []) {
            expect(field.name.length).toBeLessThanOrEqual(256);
            expect(field.value.length).toBeLessThanOrEqual(1024);
            total += field.name.length + field.value.length;
          }
        }
        expect(total).toBeLessThanOrEqual(6000);
        expect(embeds[0]!.footer?.text).toContain("Patch unverified");
        for (const [index, file] of payload.files.entries()) {
          const bytes = readFileSync(String(file.attachment));
          expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
          expect(embeds[index + 1]!.thumbnail?.url).toBe(`attachment://${file.name}`);
        }
        rendered.push(...embeds.slice(1).map((embed) => embed.title!));
        for (const row of payload.components) {
          for (const button of row.toJSON().components) {
            if (!("custom_id" in button)) throw new Error("Expected a guide navigation button");
            const destination = Number(button.custom_id!.split(":").at(-1));
            expect(destination).toBeGreaterThanOrEqual(0);
            expect(destination).toBeLessThan(counterGuidePageCount(guide));
          }
        }
      }
      expect(rendered).toEqual(guide.recommendations.map((entry) => counterItems[entry.item].name));
    }
  });

  it("retains matchup qualifications and never invents a reviewed patch", () => {
    expect(findCounterGuide("Abrams")!.warning).toContain("separate stun instances");
    expect(findCounterGuide("Dynamo")!.warning).toContain("Indomitable does not work");
    expect(findCounterGuide("The Doorman")!.warning).toContain("Slowing Hex does not stop");
    expect(findCounterGuide("Kelvin")!.recommendations.find((entry) => entry.item === "slowing-hex")!.when).toContain("before");
    const guide = findCounterGuide("Pocket")!;
    const reviewed = counterGuideMessage({ ...guide, reviewedPatch: "Example patch" });
    expect(reviewed.embeds[0]!.toJSON().footer?.text).toContain("Reviewed for: Example patch. Not reviewed for later updates.");
    expect(() => counterGuideMessage(guide, 999)).toThrow(RangeError);
  });
});
