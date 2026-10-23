import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  GatewayIntentBits,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";

export interface Command {
  data: {
    readonly name: string;
    toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody;
  };
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
}

export interface GameModule {
  readonly id: string;
  readonly intents: readonly GatewayIntentBits[];
  readonly commands: readonly Command[];
}
