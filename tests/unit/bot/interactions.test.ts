import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessageFlags, SlashCommandBuilder, type Interaction } from "discord.js";
import { createCommandRegistry } from "../../../src/bot/registry.js";
import { createInteractionHandler } from "../../../src/bot/interactions.js";

vi.mock("../../../src/infra/logger.js", () => ({ logger: { error: vi.fn() } }));

function fixture({ guild = true, autocomplete = false, deferred = false } = {}) {
  const reply = vi.fn(async () => {});
  const followUp = vi.fn(async () => {});
  const respond = vi.fn(async () => {});
  const interaction = {
    commandName: "example", inGuild: () => guild,
    isChatInputCommand: () => !autocomplete, isAutocomplete: () => autocomplete,
    isButton: () => false,
    deferred, replied: false, reply, followUp, respond,
  } as unknown as Interaction;
  return { interaction, reply, followUp, respond };
}

describe("shared Discord interaction handling", () => {
  beforeEach(() => vi.clearAllMocks());

  it("routes execution and autocomplete to the registered game", async () => {
    const execute = vi.fn(async () => {});
    const autocomplete = vi.fn(async () => {});
    const registry = createCommandRegistry([{ id: "example", intents: [], commands: [{
      data: new SlashCommandBuilder().setName("example").setDescription("Example"), execute, autocomplete,
    }] }]);
    const handle = createInteractionHandler(registry);
    const command = fixture();
    const completion = fixture({ autocomplete: true });
    await handle(command.interaction);
    await handle(completion.interaction);
    expect(execute).toHaveBeenCalledWith(command.interaction);
    expect(autocomplete).toHaveBeenCalledWith(completion.interaction);
  });

  it("rejects direct messages before calling a game's handler", async () => {
    const { interaction, reply } = fixture({ guild: false });
    await createInteractionHandler(createCommandRegistry([]))(interaction);
    expect(reply).toHaveBeenCalledWith(expect.objectContaining({ flags: MessageFlags.Ephemeral, content: "Use this command in the server." }));
  });

  it("routes persistent guide buttons to the owning command, including after a restart", async () => {
    const button = vi.fn(async () => {});
    const registry = createCommandRegistry([{ id: "example", intents: [], commands: [{
      data: new SlashCommandBuilder().setName("example").setDescription("Example"),
      execute: vi.fn(async () => {}), button,
    }] }]);
    const interaction = {
      customId: "example:counter:v1:abrams:1", inGuild: () => true,
      isChatInputCommand: () => false, isAutocomplete: () => false, isButton: () => true,
    } as unknown as Interaction;
    await createInteractionHandler(registry)(interaction);
    expect(button).toHaveBeenCalledWith(interaction);
    button.mockRejectedValueOnce(new Error("Discord unavailable"));
    const failure = fixture({ deferred: true });
    Object.assign(failure.interaction, { isChatInputCommand: () => false, isButton: () => true, customId: "example:counter:v1:abrams:1" });
    await createInteractionHandler(registry)(failure.interaction);
    expect(failure.followUp).toHaveBeenCalledWith(expect.objectContaining({ flags: MessageFlags.Ephemeral }));
  });

  it("responds to stale commands and unsupported autocomplete", async () => {
    const handle = createInteractionHandler(createCommandRegistry([]));
    const command = fixture();
    const completion = fixture({ autocomplete: true });
    await handle(command.interaction);
    await handle(completion.interaction);
    expect(command.reply).toHaveBeenCalledWith(expect.objectContaining({ content: "This command is no longer available." }));
    expect(completion.respond).toHaveBeenCalledWith([]);
  });

  it("handles failure to send an error reply after a deferred command fails", async () => {
    const registry = createCommandRegistry([{ id: "example", intents: [], commands: [{
      data: new SlashCommandBuilder().setName("example").setDescription("Example"),
      execute: async () => { throw new Error("Database unavailable"); },
    }] }]);
    const { interaction, followUp } = fixture({ deferred: true });
    followUp.mockRejectedValueOnce(new Error("Discord unavailable"));
    await expect(createInteractionHandler(registry)(interaction)).resolves.toBeUndefined();
    expect(followUp).toHaveBeenCalledOnce();
  });
});
