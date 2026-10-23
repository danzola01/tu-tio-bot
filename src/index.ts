import { config } from "./config.js";
import { createBotClient } from "./bot/client.js";
import { createCommandRegistry } from "./bot/registry.js";
import { createGameModules } from "./games/index.js";
import { createDatabase } from "./infra/db.js";
import { logger } from "./infra/logger.js";

const db = createDatabase(config.DATABASE_URL);
const registry = createCommandRegistry(createGameModules(db));
const client = createBotClient(registry);
let shuttingDown = false;

async function shutdown(exitCode: number) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    await client.destroy();
    await db.$disconnect();
  } catch (error) {
    logger.error({ err: error }, "Shutdown failed");
    exitCode = 1;
  }
  process.exitCode = exitCode;
}

process.once("SIGINT", () => { void shutdown(0); });
process.once("SIGTERM", () => { void shutdown(0); });
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled rejection");
  void shutdown(1);
});
process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception");
  void shutdown(1);
});

client.login(config.DISCORD_TOKEN).catch(async (error: unknown) => {
  logger.error({ err: error }, "Discord login failed");
  await shutdown(1);
});
