import { REST, Routes } from "discord.js";
import { config } from "./config.js";
import { createCommandRegistry } from "./bot/registry.js";
import { createGameModules } from "./games/index.js";
import { createDatabase } from "./infra/db.js";
import { logger } from "./infra/logger.js";

const db = createDatabase(config.DATABASE_URL);

try {
  const { definitions } = createCommandRegistry(createGameModules(db));
  const rest = new REST().setToken(config.DISCORD_TOKEN);
  logger.info({ count: definitions.length }, "Refreshing guild slash commands");
  await rest.put(Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID), {
    body: definitions,
  });
  logger.info({ count: definitions.length }, "Guild slash commands refreshed");
} catch (error) {
  logger.error({ err: error }, "Slash-command deployment failed");
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
