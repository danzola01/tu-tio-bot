import { DeadlockError } from "./errors.js";
import type { DbClient } from "../../infra/db.js";
import { defaultObjectives, objectiveSchema } from "./objectives.js";
import type { Objective, PreparedCallouts, PreparedObjective, SoundLibrary } from "./types.js";

export class ObjectiveSettings {
  constructor(private readonly db: DbClient, private readonly sounds: SoundLibrary) {}

  private async read(guildId: string) {
    const row = await this.db.deadlockSchedule.upsert({
      where: { guildId }, update: {},
      create: { guildId, objectives: objectiveSchema.array().parse(defaultObjectives()) },
    });
    return { revision: row.revision, objectives: objectiveSchema.array().parse(row.objectives) };
  }

  async list(guildId: string): Promise<Objective[]> {
    return (await this.read(guildId)).objectives;
  }

  async save(guildId: string, input: Objective): Promise<void> {
    const objective = objectiveSchema.parse(input);
    const state = await this.read(guildId);
    const index = state.objectives.findIndex((item) => item.id === objective.id);
    if (index < 0) state.objectives.push(objective);
    else state.objectives[index] = objective;
    await this.write(guildId, state.revision, state.objectives);
  }

  async remove(guildId: string, id: string): Promise<void> {
    const state = await this.read(guildId);
    const objectives = state.objectives.filter((item) => item.id !== id);
    if (objectives.length === state.objectives.length) throw new DeadlockError("Objective not found");
    await this.write(guildId, state.revision, objectives);
  }

  async edit(guildId: string, id: string, update: (objective: Objective) => Objective): Promise<void> {
    const state = await this.read(guildId);
    const index = state.objectives.findIndex((objective) => objective.id === id);
    if (index < 0) throw new DeadlockError("Objective not found");
    state.objectives[index] = objectiveSchema.parse(update(state.objectives[index]!));
    await this.write(guildId, state.revision, state.objectives);
  }

  /** Sets every objective at once. Enabling skips objectives without a recorded voice and returns their names. */
  async setSpoken(guildId: string, spoken: boolean): Promise<string[]> {
    const state = await this.read(guildId);
    const skipped: string[] = [];
    for (const objective of state.objectives) {
      if (spoken && !objective.spoken) {
        try { await this.sounds.prepare("voice", objective.id); } catch (error) {
          if (!(error instanceof DeadlockError)) throw error;
          skipped.push(objective.name);
          continue;
        }
      }
      objective.spoken = spoken;
    }
    await this.write(guildId, state.revision, state.objectives);
    return skipped;
  }

  private async write(guildId: string, revision: number, input: readonly Objective[]) {
    const objectives = objectiveSchema.array().max(25).parse(input);
    await this.prepareObjectives(objectives);
    const saved = await this.db.deadlockSchedule.updateMany({ where: { guildId, revision }, data: { objectives, revision: { increment: 1 } } });
    if (saved.count !== 1) throw new DeadlockError("The schedule changed during this edit. Please retry.");
  }

  private async prepareObjectives(objectives: readonly Objective[]): Promise<PreparedObjective[]> {
    const result: PreparedObjective[] = [];
    for (const objective of objectives.filter((item) => item.enabled)) {
      const warning = () => objective.spoken ? this.sounds.prepare("voice", objective.id) : this.sounds.prepare("beep");
      const prepare = async (callout: Objective["first"]): Promise<PreparedCallouts> => ({
        ...(callout.announce ? { due: await this.sounds.prepare("ding") } : {}),
        ...(callout.warningSeconds !== null ? { warning: await warning() } : {}),
        ...(callout.countdownSeconds !== null ? { countdown: await this.sounds.prepare("beep") } : {}),
      });
      result.push({ objective, first: await prepare(objective.first), recurring: objective.repeatEvery !== null ? await prepare(objective.recurring) : {} });
    }
    return result;
  }

  async prepare(guildId: string): Promise<PreparedObjective[]> {
    return this.prepareObjectives(await this.list(guildId));
  }
}
