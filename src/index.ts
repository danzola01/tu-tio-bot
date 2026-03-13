import { Client, GatewayIntentBits, Collection, Events, MessageFlags } from "discord.js";
import { config } from "./config.js";
import pino from "pino";
import * as match from "./commands/match.js";
import * as stats from "./commands/stats.js";
import * as leaderboard from "./commands/leaderboard.js";
import * as undo from "./commands/undo.js";
import * as exportCmd from "./commands/export.js";

const logger = pino({
  transport: {
    target: "pino-pretty",
  },
});

export interface Command {
  data: any;
  execute: (interaction: any) => Promise<void>;
  autocomplete?: (interaction: any) => Promise<void>;
  handleComponent?: (interaction: any) => Promise<void>;
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const commands = new Collection<string, Command>();
commands.set(match.data.name, match);
commands.set(stats.data.name, stats);
commands.set(leaderboard.data.name, leaderboard);
commands.set(undo.data.name, undo);
commands.set(exportCmd.data.name, exportCmd);

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
      await command.execute(interaction);
    } catch (error) {
      logger.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "There was an error while executing this command!",
          flags: [MessageFlags.Ephemeral],
        });
      } else {
        await interaction.reply({
          content: "There was an error while executing this command!",
          flags: [MessageFlags.Ephemeral],
        });
      }
    }
  } else if (interaction.isAutocomplete()) {
    const command = commands.get(interaction.commandName);

    if (!command) {
      logger.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      if (command.autocomplete) {
        await command.autocomplete(interaction);
      }
    } catch (error) {
      logger.error(error);
    }
  } else if (interaction.isStringSelectMenu() || interaction.isUserSelectMenu() || interaction.isButton()) {
    const [commandName] = interaction.customId.split(":");
    const command = commands.get(commandName!);

    if (command && command.handleComponent) {
      try {
        await command.handleComponent(interaction);
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
