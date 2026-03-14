import { Client, GatewayIntentBits, Collection, Events } from "discord.js";
import { config } from "./config.js";
import { logger } from "./infra/logger.js";
import { db } from "./infra/db.js";
import { MatchService } from "./services/matchService.js";
import { StatsService } from "./services/statsService.js";
import { FlowService } from "./services/flowService.js";
import * as match from "./commands/match.js";
import * as stats from "./commands/stats.js";
import * as leaderboard from "./commands/leaderboard.js";
import * as undo from "./commands/undo.js";
import * as insights from "./commands/insights.js";
import { Command, Services } from "./types.js";

const services: Services = {
  match: new MatchService(db),
  stats: new StatsService(db),
  flow: new FlowService(),
};

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const commands = new Collection<string, Command>();
commands.set(match.data.name, match as Command);
commands.set(stats.data.name, stats as Command);
commands.set(leaderboard.data.name, leaderboard as Command);
commands.set(undo.data.name, undo as Command);
commands.set(insights.data.name, insights as Command);

client.once(Events.ClientReady, (readyClient) => {
  logger.info(`✅ Ready! Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);

    if (!command) {
      logger.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction, services);
    } catch (error) {
      logger.error(error);
      const errorMessage = {
        content: "There was an error while executing this command!",
        ephemeral: true,
      };
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  } else if (interaction.isAutocomplete()) {
    const command = commands.get(interaction.commandName);

    if (command?.autocomplete) {
      try {
        await command.autocomplete(interaction);
      } catch (error) {
        logger.error(error);
      }
    }
  } else if (interaction.isStringSelectMenu() || interaction.isUserSelectMenu() || interaction.isButton()) {
    const [commandName] = interaction.customId.split(":");
    const command = commands.get(commandName!);

    if (command?.handleComponent) {
      try {
        await command.handleComponent(interaction, services);
      } catch (error) {
        logger.error(error);
      }
    }
  }
});

client.login(config.DISCORD_TOKEN).catch((err) => {
  logger.error("❌ Failed to login:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error({ promise, reason }, "Unhandled Rejection");
});

process.on("uncaughtException", (error) => {
  logger.error(error, "Uncaught Exception");
  process.exit(1);
});
