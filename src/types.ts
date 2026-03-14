import type { 
  ChatInputCommandInteraction, 
  AutocompleteInteraction, 
  StringSelectMenuInteraction, 
  UserSelectMenuInteraction, 
  ButtonInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder
} from "discord.js";
import type { MatchService } from "./services/matchService.js";
import type { StatsService } from "./services/statsService.js";
import type { FlowService } from "./services/flowService.js";

export interface Services {
  match: MatchService;
  stats: StatsService;
  flow: FlowService;
}

export type AnyInteraction = 
  | ChatInputCommandInteraction 
  | StringSelectMenuInteraction 
  | UserSelectMenuInteraction 
  | ButtonInteraction;

export interface Command {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction, services: Services) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
  handleComponent?: (interaction: AnyInteraction, services: Services) => Promise<void>;
}
