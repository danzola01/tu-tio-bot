import { MessageFlags, type Interaction, type InteractionReplyOptions } from "discord.js";
import { logger } from "../infra/logger.js";
import type { createCommandRegistry } from "./registry.js";

export function createInteractionHandler(registry: ReturnType<typeof createCommandRegistry>) {
  return async (interaction: Interaction): Promise<void> => {
    if (!interaction.isChatInputCommand() && !interaction.isAutocomplete()) return;

    try {
      if (!interaction.inGuild()) {
        if (interaction.isAutocomplete()) await interaction.respond([]);
        else await interaction.reply({ content: "Use this command in the server.", flags: MessageFlags.Ephemeral });
        return;
      }

      const command = registry.get(interaction.commandName);
      if (!command) {
        if (interaction.isAutocomplete()) await interaction.respond([]);
        else await interaction.reply({ content: "This command is no longer available.", flags: MessageFlags.Ephemeral });
        return;
      }

      if (interaction.isAutocomplete()) {
        if (command.autocomplete) await command.autocomplete(interaction);
        else await interaction.respond([]);
      } else {
        await command.execute(interaction);
      }
    } catch (error) {
      logger.error({ err: error, command: interaction.commandName }, "Interaction failed");
      if (interaction.isAutocomplete()) return;

      const response = { content: "There was an error while executing this command!", flags: MessageFlags.Ephemeral } satisfies InteractionReplyOptions;
      try {
        if (interaction.replied || interaction.deferred) await interaction.followUp(response);
        else await interaction.reply(response);
      } catch (replyError) {
        logger.error({ err: replyError }, "Could not report the command error to Discord");
      }
    }
  };
}
