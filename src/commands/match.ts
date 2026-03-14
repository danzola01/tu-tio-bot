import { 
  SlashCommandBuilder, 
  AutocompleteInteraction, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  UserSelectMenuBuilder,
  ButtonBuilder, 
  ButtonStyle,
  StringSelectMenuInteraction,
  UserSelectMenuInteraction,
  ButtonInteraction,
  MessageFlags
} from "discord.js";
import { GameMode, MapsByMode, Result, getModeForMap, AllMaps } from "../services/mapService.js";
import { Role, AllHeroes, HeroesByRole } from "../services/heroService.js";
import { db } from "../infra/db.js";
import pino from "pino";

const logger = pino({
  transport: {
    target: "pino-pretty",
  },
});

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
            { name: "Loss", value: Result.LOSS }
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
      .addUserOption(option => option.setName("player2").setDescription("Squadmate 2").setRequired(false))
      .addStringOption(option => option.setName("player2_hero").setDescription("Hero played by Squadmate 2").setRequired(false).setAutocomplete(true))
      .addUserOption(option => option.setName("player3").setDescription("Squadmate 3").setRequired(false))
      .addStringOption(option => option.setName("player3_hero").setDescription("Hero played by Squadmate 3").setRequired(false).setAutocomplete(true))
      .addUserOption(option => option.setName("player4").setDescription("Squadmate 4").setRequired(false))
      .addStringOption(option => option.setName("player4_hero").setDescription("Hero played by Squadmate 4").setRequired(false).setAutocomplete(true))
      .addUserOption(option => option.setName("player5").setDescription("Squadmate 5").setRequired(false))
      .addStringOption(option => option.setName("player5_hero").setDescription("Hero played by Squadmate 5").setRequired(false).setAutocomplete(true))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("start")
      .setDescription("Start a guided match entry flow")
  );

export async function autocomplete(interaction: AutocompleteInteraction) {
  const focusedOption = interaction.options.getFocused(true);

  if (focusedOption.name === "map") {
    const mode = interaction.options.getString("mode") as GameMode | null;
    let choices: string[] = [];

    if (mode && MapsByMode[mode]) {
      choices = MapsByMode[mode];
    } else {
      choices = AllMaps;
    }

    const filtered = choices
      .filter((choice) =>
        choice.toLowerCase().includes(focusedOption.value.toLowerCase())
      )
      .slice(0, 25);

    await interaction.respond(
      filtered.map((choice) => ({ name: choice, value: choice }))
    );
  } else if (focusedOption.name.endsWith("hero")) {
    const role = interaction.options.getString("role") as Role | null;
    let choices: string[] = [];

    if (focusedOption.name === "hero" && role && HeroesByRole[role]) {
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

const flowState = new Map<string, { squad: string[], mode?: string, map?: string }>();

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "add") {
    const map = interaction.options.getString("map", true);
    const result = interaction.options.getString("result", true);
    const role = interaction.options.getString("role");
    const hero = interaction.options.getString("hero");

    const inferredMode = getModeForMap(map);

    if (!inferredMode) {
      await interaction.reply({
        content: `❌ Could not find game mode for map **${map}**. Please ensure you select a valid map from the autocomplete list.`,
        flags: [MessageFlags.Ephemeral]
      });
      return;
    }

    const mode = inferredMode;

    const playersMap = new Map<string, { role: string | null, hero: string | null }>();
    
    // Add reporter
    playersMap.set(interaction.user.id, { role, hero });

    const addSquadmate = (num: number) => {
      const p = interaction.options.getUser(`player${num}`);
      const h = interaction.options.getString(`player${num}_hero`);
      if (p && !p.bot) {
        playersMap.set(p.id, { role: null, hero: h });
      }
    };

    addSquadmate(2);
    addSquadmate(3);
    addSquadmate(4);
    addSquadmate(5);

    const playerArray = Array.from(playersMap.entries()).map(([userId, data]) => ({
      userId,
      role: data.role,
      hero: data.hero
    }));

    await interaction.deferReply();

    try {
      const match = await db.match.create({
        data: {
          guildId: interaction.guildId!,
          reportedByUserId: interaction.user.id,
          mode,
          map,
          result,
          groupSize: playerArray.length,
          players: {
            create: playerArray
          }
        },
      });

      const teamResultGroups = await db.match.groupBy({
        where: {
          guildId: interaction.guildId!,
          deletedAt: null,
          groupSize: playerArray.length,
          AND: playerArray.map(p => ({
            players: {
              some: { userId: p.userId }
            }
          }))
        },
        by: ["result"],
        _count: {
          _all: true,
        },
      });

      let teamWins = 0;
      let teamLosses = 0;

      for (const group of teamResultGroups) {
        if (group.result === Result.WIN) {
          teamWins = group._count._all;
        } else if (group.result === Result.LOSS) {
          teamLosses = group._count._all;
        }
      }

      const teamTotal = teamWins + teamLosses;
      const teamWinrate = teamTotal > 0 ? ((teamWins / teamTotal) * 100).toFixed(1) : "0.0";
      const teamMentions = playerArray.map(p => `<@${p.userId}>`).join(", ");

      await interaction.editReply(
        `✅ Recorded **${result}** on **${map}** (${mode}). Match ID: \`${match.id}\`\n\n**Team Stats** (${teamMentions}):\n${teamWins}W - ${teamLosses}L (${teamWinrate}% WR)`
      );
    } catch (error) {
      logger.error(error, "Failed to save match");
      await interaction.editReply("❌ An error occurred while saving the match.");
    }
  } else if (subcommand === "start") {
    const contextKey = `${interaction.guildId ?? "DM"}:${interaction.user.id}`;
    flowState.set(contextKey, { squad: [interaction.user.id] });

    const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(`match:start:squad:${contextKey}`)
        .setPlaceholder("Select up to 4 squadmates")
        .setMinValues(0)
        .setMaxValues(4)
    );

    await interaction.reply({
      content: "Step 1: Who did you play with? (You are automatically included, select 0 if solo)",
      components: [row],
      flags: [MessageFlags.Ephemeral],
    });
  }
}

export async function handleComponent(
  interaction: StringSelectMenuInteraction | UserSelectMenuInteraction | ButtonInteraction
) {
  const parts = interaction.customId.split(":");
  const [prefix, action, step] = parts;
  const userId = parts[parts.length - 1];

  if (prefix !== "match") return;
  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: "This is not your interaction!",
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }

  const state = flowState.get(userId) || { squad: [userId] };

  if (action === "start") {
    if (step === "squad" && interaction.isUserSelectMenu()) {
      const selectedUsers = interaction.users.filter(u => !u.bot).map(u => u.id);
      state.squad = Array.from(new Set([userId, ...selectedUsers]));
      flowState.set(userId, state);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`match:start:mode:${userId}`)
          .setPlaceholder("Select the Game Mode")
          .addOptions(
            Object.keys(GameMode).map((mode) => ({
              label: mode,
              value: mode,
            }))
          )
      );

      await interaction.update({
        content: `Step 2: Selected a squad of ${state.squad.length}. What was the game mode?`,
        components: [row],
      });
    } else if (step === "mode" && interaction.isStringSelectMenu()) {
      const mode = interaction.values[0] as GameMode;
      state.mode = mode;
      flowState.set(userId, state);

      const maps = MapsByMode[mode];

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`match:start:map:${userId}`)
          .setPlaceholder("Select the Map")
          .addOptions(
            maps.map((map) => ({
              label: map,
              value: map,
            }))
          )
      );

      await interaction.update({
        content: `Step 3: Selected **${mode}**. Now select the map:`,
        components: [row],
      });
    } else if (step === "map" && interaction.isStringSelectMenu()) {
      const map = interaction.values[0];
      if (!map) return;
      state.map = map;
      flowState.set(userId, state);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`match:start:result:WIN:${userId}`)
          .setLabel("Win")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`match:start:result:LOSS:${userId}`)
          .setLabel("Loss")
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.update({
        content: `Step 4: Selected **${map}** (${state.mode}). What was the result?`,
        components: [row],
      });
    } else if (step === "result" && interaction.isButton()) {
      const result = parts[3]!;
      const { squad, mode, map } = state;

      if (!mode || !map) {
        await interaction.update({ content: "❌ State lost, please try again.", components: [] });
        return;
      }

      try {
        const match = await db.match.create({
          data: {
            guildId: interaction.guildId!,
            reportedByUserId: interaction.user.id,
            mode,
            map,
            result,
            groupSize: squad.length,
            players: {
              create: squad.map(id => ({ userId: id }))
            }
          },
        });

        const teamStats = await db.match.groupBy({
          where: {
            guildId: interaction.guildId!,
            deletedAt: null,
            groupSize: squad.length,
            AND: squad.map(userId => ({
              players: {
                some: { userId }
              }
            }))
          },
          by: ["result"],
          _count: {
            _all: true,
          },
        });

        let teamWins = 0;
        let teamLosses = 0;

        for (const stat of teamStats) {
          if (stat.result === Result.WIN) {
            teamWins = stat._count._all;
          } else if (stat.result === Result.LOSS) {
            teamLosses = stat._count._all;
          }
        }

        const teamTotal = teamWins + teamLosses;
        const teamWinrate = teamTotal > 0 ? ((teamWins / teamTotal) * 100).toFixed(1) : "0.0";
        const teamMentions = squad.map(id => `<@${id}>`).join(", ");

        flowState.delete(userId);

        await interaction.update({
          content: `✅ Recorded **${result}** on **${map}** (${mode}). Match ID: \`${match.id}\`\n\n**Team Stats** (${teamMentions}):\n${teamWins}W - ${teamLosses}L (${teamWinrate}% WR)`,
          components: [],
        });
      } catch (error) {
        logger.error(error, "Failed to save match from guided flow");
        await interaction.update({
          content: "❌ An error occurred while saving the match.",
          components: [],
        });
      }
    }
  }
}