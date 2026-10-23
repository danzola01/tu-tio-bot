# Architecture

Tu Tio Bot is a server bot with game-owned features. Overwatch is the first implemented game. Deadlock voice reminders are specified in [their design](deadlock-voice-timers.md) and have no runtime implementation yet.

## Ownership

- `src/index.ts`: constructs shared resources, composes the game catalog and Discord client, and handles login and shutdown.
- `src/bot/`: the game-neutral command interface, registry, Discord client, and interaction routing/error handling.
- `src/games/index.ts`: the single catalog used by runtime and slash-command deployment.
- `src/games/overwatch/`: Overwatch commands, match/statistics logic, map and hero rules, private dependency types, and the history-wipe script.
- `src/infra/`: shared logging, Prisma client construction, and SQLite URL compatibility.
- `scripts/`: game-neutral runtime, build cleanup, and deployment checks. Builds clear old generated output before compiling, so moved game code cannot leave stale modules in `dist/`.
- `src/config.ts`: environment validation. `.env.example` lists the configuration.
- `prisma/`: the shared database schema and migration history. Generated client code goes into ignored `src/generated/prisma/`.
- `tests/unit/` and `tests/integration/`: tests grouped by game or shared bot/infra responsibility.

The shared `Command` interface receives only a Discord interaction. It has no Overwatch service dependency. A game's factory binds its own dependencies before returning a `GameModule` with an ID, commands, and required intents. Overwatch's internal `OverwatchServices` and `OverwatchCommand` types stay within its directory.

The registry combines game intents with the required `Guilds` intent and rejects duplicate game IDs or public command names. It provides both routing and the JSON definitions sent to Discord. Adding a command cannot silently update only runtime or only deployment.

Discord guild commands share one public namespace. Existing Overwatch commands retain `/match`, `/stats`, `/leaderboard`, `/undo`, `/insights`, and `/session` for compatibility. Future games should use a distinct root such as `/deadlock` with subcommands. Do not reuse another game's public command name.

## Adding a game

Create `src/games/<game>/index.ts` exporting a factory. For example:

```ts
import { SlashCommandBuilder } from "discord.js";
import type { GameModule } from "../../bot/types.js";

export function createExampleModule(): GameModule {
  return {
    id: "example",
    intents: [],
    commands: [{
      data: new SlashCommandBuilder()
        .setName("example")
        .setDescription("An example game command"),
      async execute(interaction) {
        await interaction.reply("Example game ready.");
      },
    }],
  };
}
```

Import that factory in `src/games/index.ts` and include its result in `createGameModules`. Inject the database or other resources there if the game needs them. Keep construction free of database queries and network calls: the same catalog is constructed for command deployment. Database construction creates a client without opening a connection; deployment disconnects it on completion.

Keep new game behavior and tests in that game's directory. Use shared `bot` and `infra` modules where needed; do not import Overwatch internals. Declare required gateway intents in the game module. Only request additional intents when the implemented feature needs them. Run `npm run check`, then register the updated command definitions with `npm run deploy` when deploying the feature.

This is an explicit in-process catalog, without dynamic plugin loading or speculative game frameworks. Add event-lifecycle hooks when a feature actually requires them. Voice state and timer lifecycle logic belong to the future Deadlock module; this refactor does not implement them.

## Data and upgrades

`Match` and `MatchPlayer` are legacy **Overwatch** tables, despite their generic names. Their table names, fields, and migration history remain unchanged. A new game adds its own clearly named models, such as `DeadlockObjective`, and its own migration; it must not reuse the Overwatch match tables or add fake match records for timers.

The Prisma 7 adapter uses the same URL resolver as the migration CLI. A relative `file:` path stays relative to `prisma/`, matching the old Prisma behavior. The adapter explicitly uses `unixepoch-ms` timestamps to read and query existing Prisma 5 dates. New schema changes still use normal Prisma migrations.

Integration tests apply the existing migrations to a unique temporary database and test legacy numeric timestamps through the public Overwatch commands. Shared registry tests exercise independent games, intent composition, collision detection, and dispatch. See the [architecture decision](adr/0001-game-owned-features.md).
