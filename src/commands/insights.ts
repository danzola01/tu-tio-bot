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
  .setName("insights")
  .setDescription("Get personalized Overwatch insights and recommendations")
  .addUserOption(option => option.setName("user").setDescription("The user to get insights for").setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const targetUser = interaction.options.getUser("user") || interaction.user;

    const matches = await db.match.findMany({
      where: {
        guildId: interaction.guildId!,
        deletedAt: null,
        players: {
          some: { userId: targetUser.id }
        }
      },
      select: {
        map: true,
        result: true,
        players: {
          select: {
            userId: true,
          },
        },
      },
      take: 200,
    });

    if (matches.length < 5) {
      await interaction.editReply(`❌ <@${targetUser.id}> needs to play at least 5 matches to generate insights.`);
      return;
    }

    const mapStats = new Map<string, { wins: number; losses: number }>();
    const teammateStats = new Map<string, { wins: number; losses: number }>();

    let totalWins = 0;
    let totalLosses = 0;

    for (const match of matches) {
      if (match.result === Result.WIN) totalWins++;
      else if (match.result === Result.LOSS) totalLosses++;

      // Map stats
      const map = mapStats.get(match.map) || { wins: 0, losses: 0 };
      if (match.result === Result.WIN) map.wins++;
      else if (match.result === Result.LOSS) map.losses++;
      mapStats.set(match.map, map);

      // Teammate stats
      for (const player of match.players) {
        if (player.userId === targetUser.id) continue;
        const teammate = teammateStats.get(player.userId) || { wins: 0, losses: 0 };
        if (match.result === Result.WIN) teammate.wins++;
        else if (match.result === Result.LOSS) teammate.losses++;
        teammateStats.set(player.userId, teammate);
      }
    }

    const totalMatches = totalWins + totalLosses;
    const overallWinrate = totalMatches > 0 ? (totalWins / totalMatches) * 100 : 0;

    // Best and Worst Map
    let bestMap = "";
    let bestMapWr = -1;
    let worstMap = "";
    let worstMapWr = 101;
    const qualifyingMaps: { map: string; wr: number }[] = [];

    for (const [map, stats] of mapStats.entries()) {
      const total = stats.wins + stats.losses;
      if (total >= 3) {
        const wr = (stats.wins / total) * 100;
        qualifyingMaps.push({ map, wr });
      }
    }

    if (qualifyingMaps.length > 0) {
      for (const { map, wr } of qualifyingMaps) {
        if (wr > bestMapWr) {
          bestMapWr = wr;
          bestMap = map;
        }
      }
    }

    if (qualifyingMaps.length > 1 && bestMap) {
      worstMapWr = 101;
      for (const { map, wr } of qualifyingMaps) {
        if (map !== bestMap && wr < worstMapWr) {
          worstMapWr = wr;
          worstMap = map;
        }
      }
    }

    // Best Teammate
    let bestTeammate = "";
    let bestTeammateWr = -1;

    for (const [userId, stats] of teammateStats.entries()) {
      const total = stats.wins + stats.losses;
      if (total >= 3) {
        const wr = (stats.wins / total) * 100;
        if (wr > bestTeammateWr) {
          bestTeammateWr = wr;
          bestTeammate = userId;
        }
      }
    }

    let message = `🧠 **Personalized Insights for <@${targetUser.id}>**\n\n`;
    message += `**Overall Winrate:** ${totalWins}W - ${totalLosses}L (${overallWinrate.toFixed(1)}%)\n\n`;

    if (bestMap) {
      message += `🗺️ **Best Map:** **${bestMap}** with a ${bestMapWr.toFixed(1)}% WR. You dominate here!\n`;
    }
    if (worstMap) {
      message += `🏚️ **Worst Map:** **${worstMap}** with a ${worstMapWr.toFixed(1)}% WR. Avoid at all costs.\n`;
    }
    if (bestTeammate) {
      const wrDiff = bestTeammateWr - overallWinrate;
      message += `🤝 **The Carry:** When playing with <@${bestTeammate}>, your winrate is ${bestTeammateWr.toFixed(1)}% `;
      if (wrDiff > 0) message += `(+${wrDiff.toFixed(1)}% above average). Play more with them!`;
      else message += `(which is still your best duo).`;
      message += `\n`;
    }

    if (!bestMap && !worstMap && !bestTeammate) {
      message += `*Play a few more matches on the same maps or with the same teammates to unlock deeper insights!* (Requires 3+ matches per map/teammate)`;
    }

    await interaction.editReply(message);
  } catch (error) {
    logger.error(error, "Failed to fetch insights");
    await interaction.editReply("❌ An error occurred while generating insights.");
  }
}
