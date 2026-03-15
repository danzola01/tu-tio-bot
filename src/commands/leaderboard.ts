import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { logger } from "../infra/logger.js";
import type { Services } from "../types.js";
import { Result } from "../services/mapService.js";

export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("View the server winrate leaderboard");

export async function execute(interaction: ChatInputCommandInteraction, services: Services) {
  await interaction.deferReply();

  try {
    const MIN_MATCHES = 5;
    const leaderboard = await services.stats.getLeaderboard(interaction.guildId!, MIN_MATCHES);

    if (leaderboard.length === 0) {
      await interaction.editReply(`No players have reached the minimum of ${MIN_MATCHES} matches yet to be on the leaderboard!`);
      return;
    }

    const leaderboardWithStreaks = await Promise.all(leaderboard.map(async (u) => {
      const streak = await services.stats.getUserStreak(interaction.guildId!, u.userId);
      return { ...u, streak };
    }));

    let message = `🏆 **Server Leaderboard** (Min. ${MIN_MATCHES} matches)\n\n`;
    
    leaderboardWithStreaks.forEach((user, index) => {
      let medal = "";
      if (index === 0) medal = "🥇 ";
      else if (index === 1) medal = "🥈 ";
      else if (index === 2) medal = "🥉 ";
      else medal = `${index + 1}. `;

      let streakStr = "";
      if (user.streak && user.streak.count >= 2) {
        if (user.streak.type === Result.WIN) streakStr = ` 🔥 ${user.streak.count}W`;
        else if (user.streak.type === Result.LOSS) streakStr = ` 🧊 ${user.streak.count}L`;
      }

      message += `${medal}<@${user.userId}>: **${user.winRate.toFixed(1)}%** (${user.wins}W - ${user.losses}L - ${user.draws}D)${streakStr}\n`;
    });

    await interaction.editReply(message);
  } catch (error) {
    logger.error(error, "Failed to fetch leaderboard");
    await interaction.editReply("❌ An error occurred while fetching the leaderboard.");
  }
}
