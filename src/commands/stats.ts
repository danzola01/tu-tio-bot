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
  const mode = interaction.options.getString("mode");
  const map = interaction.options.getString("map");

  await interaction.deferReply();

  try {
    const where: any = {
      guildId: interaction.guildId!,
      deletedAt: null,
    };

    if (mode) where.mode = mode;
    if (map) where.map = map;

    const results = await db.match.groupBy({
      by: ["result"],
      where,
      _count: {
        result: true,
      },
    });

    let wins = 0;
    let losses = 0;

    for (const group of results) {
      if (group.result === Result.WIN) wins = group._count.result;
      if (group.result === Result.LOSS) losses = group._count.result;
    }

    const total = wins + losses;
    const winrate = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";

    let message = `📊 **Stats**${mode ? ` for ${mode}` : ""}${map ? ` on ${map}` : ""}:\n`;
    message += `Total Matches: ${total}\n`;
    message += `Wins: ${wins}\n`;
    message += `Losses: ${losses}\n`;
    message += `Winrate: ${winrate}%`;

    await interaction.editReply(message);
  } catch (error) {
    logger.error(error, "Failed to fetch stats");
    await interaction.editReply("❌ An error occurred while fetching statistics.");
  }
}
