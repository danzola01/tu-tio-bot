import { SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder } from "discord.js";
import { db } from "../infra/db.js";
import pino from "pino";

const logger = pino({
  transport: {
    target: "pino-pretty",
  },
});

export const data = new SlashCommandBuilder()
  .setName("export")
  .setDescription("Export your match history to a CSV file");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true }); // Make this ephemeral so it's private

  try {
    const matches = await db.match.findMany({
      where: {
        guildId: interaction.guildId!,
        deletedAt: null,
        players: {
          some: { userId: interaction.user.id }
        }
      },
      orderBy: {
        playedAt: 'asc'
      },
      include: {
        players: true
      }
    });

    if (matches.length === 0) {
      await interaction.editReply("❌ You have no match history to export.");
      return;
    }

    // Build CSV content
    let csv = "Date,Mode,Map,Result,Group Size,Your Role,Your Hero\n";

    for (const match of matches) {
      const date = match.playedAt.toISOString();
      const me = match.players.find(p => p.userId === interaction.user.id);
      
      const role = me?.role || "";
      const hero = me?.hero || "";
      
      // Escape map string in case it contains commas
      let mapStr = match.map;
      if (mapStr.includes(",")) {
        mapStr = `"${mapStr}"`;
      }

      csv += `${date},${match.mode},${mapStr},${match.result},${match.groupSize},${role},${hero}\n`;
    }

    const buffer = Buffer.from(csv, "utf-8");
    const attachment = new AttachmentBuilder(buffer, { name: "match_history.csv" });

    await interaction.editReply({
      content: `✅ Here is your match history data (${matches.length} matches):`,
      files: [attachment]
    });
  } catch (error) {
    logger.error(error, "Failed to export data");
    await interaction.editReply("❌ An error occurred while generating your export.");
  }
}
