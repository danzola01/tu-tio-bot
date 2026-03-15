import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { logger } from "../infra/logger.js";
import type { Services } from "../types.js";

export const data = new SlashCommandBuilder()
  .setName("insights")
  .setDescription("Get personalized Overwatch insights and recommendations")
  .addUserOption(option => option.setName("user").setDescription("The user to get insights for").setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction, services: Services) {
  await interaction.deferReply();

  try {
    const optionUser = interaction.options.getUser("user");
    const targetUser = optionUser && !optionUser.bot ? optionUser : interaction.user;

    const mapStats = await services.stats.getMapStats(interaction.guildId!, targetUser.id);
    const teammateStats = await services.stats.getTeammateStats(interaction.guildId!, targetUser.id);
    const overall = await services.stats.getStats({ guildId: interaction.guildId!, userId: targetUser.id });

    if (overall.total < 5) {
      await interaction.editReply(`❌ <@${targetUser.id}> needs to play at least 5 matches to generate insights.`);
      return;
    }

    // Best and Worst Map (min 3 matches)
    const qualifyingMaps = mapStats.filter(m => m.total >= 3).sort((a, b) => b.winRate - a.winRate);
    
    let bestMap = qualifyingMaps[0];
    let worstMap = qualifyingMaps.length > 1 ? qualifyingMaps[qualifyingMaps.length - 1] : undefined;

    // Best Teammate (min 3 matches)
    const qualifyingTeammates = teammateStats.filter(t => t.total >= 3).sort((a, b) => b.winRate - a.winRate);
    let bestTeammate = qualifyingTeammates[0];

    let message = `🧠 **Personalized Insights for <@${targetUser.id}>**\n\n`;
    message += `**Overall Winrate:** ${overall.wins}W - ${overall.losses}L (${overall.winRate.toFixed(1)}%)\n\n`;

    if (bestMap) {
      message += `🗺️ **Best Map:** **${bestMap.map}** with a ${bestMap.winRate.toFixed(1)}% WR. You dominate here!\n`;
    }
    if (worstMap && worstMap.map !== bestMap?.map) {
      message += `🏚️ **Worst Map:** **${worstMap.map}** with a ${worstMap.winRate.toFixed(1)}% WR. Avoid at all costs.\n`;
    }
    if (bestTeammate) {
      const wrDiff = bestTeammate.winRate - overall.winRate;
      message += `🤝 **The Carry:** When playing with <@${bestTeammate.userId}>, your winrate is ${bestTeammate.winRate.toFixed(1)}% `;
      if (wrDiff > 0) message += `(+${wrDiff.toFixed(1)}% above average). Play more with them!`;
      else message += `(which is still your best duo).`;
      message += `\n`;
    }

    if (!bestMap && !bestTeammate) {
      message += `*Play a few more matches on the same maps or with the same teammates to unlock deeper insights!* (Requires 3+ matches per map/teammate)`;
    }

    await interaction.editReply(message);
  } catch (error) {
    logger.error(error, "Failed to fetch insights");
    await interaction.editReply("❌ An error occurred while generating insights.");
  }
}
