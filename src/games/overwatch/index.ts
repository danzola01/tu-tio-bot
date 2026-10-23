import { GatewayIntentBits } from "discord.js";
import type { Command, GameModule } from "../../bot/types.js";
import type { DbClient } from "../../infra/db.js";
import * as match from "./commands/match.js";
import * as stats from "./commands/stats.js";
import * as leaderboard from "./commands/leaderboard.js";
import * as undo from "./commands/undo.js";
import * as insights from "./commands/insights.js";
import * as session from "./commands/session.js";
import { MatchService } from "./services/matchService.js";
import { StatsService } from "./services/statsService.js";
import type { OverwatchCommand, OverwatchServices } from "./types.js";

export function createOverwatchModule(db: DbClient): GameModule {
  const services: OverwatchServices = {
    match: new MatchService(db),
    stats: new StatsService(db),
  };
  const definitions: readonly OverwatchCommand[] = [match, stats, leaderboard, undo, insights, session];

  return {
    id: "overwatch",
    intents: [GatewayIntentBits.GuildMembers],
    commands: definitions.map((definition): Command => {
      const autocomplete = definition.autocomplete;
      return {
        data: definition.data,
        execute: (interaction) => definition.execute(interaction, services),
        ...(autocomplete ? { autocomplete: (interaction) => autocomplete(interaction, services) } : {}),
      };
    }),
  };
}
