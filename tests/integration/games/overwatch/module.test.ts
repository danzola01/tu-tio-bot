import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatInputCommandInteraction } from "discord.js";
import { createGameModules } from "../../../../src/games/index.js";
import { createCommandRegistry } from "../../../../src/bot/registry.js";
import { testDb } from "../../../setup.js";

describe("Overwatch module through the bot registry", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("retains all six public command names", () => {
    const registry = createCommandRegistry(createGameModules(testDb));
    expect(registry.definitions.map((definition) => definition.name))
      .toEqual(expect.arrayContaining(["match", "stats", "leaderboard", "undo", "insights", "session"]));
  });

  it("records a squad match and undoes it using the module's bound dependencies", async () => {
    const registry = createCommandRegistry(createGameModules(testDb));
    const values: Record<string, string> = { map: "Dorado", result: "WIN", hero: "Ana", player2: "friend", player2_hero: "Mercy" };
    const interaction = {
      guildId: "module-guild",
      user: { id: "reporter" },
      options: { getSubcommand: () => "add", getString: (key: string) => values[key] ?? null },
      deferReply: vi.fn(async () => {}),
      editReply: vi.fn(async () => {}),
    } as unknown as ChatInputCommandInteraction;

    await registry.get("match")!.execute(interaction);
    const match = await testDb.match.findFirstOrThrow({ include: { players: true } });
    expect(match).toMatchObject({ guildId: "module-guild", mode: "ESCORT", map: "Dorado", result: "WIN", groupSize: 2 });
    expect(match.players.map((player) => player.hero).sort()).toEqual(["Ana", "Mercy"]);
    expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining("Recorded **WIN**"));

    await registry.get("undo")!.execute(interaction);
    expect((await testDb.match.findUniqueOrThrow({ where: { id: match.id } })).deletedAt).toBeInstanceOf(Date);
  });

  it("reads existing Prisma 5 numeric timestamps and includes them in session statistics", async () => {
    const timestamp = Date.now();
    await testDb.$executeRaw`
      INSERT INTO "Match" (id, "guildId", "reportedByUserId", mode, map, result, "groupSize", "playedAt")
      VALUES ('legacy-match', 'legacy-guild', 'legacy-user', 'ESCORT', 'Dorado', 'WIN', 1, ${timestamp})
    `;
    await testDb.$executeRaw`
      INSERT INTO "MatchPlayer" (id, "matchId", "userId") VALUES ('legacy-player', 'legacy-match', 'legacy-user')
    `;
    const match = await testDb.match.findUniqueOrThrow({ where: { id: "legacy-match" } });
    expect(match.playedAt.getTime()).toBe(timestamp);
    const registry = createCommandRegistry(createGameModules(testDb));
    const editReply = vi.fn(async () => {});
    await registry.get("session")!.execute({
      guildId: "legacy-guild", user: { id: "legacy-user" }, options: { getString: () => null },
      deferReply: vi.fn(async () => {}), editReply,
    } as unknown as ChatInputCommandInteraction);
    expect(editReply).toHaveBeenCalledWith(expect.stringContaining("1W - 0L"));
  });

  it.each(["pie", "line"])("renders the %s chart with the upgraded QuickChart client", async (graph) => {
    await testDb.match.create({ data: { guildId: "charts", reportedByUserId: "player", mode: "ESCORT", map: "Dorado", result: "WIN" } });
    const fetch = vi.fn(async () => new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const editReply = vi.fn(async () => {});
    const registry = createCommandRegistry(createGameModules(testDb));
    await registry.get("stats")!.execute({
      guildId: "charts", user: { id: "player" },
      options: { getString: (key: string) => key === "graph" ? graph : null },
      deferReply: vi.fn(async () => {}), editReply,
    } as unknown as ChatInputCommandInteraction);
    expect(fetch).toHaveBeenCalledOnce();
    expect(editReply).toHaveBeenCalledWith(expect.objectContaining({ files: [expect.objectContaining({ name: "chart.png" })] }));
  });
});
