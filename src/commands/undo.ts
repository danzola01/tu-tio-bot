import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { db } from "../infra/db.js";
import pino from "pino";

const logger = pino({
  transport: {
    target: "pino-pretty",
  },
});

export const data = new SlashCommandBuilder()
  .setName("undo")
  .setDescription("Undo the most recent match you reported in this server");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const recentMatch = await db.match.findFirst({
      where: {
        guildId: interaction.guildId!,
        reportedByUserId: interaction.user.id,
        deletedAt: null,
      },
      orderBy: {
        playedAt: 'desc',
      },
    });

    if (!recentMatch) {
      await interaction.editReply("❌ I couldn't find any recent matches reported by you to undo.");
      return;
    }

    await db.match.update({
      where: { id: recentMatch.id },
      data: { deletedAt: new Date() },
    });

    await interaction.editReply(`⏪ Successfully undid the match on **${recentMatch.map}** (${recentMatch.mode}) where you recorded a **${recentMatch.result}**.`);
  } catch (error) {
    logger.error(error, "Failed to undo match");
    await interaction.editReply("❌ An error occurred while trying to undo the match.");
  }
}