import { db } from "../infra/db.js";
import pino from "pino";

const logger = pino({
  transport: {
    target: "pino-pretty",
  },
});

async function main() {
  try {
    logger.info("🗑️ Wiping all match history...");
    const result = await db.match.deleteMany({});
    logger.info(`✅ Successfully deleted ${result.count} matches.`);
  } catch (error) {
    logger.error(error, "❌ Failed to wipe match history");
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
