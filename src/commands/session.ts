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
    
    // Calculate timestamp for 12 hours ago (typically a "session" is a single evening)
    const sessionStartTime = new Date();
    sessionStartTime.setHours(sessionStartTime.getHours() - 12);

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
    let matchHistory = "";

    for (const match of matches) {
      if (match.result === Result.WIN) {
        wins++;
        matchHistory += `🟢 **WIN** on ${match.map} (${match.mode})\n`;
      } else if (match.result === Result.LOSS) {
        losses++;
        matchHistory += `🔴 **LOSS** on ${match.map} (${match.mode})\n`;
      }
    }

    const total = wins + losses;
    const winrate = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";

    const netResult = wins - losses;
    let summaryEmoji = "⚖️";
    if (netResult > 0) summaryEmoji = "📈";
    if (netResult < 0) summaryEmoji = "📉";

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
