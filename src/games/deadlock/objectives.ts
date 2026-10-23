import { z } from "zod";
import type { Objective } from "./types.js";

const phrase = z.string().trim().min(1).max(180)
  .refine((text) => !/[\u0000-\u001f\u007f]/.test(text), "Callouts cannot contain control characters")
  .refine((text) => !/[{}]/.test(text.replaceAll("{name}", "").replaceAll("{seconds}", "")), "Only {name} and {seconds} placeholders are supported");

const calloutSchema = z.strictObject({
  announce: z.boolean(), warningSeconds: z.number().int().min(1).max(86400).nullable(),
  text: phrase, warningText: phrase,
});

export const objectiveSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,47}$/),
  name: z.string().trim().min(1).max(48).regex(/^[^{}\u0000-\u001f\u007f]+$/), enabled: z.boolean(),
  firstAt: z.number().int().min(1).max(86400),
  repeatEvery: z.number().int().min(1).max(86400).nullable(),
  first: calloutSchema, recurring: calloutSchema,
}).superRefine((objective, context) => {
  if (objective.first.warningSeconds !== null && objective.first.warningSeconds >= objective.firstAt) {
    context.addIssue({ code: "custom", path: ["first", "warningSeconds"], message: "The first warning must occur before the objective and after match start" });
  }
  if (objective.repeatEvery !== null && objective.recurring.warningSeconds !== null && objective.recurring.warningSeconds >= objective.repeatEvery) {
    context.addIssue({ code: "custom", path: ["recurring", "warningSeconds"], message: "A recurring warning must occur before its reminder and within the repeat interval" });
  }
});

export function createObjective(id: string, name: string, firstAt: number, repeatEvery: number | null = null): Objective {
  return {
    id, name, enabled: true, firstAt, repeatEvery,
    first: { announce: true, warningSeconds: firstAt > 1 ? Math.min(30, firstAt - 1) : null, text: "{name} are available.", warningText: "{name} in {seconds} seconds." },
    recurring: { announce: true, warningSeconds: null, text: "Check {name}.", warningText: "Check {name} in {seconds} seconds." },
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

export function renderCallout(template: string, objective: Objective, seconds: number | null): string {
  return template.replaceAll("{name}", objective.name).replaceAll("{seconds}", String(seconds ?? 0));
}
