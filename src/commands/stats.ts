import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction, AttachmentBuilder } from "discord.js";
import { Result, GameMode, MapsByMode } from "../services/mapService.js";
import { Role, AllHeroes, HeroesByRole } from "../services/heroService.js";
import { logger } from "../infra/logger.js";
import { Services } from "../index.js";
import QuickChart from "quickchart-js";

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
  .addUserOption(option => option.setName("user").setDescription("Filter by a specific player").setRequired(false));

export async function autocomplete(interaction: AutocompleteInteraction) {
  const focusedOption = interaction.options.getFocused(true);

  if (focusedOption.name === "map") {
    const mode = interaction.options.getString("mode") as GameMode | null;
    const choices = mode && MapsByMode[mode] ? MapsByMode[mode] : Object.values(MapsByMode).flat();
    const filtered = choices.filter(c => c.toLowerCase().includes(focusedOption.value.toLowerCase())).slice(0, 25);
    await interaction.respond(filtered.map(c => ({ name: c, value: c })));
  } else if (focusedOption.name === "hero") {
    const role = interaction.options.getString("role") as Role | null;
    const choices = role && HeroesByRole[role] ? HeroesByRole[role] : AllHeroes;
    const filtered = choices.filter(c => c.toLowerCase().includes(focusedOption.value.toLowerCase())).slice(0, 25);
    await interaction.respond(filtered.map(c => ({ name: c, value: c })));
  }
}

export async function execute(interaction: ChatInputCommandInteraction, services: Services) {
  await interaction.deferReply();

  try {
    const mode = interaction.options.getString("mode");
    const map = interaction.options.getString("map");
    const role = interaction.options.getString("role");
    const hero = interaction.options.getString("hero");
    const user = interaction.options.getUser("user");
    const graphType = interaction.options.getString("graph") || "pie";

    const filter = {
        guildId: interaction.guildId!,
        mode,
        map,
        role,
        hero,
        userId: user?.id
    };

    const overall = await services.stats.getStats(filter);
    const teamBreakdown = await services.stats.getTeamBreakdown(interaction.guildId!, filter);

    let title = "📊 **Server Stats**";
    if (user) title = `📊 **Stats for <@${user.id}>**`;
    
    let message = `${title}${mode ? ` for ${mode}` : ""}${map ? ` on ${map}` : ""}${role ? ` as ${role}` : ""}${hero ? ` playing ${hero}` : ""}:\n\n`;
    message += `**Overall**: ${overall.wins}W - ${overall.losses}L (${overall.winRate.toFixed(1)}% WR)\n\n`;

    if (overall.total > 0 && teamBreakdown.length > 0) {
      message += `**Top Teams:**\n`;
      teamBreakdown.slice(0, 5).forEach(team => {
        const teamMentions = team.userIds.map(id => `<@${id}>`).join(", ");
        message += `- ${teamMentions}: ${team.wins}W - ${team.losses}L (${team.winRate.toFixed(1)}% WR)\n`;
      });
    }

    let attachment: AttachmentBuilder | undefined;
    if (overall.total > 0) {
      const chart = new (QuickChart as any)();
      
      if (graphType === "pie") {
        chart.setConfig({
          type: "outlabeledPie",
          data: {
            labels: ["Wins", "Losses"],
            datasets: [{
              data: [overall.wins, overall.losses],
              backgroundColor: ["#4caf50", "#f44336"]
            }]
          },
          options: {
            plugins: {
              legend: { display: false },
              outlabels: {
                text: "%l %p",
                color: "white",
                stretch: 35,
                font: { resizable: true, minSize: 12, maxSize: 18 }
              }
            }
          }
        });
      } else {
        const matches = await services.stats.getMatches(filter);
        const labels: string[] = [];
        const winrateData: number[] = [];
        let cumulativeWins = 0;
        let cumulativeTotal = 0;
        
        matches.forEach((m, i) => {
          cumulativeTotal++;
          if (m.result === Result.WIN) cumulativeWins++;
          labels.push(`M${i + 1}`);
          winrateData.push(parseFloat(((cumulativeWins / cumulativeTotal) * 100).toFixed(1)));
        });

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
              yAxes: [{ ticks: { beginAtZero: true, max: 100 } }],
              xAxes: [{ ticks: { display: labels.length <= 20 } }]
            }
          }
        });
      }

      chart.setBackgroundColor("white");
      const chartBuffer = await chart.toBinary();
      attachment = new AttachmentBuilder(chartBuffer, { name: "chart.png" });
    }

    await interaction.editReply({ content: message, files: attachment ? [attachment] : [] });
  } catch (error) {
    logger.error(error, "Failed to fetch stats");
    await interaction.editReply("❌ An error occurred while fetching statistics.");
  }
}
