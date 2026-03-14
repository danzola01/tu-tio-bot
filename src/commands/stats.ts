import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction } from "discord.js";
import { db } from "../infra/db.js";
import { Result, GameMode, MapsByMode } from "../services/mapService.js";
import { Role, AllHeroes, HeroesByRole } from "../services/heroService.js";
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
  .addStringOption((option) =>
    option
      .setName("role")
      .setDescription("Filter by role played")
      .setRequired(false)
      .addChoices(
        ...Object.keys(Role).map((r) => ({ name: r, value: r }))
      )
  )
  .addStringOption((option) =>
    option
      .setName("hero")
      .setDescription("Filter by hero played")
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
  } else if (focusedOption.name === "hero") {
    const role = interaction.options.getString("role") as Role | null;
    let choices: string[] = [];

    if (role && HeroesByRole[role]) {
      choices = HeroesByRole[role];
    } else {
      choices = AllHeroes;
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
  const roleFilter = interaction.options.getString("role");
  const heroFilter = interaction.options.getString("hero");

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

    const playerFilters: any[] = [];

    // If specific players are requested, find matches where ALL these players were present
    if (playerArray.length > 0) {
      for (const userId of playerArray) {
        const playerCondition: any = { userId };
        if (roleFilter) playerCondition.role = roleFilter;
        if (heroFilter) playerCondition.hero = heroFilter;
        playerFilters.push({ players: { some: playerCondition } });
      }
    } else if (roleFilter || heroFilter) {
      // If no users specified but role/hero is, assume the user running the command wants THEIR stats on that role/hero
      const playerCondition: any = { userId: interaction.user.id };
      if (roleFilter) playerCondition.role = roleFilter;
      if (heroFilter) playerCondition.hero = heroFilter;
      playerFilters.push({ players: { some: playerCondition } });
      playerArray.push(interaction.user.id); // Add them so the title is accurate
    }

    if (playerFilters.length > 0) {
      where.AND = playerFilters;
    }

    const matches = await db.match.findMany({
      where,
      include: {
        players: true
      }
    });

    let totalWins = 0;
    let totalLosses = 0;
    const teamStats = new Map<string, { wins: number; losses: number; userIds: string[] }>();

    for (const match of matches) {
      const matchUsers = match.players.map(p => p.userId).sort();
      const teamKey = matchUsers.join(",");
      
      if (!teamStats.has(teamKey)) {
        teamStats.set(teamKey, { wins: 0, losses: 0, userIds: matchUsers });
      }
      
      const stats = teamStats.get(teamKey)!;

      if (match.result === Result.WIN) {
        totalWins++;
        stats.wins++;
      } else if (match.result === Result.LOSS) {
        totalLosses++;
        stats.losses++;
      }
    }

    const total = totalWins + totalLosses;
    const winrate = total > 0 ? ((totalWins / total) * 100).toFixed(1) : "0.0";

    let title = "📊 **Server Stats**";
    if (playerArray.length > 0) {
      title = `📊 **Stats for Squad** (${playerArray.map(id => `<@${id}>`).join(", ")})`;
    }
    
    let message = `${title}${mode ? ` for ${mode}` : ""}${map ? ` on ${map}` : ""}${roleFilter ? ` as ${roleFilter}` : ""}${heroFilter ? ` playing ${heroFilter}` : ""}:\n\n`;
    message += `**Overall**: ${totalWins}W - ${totalLosses}L (${winrate}% WR)\n\n`;

    // Add team breakdown if applicable
    if (total > 0 && teamStats.size > 0) {
      message += `**Breakdown by Team:**\n`;
      
      const sortedTeams = Array.from(teamStats.values())
        .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))
        .slice(0, 10); // Show top 10 most played teams

      for (const team of sortedTeams) {
        const teamTotal = team.wins + team.losses;
        const teamWinrate = teamTotal > 0 ? ((team.wins / teamTotal) * 100).toFixed(1) : "0.0";
        const teamMentions = team.userIds.map(id => `<@${id}>`).join(", ");
        
        message += `- ${teamMentions}: ${team.wins}W - ${team.losses}L (${teamWinrate}% WR)\n`;
      }
    }

    await interaction.editReply(message);
  } catch (error) {
    logger.error(error, "Failed to fetch stats");
    await interaction.editReply("❌ An error occurred while fetching statistics.");
  }
}