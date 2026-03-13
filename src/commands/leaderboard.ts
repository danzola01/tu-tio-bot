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
  .setName("leaderboard")
  .setDescription("View the server winrate leaderboard");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    // Get all matches for this guild with their players
    const matches = await db.match.findMany({
      where: {
        guildId: interaction.guildId!,
        deletedAt: null,
      },
      include: {
        players: true,
      }
    });

    // Aggregate stats per user
    const userStats = new Map<string, { wins: number; losses: number }>();

    for (const match of matches) {
      for (const player of match.players) {
        const stats = userStats.get(player.userId) || { wins: 0, losses: 0 };
        if (match.result === Result.WIN) {
          stats.wins++;
        } else if (match.result === Result.LOSS) {
          stats.losses++;
        }
        userStats.set(player.userId, stats);
      }
    }

    const MIN_MATCHES = 5;

    // Calculate winrates, filter, and sort
    const leaderboard = Array.from(userStats.entries())
      .map(([userId, stats]) => {
        const total = stats.wins + stats.losses;
        const winrate = total > 0 ? (stats.wins / total) * 100 : 0;
        return { userId, ...stats, total, winrate };
      })
      .filter(u => u.total >= MIN_MATCHES)
      .sort((a, b) => {
        // Sort by winrate descending, then by total matches descending
        if (b.winrate !== a.winrate) return b.winrate - a.winrate;
        return b.total - a.total;
      })
      .slice(0, 10); // Top 10

    if (leaderboard.length === 0) {
      await interaction.editReply(`No players have reached the minimum of ${MIN_MATCHES} matches yet to be on the leaderboard!`);
      return;
    }

    let message = `🏆 **Server Leaderboard** (Min. ${MIN_MATCHES} matches)\n\n`;
    
    leaderboard.forEach((user, index) => {
      let medal = "";
      if (index === 0) medal = "🥇 ";
      else if (index === 1) medal = "🥈 ";
      else if (index === 2) medal = "🥉 ";
      else medal = `${index + 1}. `;

      message += `${medal}<@${user.userId}>: **${user.winrate.toFixed(1)}%** (${user.wins}W - ${user.losses}L)\n`;
    });

    await interaction.editReply(message);
  } catch (error) {
    logger.error(error, "Failed to fetch leaderboard");
    await interaction.editReply("❌ An error occurred while fetching the leaderboard.");
  }
}
