import type { AutocompleteInteraction, ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../bot/types.js";
import type { MatchService } from "./services/matchService.js";
import type { StatsService } from "./services/statsService.js";

export interface OverwatchServices {
  match: MatchService;
  stats: StatsService;
}

export interface OverwatchCommand {
  data: Command["data"];
  execute(interaction: ChatInputCommandInteraction, services: OverwatchServices): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction, services: OverwatchServices): Promise<void>;
}
