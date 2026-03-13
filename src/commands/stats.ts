import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction } from "discord.js";
import { db } from "../infra/db.js";
import { Result, GameMode, MapsByMode } from "../services/mapService.js";
import pino from "pino";

const logger = pino({
  transport: {
    target: "pino-pretty",
  },
});

export const data = new SlashCommandBuilder()
  .setName("stats")
  .setDescription("Show winrate statistics")
  .addStringOption((option) =>
    option
      .setName("mode")
      .setDescription("Filter by game mode")
      .setRequired(false)
      .addChoices(
        ...Object.keys(GameMode).map((mode) => ({ name: mode, value: mode }))
      )
  )
  .addStringOption((option) =>
    option
      .setName("map")
      .setDescription("Filter by map")
      .setRequired(false)
      .setAutocomplete(true)
  )
  .addUserOption(option => option.setName("user1").setDescription("Player 1").setRequired(false))
  .addUserOption(option => option.setName("user2").setDescription("Player 2").setRequired(false))
  .addUserOption(option => option.setName("user3").setDescription("Player 3").setRequired(false))
  .addUserOption(option => option.setName("user4").setDescription("Player 4").setRequired(false))
  .addUserOption(option => option.setName("user5").setDescription("Player 5").setRequired(false));

export async function autocomplete(interaction: AutocompleteInteraction) {
  const focusedOption = interaction.options.getFocused(true);

  if (focusedOption.name === "map") {
    const mode = interaction.options.getString("mode") as GameMode | null;
    let choices: string[] = [];

    if (mode && MapsByMode[mode]) {
      choices = MapsByMode[mode];
    } else {
      choices = Object.values(MapsByMode).flat();
    }

    const filtered = choices
      .filter((choice) =>
        choice.toLowerCase().includes(focusedOption.value.toLowerCase())
      )
      .slice(0, 25);

    await interaction.respond(
      filtered.map((choice) => ({ name: choice, value: choice }))
    );
  }
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const mode = interaction.options.getString("mode");
  const map = interaction.options.getString("map");

  const players = new Set<string>();
  for (let i = 1; i <= 5; i++) {
    const user = interaction.options.getUser(`user${i}`);
    if (user && !user.bot) {
      players.add(user.id);
    }
  }
  const playerArray = Array.from(players);

  await interaction.deferReply();

  try {
    const where: any = {
      guildId: interaction.guildId!,
      deletedAt: null,
    };

    if (mode) where.mode = mode;
    if (map) where.map = map;

    // If specific players are requested, find matches where ALL these players were present
    if (playerArray.length > 0) {
      where.AND = playerArray.map(userId => ({
        players: {
          some: { userId }
        }
      }));
    }

    const results = await db.match.groupBy({
      by: ["result", "groupSize"],
      where,
      _count: {
        result: true,
      },
    });

    let totalWins = 0;
    let totalLosses = 0;
    const groupStats: Record<number, { wins: number, losses: number }> = {};

    for (const group of results) {
      const gSize = group.groupSize;
      if (!groupStats[gSize]) groupStats[gSize] = { wins: 0, losses: 0 };

      if (group.result === Result.WIN) {
        totalWins += group._count.result;
        groupStats[gSize].wins += group._count.result;
      }
      if (group.result === Result.LOSS) {
        totalLosses += group._count.result;
        groupStats[gSize].losses += group._count.result;
      }
    }

    const total = totalWins + totalLosses;
    const winrate = total > 0 ? ((totalWins / total) * 100).toFixed(1) : "0.0";

    let title = "📊 **Server Stats**";
    if (playerArray.length > 0) {
      title = `📊 **Stats for Squad** (${playerArray.map(id => `<@${id}>`).join(", ")})`;
    }
    
    let message = `${title}${mode ? ` for ${mode}` : ""}${map ? ` on ${map}` : ""}:\n\n`;
    message += `**Overall**: ${totalWins}W - ${totalLosses}L (${winrate}% WR)\n\n`;

    // Add group size breakdown if applicable
    if (total > 0 && Object.keys(groupStats).length > 0) {
      message += `**Breakdown by Group Size:**\n`;
      for (const sizeStr of Object.keys(groupStats).sort()) {
        const size = parseInt(sizeStr);
        const stats = groupStats[size];
        if (!stats) continue;
        const gTotal = stats.wins + stats.losses;
        const gWinrate = gTotal > 0 ? ((stats.wins / gTotal) * 100).toFixed(1) : "0.0";
        const sizeName = size === 1 ? "Solo" : size === 2 ? "Duo" : size === 3 ? "Trio" : size === 4 ? "Quad" : "5-Stack";
        
        message += `- ${sizeName} (${size} players): ${stats.wins}W - ${stats.losses}L (${gWinrate}% WR)\n`;
      }
    }

    await interaction.editReply(message);
  } catch (error) {
    logger.error(error, "Failed to fetch stats");
    await interaction.editReply("❌ An error occurred while fetching statistics.");
  }
}