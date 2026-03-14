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
import { logger } from "../infra/logger.js";
import { Services } from "../index.js";

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
    const choices = AllMaps;
    const filtered = choices
      .filter((choice) => choice.toLowerCase().includes(focusedOption.value.toLowerCase()))
      .slice(0, 25);

    await interaction.respond(
      filtered.map((choice) => ({ name: choice, value: choice }))
    );
  }
}

// In-memory cache for the interactive flow
const flowState = new Map<string, { squad: string[], mode?: string, map?: string }>();

export async function execute(interaction: ChatInputCommandInteraction, services: Services) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "add") {
    const map = interaction.options.getString("map", true);
    const result = interaction.options.getString("result", true);
    
    const mode = getModeForMap(map);

    if (!mode) {
      await interaction.reply({
        content: `❌ Could not find game mode for map **${map}**. Please ensure you select a valid map from the autocomplete list.`,
        flags: [MessageFlags.Ephemeral]
      });
      return;
    }
    
    const players = new Set([interaction.user.id]);
    for (let i = 2; i <= 5; i++) {
        const u = interaction.options.getUser(`player${i}`);
        if (u && !u.bot) players.add(u.id);
    }

    const playerArray = Array.from(players);
    await interaction.deferReply();

    try {
      const match = await services.match.addMatch({
          guildId: interaction.guildId!,
          reportedByUserId: interaction.user.id,
          mode,
          map,
          result,
          playerIds: playerArray
      });

      const teamStats = await services.stats.getTeamStats(interaction.guildId!, playerArray);
      const teamMentions = playerArray.map(id => `<@${id}>`).join(", ");

      await interaction.editReply(
        `✅ Recorded **${result}** on **${map}** (${mode}). Match ID: \`${match.id}\`\n\n**Team Stats** (${teamMentions}):\n${teamStats.wins}W - ${teamStats.losses}L (${teamStats.winRate.toFixed(1)}% WR)`
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
  interaction: StringSelectMenuInteraction | UserSelectMenuInteraction | ButtonInteraction,
  services: Services
) {
  const parts = interaction.customId.split(":");
  const [prefix, action, step] = parts;
  const contextKey = parts[parts.length - 1]!;

  if (prefix !== "match") return;
  
  const [guildId, userId] = contextKey.split(":");
  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: "This is not your interaction!",
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }

  const state = flowState.get(contextKey) || { squad: [userId] };

  if (action === "start") {
    if (step === "squad" && interaction.isUserSelectMenu()) {
      const selectedUsers = interaction.users.filter(u => !u.bot).map(u => u.id);
      state.squad = Array.from(new Set([userId!, ...selectedUsers]));
      flowState.set(contextKey, state);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`match:start:mode:${contextKey}`)
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
      flowState.set(contextKey, state);

      const maps = MapsByMode[mode];
      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`match:start:map:${contextKey}`)
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
      flowState.set(contextKey, state);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`match:start:result:WIN:${contextKey}`)
          .setLabel("Win")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`match:start:result:LOSS:${contextKey}`)
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
        const match = await services.match.addMatch({
            guildId: interaction.guildId!,
            reportedByUserId: interaction.user.id,
            mode,
            map,
            result,
            playerIds: squad
        });

        const teamStats = await services.stats.getTeamStats(interaction.guildId!, squad);
        const teamMentions = squad.map(id => `<@${id}>`).join(", ");

        flowState.delete(contextKey);

        await interaction.update({
          content: `✅ Recorded **${result}** on **${map}** (${mode}). Match ID: \`${match.id}\`\n\n**Team Stats** (${teamMentions}):\n${teamStats.wins}W - ${teamStats.losses}L (${teamStats.winRate.toFixed(1)}% WR)`,
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
