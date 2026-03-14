import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { db } from "../infra/db.js";
import { Result } from "../services/mapService.js";
import pino from "pino";

const logger = pino({
  transport: {
    target: "pino-pretty",
  },
});

export const data = new SlashCommandBuilder()
  .setName("session")
  .setDescription("View your match statistics for the last 24 hours")
  .addUserOption(option => option.setName("user").setDescription("View session for a specific player").setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const targetUser = interaction.options.getUser("user") || interaction.user;
    
    // Calculate timestamp for 12 hours ago using a millisecond offset to avoid DST issues
    const twelveHoursMs = 12 * 60 * 60 * 1000;
    const sessionStartTime = new Date(Date.now() - twelveHoursMs);

    const matches = await db.match.findMany({
      where: {
        guildId: interaction.guildId!,
        deletedAt: null,
        playedAt: {
          gte: sessionStartTime,
        },
        players: {
          some: {
            userId: targetUser.id
          }
        }
      },
      orderBy: {
        playedAt: "desc" // latest first
      }
    });

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

    const totalResultMatches = wins + losses;
    const remainingMatches = totalResultMatches - displayedMatches;
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
