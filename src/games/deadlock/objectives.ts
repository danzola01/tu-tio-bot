import { z } from "zod";
import type { Objective } from "./types.js";

const timingFields = {
  announce: z.boolean(), warningSeconds: z.number().int().min(1).max(86400).nullable(),
};
const calloutSchema = z.union([
  z.strictObject({ ...timingFields, countdownSeconds: z.number().int().min(1).max(30).nullable() }),
  // Read schedules saved by the earlier speech implementation without speaking them.
  z.strictObject({ ...timingFields, text: z.string(), warningText: z.string() })
    .transform(({ announce, warningSeconds }) => ({ announce, warningSeconds, countdownSeconds: null })),
]);

export const objectiveSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,47}$/),
  name: z.string().trim().min(1).max(48).regex(/^[^{}\u0000-\u001f\u007f]+$/), enabled: z.boolean(),
  // Schedules saved before spoken warnings existed keep their beeps.
  spoken: z.boolean().default(false),
  firstAt: z.number().int().min(1).max(86400),
  repeatEvery: z.number().int().min(1).max(86400).nullable(),
  first: calloutSchema, recurring: calloutSchema,
}).superRefine((objective, context) => {
  for (const [kind, callout, boundary] of [
    ["first", objective.first, objective.firstAt],
    ["recurring", objective.recurring, objective.repeatEvery],
  ] as const) {
    if (boundary === null) continue;
    if (callout.warningSeconds !== null && callout.warningSeconds >= boundary) {
      context.addIssue({ code: "custom", path: [kind, "warningSeconds"], message: "A warning must occur before its reminder and within its time interval" });
    }
    if (callout.countdownSeconds !== null && callout.countdownSeconds >= boundary) {
      context.addIssue({ code: "custom", path: [kind, "countdownSeconds"], message: "A countdown must fit before its reminder and within its time interval" });
    }
  }
});

/** Stable ID derived from a display name; it also names the objective's voice clip. */
export function objectiveId(name: string) {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function createObjective(id: string, name: string, firstAt: number, repeatEvery: number | null = null): Objective {
  return {
    id, name, enabled: true, spoken: false, firstAt, repeatEvery,
    first: { announce: true, warningSeconds: firstAt > 1 ? Math.min(30, firstAt - 1) : null, countdownSeconds: firstAt > 1 ? Math.min(5, firstAt - 1) : null },
    recurring: { announce: true, warningSeconds: null, countdownSeconds: null },
  };
}

export function defaultObjectives(): Objective[] {
  return [
    createObjective("small-camps", "Small camps", 120, 90),
    createObjective("medium-camps", "Medium camps", 300),
    createObjective("large-camps", "Large camps", 480),
    createObjective("bridge-buffs", "Bridge buffs", 300, 300),
    createObjective("sinners", "Sinners", 480, 300),
  ];
}
