import { 
  SlashCommandBuilder, 
  AutocompleteInteraction, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ComponentType,
  StringSelectMenuInteraction,
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

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "add") {
    const mode = interaction.options.getString("mode", true);
    const map = interaction.options.getString("map", true);
    const result = interaction.options.getString("result", true);

    await interaction.deferReply();

    try {
      const match = await db.match.create({
        data: {
          guildId: interaction.guildId!,
          reportedByUserId: interaction.user.id,
          mode,
          map,
          result,
        },
      });

      await interaction.editReply(
        `✅ Recorded **${result}** on **${map}** (${mode}). Match ID: \`${match.id}\``
      );
    } catch (error) {
      logger.error(error, "Failed to save match");
      await interaction.editReply("❌ An error occurred while saving the match.");
    }
  } else if (subcommand === "start") {
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`match:start:mode:${interaction.user.id}`)
        .setPlaceholder("Select the Game Mode")
        .addOptions(
          Object.keys(GameMode).map((mode) => ({
            label: mode,
            value: mode,
          }))
        )
    );

    await interaction.reply({
      content: "Step 1: What was the game mode?",
      components: [row],
      flags: [MessageFlags.Ephemeral],
    });
  }
}

export async function handleComponent(
  interaction: StringSelectMenuInteraction | ButtonInteraction
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
  if (action === "start") {
    if (step === "mode" && interaction.isStringSelectMenu()) {
      const mode = interaction.values[0] as GameMode;
      const maps = MapsByMode[mode];

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`match:start:map:${mode}:${userId}`)
          .setPlaceholder("Select the Map")
          .addOptions(
            maps.map((map) => ({
              label: map,
              value: map,
            }))
          )
      );

      await interaction.update({
        content: `Step 2: Selected **${mode}**. Now select the map:`,
        components: [row],
      });
    } else if (step === "map" && interaction.isStringSelectMenu()) {
      const mode = parts[3];
      const map = interaction.values[0];

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`match:start:result:${mode}:${map}:WIN:${userId}`)
          .setLabel("Win")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`match:start:result:${mode}:${map}:LOSS:${userId}`)
          .setLabel("Loss")
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.update({
        content: `Step 3: Selected **${map}** (${mode}). What was the result?`,
        components: [row],
      });
    } else if (step === "result" && interaction.isButton()) {
      const mode = parts[3];
      const map = parts[4];
      const result = parts[5];

      try {
        const match = await db.match.create({
          data: {
            guildId: interaction.guildId!,
            reportedByUserId: interaction.user.id,
            mode,
            map,
            result,
          },
        });

        await interaction.update({
          content: `✅ Recorded **${result}** on **${map}** (${mode}). Match ID: \`${match.id}\``,
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
