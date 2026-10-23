import { describe, expect, it, vi } from "vitest";
import { GatewayIntentBits, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { createCommandRegistry } from "../../../src/bot/registry.js";
import type { GameModule } from "../../../src/bot/types.js";

function game(id: string, name = id): GameModule {
  return {
    id,
    intents: [GatewayIntentBits.Guilds],
    commands: [{ data: new SlashCommandBuilder().setName(name).setDescription(`${id} command`), execute: vi.fn(async () => {}) }],
  };
}

describe("game command registry", () => {
  it("deploys and dispatches commands from multiple independent games", async () => {
    const overwatch = game("overwatch");
    const deadlock = game("deadlock");
    const registry = createCommandRegistry([overwatch, deadlock]);
    expect(registry.definitions.map((command) => command.name)).toEqual(["overwatch", "deadlock"]);
    const interaction = {} as ChatInputCommandInteraction;
    await registry.get("deadlock")!.execute(interaction);
    expect(deadlock.commands[0]!.execute).toHaveBeenCalledWith(interaction);
    expect(overwatch.commands[0]!.execute).not.toHaveBeenCalled();
    expect(registry.get("unknown")).toBeUndefined();
  });

  it("combines and deduplicates game intents with the shared Guilds intent", () => {
    const registry = createCommandRegistry([
      { ...game("overwatch"), intents: [GatewayIntentBits.GuildMembers] },
      { ...game("deadlock"), intents: [GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers] },
    ]);
    expect(registry.intents).toEqual([GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates]);
  });

  it("rejects conflicting command names instead of silently routing to the wrong game", () => {
    expect(() => createCommandRegistry([game("overwatch", "stats"), game("deadlock", "stats")]))
      .toThrow("Command /stats is registered by both overwatch and deadlock");
  });

  it("rejects duplicate game IDs", () => {
    expect(() => createCommandRegistry([game("overwatch"), game("overwatch", "other")]))
      .toThrow("Duplicate game module: overwatch");
  });
});
