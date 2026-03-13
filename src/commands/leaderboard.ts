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
    const MIN_MATCHES = 5;

    // Aggregate stats per user in the database
    const rows = await db.$queryRaw<Array<{
      userId: string;
      wins: bigint | number;
      losses: bigint | number;
      total: bigint | number;
    }>>`
      SELECT
        mp."userId" AS "userId",
        SUM(CASE WHEN m.result = ${Result.WIN} THEN 1 ELSE 0 END) AS "wins",
        SUM(CASE WHEN m.result = ${Result.LOSS} THEN 1 ELSE 0 END) AS "losses",
        COUNT(*) AS "total"
      FROM "MatchPlayer" mp
      JOIN "Match" m ON m.id = mp."matchId"
      WHERE
        m."guildId" = ${interaction.guildId!}
        AND m."deletedAt" IS NULL
      GROUP BY mp."userId"
      HAVING COUNT(*) >= ${MIN_MATCHES}
    `;

    // Calculate winrates, sort, and take top 10
    const leaderboard = rows
      .map(row => {
        const wins = Number(row.wins);
        const losses = Number(row.losses);
        const total = Number(row.total);
        const winrate = total > 0 ? (wins / total) * 100 : 0;
        return { userId: row.userId, wins, losses, total, winrate };
      })
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
