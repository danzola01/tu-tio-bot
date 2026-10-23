import { GatewayIntentBits } from "discord.js";
import type { Command, GameModule } from "./types.js";

export function createCommandRegistry(modules: readonly GameModule[]) {
  const commands = new Map<string, Command>();
  const owners = new Map<string, string>();
  const moduleIds = new Set<string>();
  const intents = new Set<GatewayIntentBits>([GatewayIntentBits.Guilds]);

  for (const game of modules) {
    if (moduleIds.has(game.id)) throw new Error(`Duplicate game module: ${game.id}`);
    moduleIds.add(game.id);
    for (const intent of game.intents) intents.add(intent);

    for (const command of game.commands) {
      const name = command.data.name;
      if (commands.has(name)) {
        throw new Error(`Command /${name} is registered by both ${owners.get(name)} and ${game.id}`);
      }
      commands.set(name, command);
      owners.set(name, game.id);
    }
  }

  return {
    intents: [...intents],
    definitions: [...commands.values()].map((command) => command.data.toJSON()),
    get: (name: string) => commands.get(name),
  };
}
