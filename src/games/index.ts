import type { GameModule } from "../bot/types.js";
import type { DbClient } from "../infra/db.js";
import { createOverwatchModule } from "./overwatch/index.js";
import { createDeadlockModule, type DeadlockOptions } from "./deadlock/index.js";

// Add each game's factory here. Runtime and slash-command deployment share this catalog.
export function createGameModules(db: DbClient, options: { deadlock?: DeadlockOptions } = {}): readonly GameModule[] {
  return [createOverwatchModule(db), createDeadlockModule(db, options.deadlock)];
}
