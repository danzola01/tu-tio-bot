import { Client, Events } from "discord.js";
import { logger } from "../infra/logger.js";
import { createInteractionHandler } from "./interactions.js";
import type { createCommandRegistry } from "./registry.js";

export function createBotClient(registry: ReturnType<typeof createCommandRegistry>): Client {
  const client = new Client({ intents: registry.intents, allowedMentions: { parse: ["users"] } });
  client.once(Events.ClientReady, (readyClient) => {
    logger.info({ user: readyClient.user.tag }, "Bot ready");
  });
  client.on(Events.InteractionCreate, createInteractionHandler(registry));
  return client;
}
