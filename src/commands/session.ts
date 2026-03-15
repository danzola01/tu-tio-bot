import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Result } from "../services/mapService.js";
import { logger } from "../infra/logger.js";
import type { Services } from "../types.js";

export const data = new SlashCommandBuilder()
  .setName("session")
  .setDescription("View your match statistics for the last 12 hours")
  .addUserOption(option => option.setName("user").setDescription("View session for a specific player").setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction, services: Services) {
  await interaction.deferReply();

  try {
    const targetUser = interaction.options.getUser("user") || interaction.user;
    const matches = await services.stats.getSessionMatches(interaction.guildId!, targetUser.id, 12);

    if (matches.length === 0) {
      await interaction.editReply(`🌙 <@${targetUser.id}> hasn't played any matches in the last 12 hours. Time to queue up!`);
      return;
    }

    let wins = 0;
    let losses = 0;

    // First pass: compute overall stats for the full session window
    for (const match of matches) {
      if (match.result === Result.WIN) {
        wins++;
      } else if (match.result === Result.LOSS) {
        losses++;
      }
    }

    // Second pass: build match history with a character budget to avoid Discord's 2000-char limit
    const DISCORD_MESSAGE_LIMIT = 2000;
    const SUMMARY_OVERHEAD = 400; // conservative estimate for non-history text
    const MAX_HISTORY_LENGTH = DISCORD_MESSAGE_LIMIT - SUMMARY_OVERHEAD;

    let matchHistory = "";
    let displayedMatches = 0;

    for (const match of matches) {
      let line = "";
      if (match.result === Result.WIN) {
        line = `🟢 **WIN** on ${match.map} (${match.mode})\n`;
      } else if (match.result === Result.LOSS) {
        line = `🔴 **LOSS** on ${match.map} (${match.mode})\n`;
      } else {
        continue;
      }

      if (matchHistory.length + line.length > MAX_HISTORY_LENGTH) {
        break;
      }

      matchHistory += line;
      displayedMatches++;
    }

    const total = wins + losses;
    const winrate = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";

    const netResult = wins - losses;
    let summaryEmoji = "⚖️";
    if (netResult > 0) summaryEmoji = "📈";
    if (netResult < 0) summaryEmoji = "📉";

    const remainingMatches = total - displayedMatches;
    if (remainingMatches > 0) {
      matchHistory += `…and ${remainingMatches} more match${remainingMatches === 1 ? "" : "es"}.\n`;
    }

    let message = `🌙 **Tonight's Session for <@${targetUser.id}>**\n\n`;
    message += `**Summary:** ${wins}W - ${losses}L (${winrate}% WR) ${summaryEmoji}\n`;
    message += `**Net Games:** ${netResult > 0 ? '+' : ''}${netResult}\n\n`;
    message += `**Match History (Last 12 Hours):**\n${matchHistory}`;

    await interaction.editReply(message);
  } catch (error) {
    logger.error(error, "Failed to fetch session stats");
    await interaction.editReply("❌ An error occurred while fetching the session summary.");
  }
}
