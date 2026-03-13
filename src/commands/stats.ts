import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction, AttachmentBuilder } from "discord.js";
import { db } from "../infra/db.js";
import { Result, GameMode, MapsByMode } from "../services/mapService.js";
import pino from "pino";
import QuickChart from "quickchart-js";

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
      .setName("graph")
      .setDescription("Type of chart to display")
      .setRequired(false)
      .addChoices(
        { name: "Pie Chart (Wins/Losses)", value: "pie" },
        { name: "Line Chart (Winrate Over Time)", value: "line" }
      )
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
    
    let message = `${title}${mode ? ` for ${mode}` : ""}${map ? ` on ${map}` : ""}:\n\n`;
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

    const graphType = interaction.options.getString("graph") || "pie";

    let attachment: AttachmentBuilder | undefined;
    if (total > 0) {
      const chart = new (QuickChart as unknown as { new (): any })();
      
      if (graphType === "pie") {
        chart.setConfig({
          type: "outlabeledPie",
          data: {
            labels: ["Wins", "Losses"],
            datasets: [{
              data: [totalWins, totalLosses],
              backgroundColor: ["#4caf50", "#f44336"]
            }]
          },
          options: {
            plugins: {
              legend: false,
              outlabels: {
                text: "%l %p",
                color: "white",
                stretch: 35,
                font: {
                  resizable: true,
                  minSize: 12,
                  maxSize: 18
                }
              }
            }
          }
        });
      } else if (graphType === "line") {
        // Sort matches by date ascending
        const sortedMatches = matches.sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
        
        const labels: string[] = [];
        const winrateData: number[] = [];
        let cumulativeWins = 0;
        let cumulativeTotal = 0;
        
        for (let i = 0; i < sortedMatches.length; i++) {
          const m = sortedMatches[i];
          if (!m) continue;
          cumulativeTotal++;
          if (m.result === Result.WIN) cumulativeWins++;
          
          labels.push(`Match ${i + 1}`);
          winrateData.push(parseFloat(((cumulativeWins / cumulativeTotal) * 100).toFixed(1)));
        }

        chart.setConfig({
          type: "line",
          data: {
            labels,
            datasets: [{
              label: "Winrate %",
              data: winrateData,
              fill: false,
              borderColor: "#2196f3",
              backgroundColor: "#2196f3",
              tension: 0.1
            }]
          },
          options: {
            scales: {
              yAxes: [{
                ticks: {
                  beginAtZero: true,
                  max: 100
                }
              }],
              xAxes: [{
                ticks: {
                  display: labels.length <= 20 // Hide x-axis labels if too many matches
                }
              }]
            }
          }
        });
      }
      
      chart.setBackgroundColor("white");
      const chartBuffer = await chart.toBinary();
      attachment = new AttachmentBuilder(chartBuffer, { name: "chart.png" });
    }

    if (attachment) {
      await interaction.editReply({ content: message, files: [attachment] });
    } else {
      await interaction.editReply(message);
    }
  } catch (error) {
    logger.error(error, "Failed to fetch stats");
    await interaction.editReply("❌ An error occurred while fetching statistics.");
  }
}