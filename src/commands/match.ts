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
import { GameMode, MapsByMode, Result } from "../services/mapService.js";
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
          .setName("mode")
          .setDescription("The game mode")
          .setRequired(true)
          .addChoices(
            ...Object.keys(GameMode).map((mode) => ({ name: mode, value: mode }))
          )
      )
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
      .addUserOption(option => option.setName("player2").setDescription("Squadmate 2").setRequired(false))
      .addUserOption(option => option.setName("player3").setDescription("Squadmate 3").setRequired(false))
      .addUserOption(option => option.setName("player4").setDescription("Squadmate 4").setRequired(false))
      .addUserOption(option => option.setName("player5").setDescription("Squadmate 5").setRequired(false))
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

// In-memory cache for the interactive flow
const flowState = new Map<string, { squad: string[], mode?: string, map?: string }>();

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "add") {
    const mode = interaction.options.getString("mode", true);
    const map = interaction.options.getString("map", true);
    const result = interaction.options.getString("result", true);

    const players = new Set([interaction.user.id]);
    const p2 = interaction.options.getUser("player2");
    const p3 = interaction.options.getUser("player3");
    const p4 = interaction.options.getUser("player4");
    const p5 = interaction.options.getUser("player5");

    if (p2 && !p2.bot) players.add(p2.id);
    if (p3 && !p3.bot) players.add(p3.id);
    if (p4 && !p4.bot) players.add(p4.id);
    if (p5 && !p5.bot) players.add(p5.id);

    const playerArray = Array.from(players);

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
            create: playerArray.map(id => ({ userId: id }))
          }
        },
      });

      // Calculate stats for this specific team composition
      const teamResultGroups = await db.match.groupBy({
        where: {
          guildId: interaction.guildId!,
          deletedAt: null,
          groupSize: playerArray.length,
          AND: playerArray.map(userId => ({
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

      for (const group of teamResultGroups) {
        if (group.result === Result.WIN) {
          teamWins = group._count._all;
        } else if (group.result === Result.LOSS) {
          teamLosses = group._count._all;
        }
      }

      const teamTotal = teamWins + teamLosses;
      const teamWinrate = teamTotal > 0 ? ((teamWins / teamTotal) * 100).toFixed(1) : "0.0";
      const teamMentions = playerArray.map(id => `<@${id}>`).join(", ");

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

        // Calculate stats for this specific team composition
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
