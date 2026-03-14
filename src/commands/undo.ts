import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { logger } from "../infra/logger.js";
import type { Services } from "../index.js";

export const data = new SlashCommandBuilder()
  .setName("undo")
  .setDescription("Undo the most recent match you reported in this server");

export async function execute(interaction: ChatInputCommandInteraction, services: Services) {
  await interaction.deferReply();

  try {
    const recentMatch = await services.match.getLatestMatch(interaction.guildId!, interaction.user.id);

    if (!recentMatch) {
      await interaction.editReply("❌ I couldn't find any recent matches reported by you to undo.");
      return;
    }

    await services.match.softDeleteMatch(recentMatch.id);

    await interaction.editReply(`⏪ Successfully undid the match on **${recentMatch.map}** (${recentMatch.mode}) where you recorded a **${recentMatch.result}**.`);
  } catch (error) {
    logger.error(error, "Failed to undo match");
    await interaction.editReply("❌ An error occurred while trying to undo the match.");
  }
}
