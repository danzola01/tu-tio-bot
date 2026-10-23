import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  GUILD_ID: z.string().min(1),
  CLIENT_ID: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  BOT_OWNER_ID: z.string().regex(/^\d{17,20}$/).optional(),
  DEADLOCK_AUDIO_DIR: z.string().min(1).optional(),
});

const env = envSchema.safeParse(process.env);

if (!env.success) {
  console.error("❌ Invalid environment variables:", env.error.format());
  process.exit(1);
}

export const config = {
  ...env.data,
  games: { deadlock: {
    ...(env.data.BOT_OWNER_ID ? { ownerId: env.data.BOT_OWNER_ID } : {}),
    ...(env.data.DEADLOCK_AUDIO_DIR ? { audioDirectory: env.data.DEADLOCK_AUDIO_DIR } : {}),
  } },
};
