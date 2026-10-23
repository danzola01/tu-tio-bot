import { createDatabase } from "../../infra/db.js";
import { config } from "../../config.js";
import { logger } from "../../infra/logger.js";

const db = createDatabase(config.DATABASE_URL);

async function main() {
  try {
    logger.info("🗑️ Wiping all Overwatch match history...");
    const result = await db.match.deleteMany({});
    logger.info(`✅ Successfully deleted ${result.count} matches.`);
  } catch (error) {
    logger.error(error, "❌ Failed to wipe match history");
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main();
