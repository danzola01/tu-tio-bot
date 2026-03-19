import { 
  SlashCommandBuilder, 
  AutocompleteInteraction, 
  ChatInputCommandInteraction, 
  MessageFlags
} from "discord.js";
import { Result, getModeForMap, AllMaps } from "../services/mapService.js";
import { Role, AllHeroes, HeroesByRole } from "../services/heroService.js";
import { logger } from "../infra/logger.js";
import type { Services } from "../types.js";

const isValidHeroName = (heroName: string | null): heroName is string => {
  return !!heroName && AllHeroes.includes(heroName);
};

export const data = new SlashCommandBuilder()
  .setName("match")
  .setDescription("Manage Overwatch matches")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("add")
      .setDescription("Add a new match result")
      .addStringOption((option) =>
        option
          .setName("map")
          .setDescription("The map name")
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption((option) =>
        option
          .setName("result")
          .setDescription("The match outcome")
          .setRequired(true)
          .addChoices(
            { name: "Win", value: Result.WIN },
            { name: "Loss", value: Result.LOSS },
            { name: "Draw", value: Result.DRAW },
          )
      )
      .addStringOption((option) =>
        option
          .setName("role")
          .setDescription("The role you played")
          .setRequired(false)
          .addChoices(
            ...Object.values(Role).map((r) => ({ name: r, value: r }))
          )
      )
      .addStringOption((option) =>
        option
          .setName("hero")
          .setDescription("The hero you played")
          .setRequired(false)
          .setAutocomplete(true)
      )
      .addStringOption(option => option.setName("player2").setDescription("Squadmate 2").setRequired(false).setAutocomplete(true))
      .addStringOption(option => option.setName("player2_hero").setDescription("Hero played by Squadmate 2").setRequired(false).setAutocomplete(true))
      .addStringOption(option => option.setName("player3").setDescription("Squadmate 3").setRequired(false).setAutocomplete(true))
      .addStringOption(option => option.setName("player3_hero").setDescription("Hero played by Squadmate 3").setRequired(false).setAutocomplete(true))
      .addStringOption(option => option.setName("player4").setDescription("Squadmate 4").setRequired(false).setAutocomplete(true))
      .addStringOption(option => option.setName("player4_hero").setDescription("Hero played by Squadmate 4").setRequired(false).setAutocomplete(true))
      .addStringOption(option => option.setName("player5").setDescription("Squadmate 5").setRequired(false).setAutocomplete(true))
      .addStringOption(option => option.setName("player5_hero").setDescription("Hero played by Squadmate 5").setRequired(false).setAutocomplete(true))
  );

export async function autocomplete(interaction: AutocompleteInteraction, services: Services) {
  const focusedOption = interaction.options.getFocused(true);

  if (focusedOption.name === "map") {
    const mostUsed = await services.match.getMostUsedMaps(interaction.guildId!);
    const choices = [...new Set([...mostUsed, ...AllMaps])];

    const filtered = choices
      .filter((choice) => choice.toLowerCase().includes(focusedOption.value.toLowerCase()))
      .slice(0, 25);

    await interaction.respond(
      filtered.map((choice) => ({ name: choice, value: choice }))
    );
  } else if (focusedOption.name.match(/^player\d+$/)) {
    const query = focusedOption.value.toLowerCase();
    
    // Fetch members from the guild, filtering out bots and the caller
    const members = await interaction.guild?.members.fetch({ query, limit: 25 });
    if (!members) {
      await interaction.respond([]);
      return;
    }

    const filtered = members
      .filter(m => !m.user.bot && m.id !== interaction.user.id)
      .map(m => ({ name: m.displayName, value: m.id }))
      .slice(0, 25);

    await interaction.respond(filtered);
  } else if (focusedOption.name.endsWith("hero")) {
    const role = interaction.options.getString("role") as Role | null;
    
    let targetUserId = interaction.user.id;
    const match = focusedOption.name.match(/^player(\d+)_hero$/);
    if (match) {
      const playerOption = interaction.options.get(`player${match[1]}`);
      if (playerOption?.value) {
        targetUserId = playerOption.value as string;
      }
    }

    const mostUsed = await services.match.getMostUsedHeroes(interaction.guildId!, targetUserId);
    
    let choices: string[] = [];

    if (focusedOption.name === "hero" && role && HeroesByRole[role]) {
      choices = HeroesByRole[role];
    } else {
      choices = AllHeroes;
    }

    const sortedChoices = [...new Set([...mostUsed.filter(h => choices.includes(h)), ...choices])];

    const filtered = sortedChoices
      .filter((choice) =>
        choice.toLowerCase().includes(focusedOption.value.toLowerCase())
      )
      .slice(0, 25);

    await interaction.respond(
      filtered.map((choice) => ({ name: choice, value: choice }))
    );
  }
}

export async function execute(interaction: ChatInputCommandInteraction, services: Services) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "add") {
    const map = interaction.options.getString("map", true);
    const result = interaction.options.getString("result", true) as Result;
    const role = interaction.options.getString("role");
    const rawHero = interaction.options.getString("hero");
    const hero = isValidHeroName(rawHero) ? rawHero : null;
    
    const mode = getModeForMap(map);

    if (!mode) {
      await interaction.reply({
        content: `❌ Could not find game mode for map **${map}**. Please ensure you select a valid map from the autocomplete list.`,
        flags: [MessageFlags.Ephemeral]
      });
      return;
    }
    
    const playersMap = new Map<string, { role: string | null, hero: string | null }>();
    playersMap.set(interaction.user.id, { role, hero });

    const addSquadmate = (num: number) => {
      const pId = interaction.options.getString(`player${num}`);
      const rawH = interaction.options.getString(`player${num}_hero`);
      const h = isValidHeroName(rawH) ? rawH : null;
      if (pId) {
        playersMap.set(pId, { role: null, hero: h });
      }
    };

    for (let i = 2; i <= 5; i++) {
      addSquadmate(i);
    }

    const playerArray = Array.from(playersMap.entries()).map(([userId, data]) => ({
      userId,
      role: data.role,
      hero: data.hero
    }));

    await interaction.deferReply();

    try {
      const match = await services.match.addMatch({
          guildId: interaction.guildId!,
          reportedByUserId: interaction.user.id,
          mode,
          map,
          result,
          players: playerArray
      });

      const userIds = playerArray.map(p => p.userId);
      const teamStats = await services.stats.getTeamStats(interaction.guildId!, userIds);
      const teamMentions = userIds.map(id => `<@${id}>`).join(", ");

      const teamDrawsStr = teamStats.draws > 0 ? ` - ${teamStats.draws}D` : "";
      await interaction.editReply(
        `✅ Recorded **${result}** on **${map}** (${mode}). Match ID: \`${match.id}\`\n\n**Team Stats** (${teamMentions}):\n${teamStats.wins}W - ${teamStats.losses}L${teamDrawsStr} (${teamStats.winRate.toFixed(1)}% WR)`
      );
    } catch (error) {
      logger.error(error, "Failed to save match");
      await interaction.editReply("❌ An error occurred while saving the match.");
    }
  }
}
