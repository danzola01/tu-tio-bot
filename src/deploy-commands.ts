import { REST, Routes } from "discord.js";
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

const commands = [match.data.toJSON(), stats.data.toJSON(), leaderboard.data.toJSON(), undo.data.toJSON(), exportCmd.data.toJSON()];

const rest = new REST().setToken(config.DISCORD_TOKEN);

(async () => {
  try {
    logger.info(`Started refreshing ${commands.length} application (/) commands.`);

    const data: any = await rest.put(
      Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID),
      { body: commands }
    );

    logger.info(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    logger.error(error);
  }
})();
