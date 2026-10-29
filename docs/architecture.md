# Architecture

Tu Tio Bot is a server bot with game-owned features: Overwatch history and Deadlock voice reminders. See the [Deadlock design](deadlock-voice-timers.md) and [usage guide](deadlock-usage.md).

## Ownership

- `src/index.ts`: constructs shared resources, composes the game catalog and Discord client, and handles login and shutdown.
- `src/bot/`: the game-neutral command interface, registry, Discord client, and interaction routing/error handling.
- `src/games/index.ts`: the single catalog used by runtime and slash-command deployment.
- `src/games/overwatch/`: Overwatch commands, match/statistics logic, map and hero rules, private dependency types, and the history-wipe script.
- `src/games/deadlock/`: objective validation/settings, match clocks, voice/sound adapters, commands, and voice-state cleanup.
- `src/infra/`: shared logging, Prisma client construction, and SQLite URL compatibility.
- `scripts/`: runtime, build cleanup, and deployment checks, including a standalone Deadlock sound probe. Builds clear old generated output before compiling, so moved game code cannot leave stale modules in `dist/`.
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

This is an explicit in-process catalog, without dynamic plugin loading. Modules may implement `attach(client)` to subscribe to Discord events and `dispose()` to remove listeners and release resources. The client attaches modules once; shutdown disposes them before destroying the client and disconnecting the database. Command deployment only constructs modules; it never attaches them or opens voice connections.

## Deadlock boundaries

`ObjectiveSettings` validates a guild's schedule, prepares all enabled callouts, then commits the JSON snapshot with a revision check. An unavailable sound asset or a concurrent edit preserves the previous saved schedule. `DeadlockSchedule` stores settings separately from Overwatch data. Active matches take an independent prepared snapshot, so editing does not affect a running clock.

`ReminderRun` owns monotonic match time and due callouts. `DeadlockMatches` owns one active run per guild, timer deadlines, cancellation, previews, and failure cleanup. Syncing resets the delivery cursor: forward corrections skip passed callouts; backward corrections re-arm future callouts. Event-loop stalls drop announcements older than two seconds instead of replaying a backlog.

The `SoundLibrary` port resolves a beep, ding, or an objective's spoken warning to an audio clip. `BundledSounds` checks readable, nonempty assets from `assets/deadlock/`, with spoken warnings at `voice/<objective-id>.ogg`. All use Ogg Opus and require no runtime conversion, synthesis, or writable cache. `VoiceTransport` and `VoiceSession` isolate Discord joining, DAVE-enabled playback, cancellation, and leaving. Simultaneous beeps coalesce to a single cue. A due ding or spoken warning replaces coinciding beeps; a ding plays first, followed by each distinct spoken warning. Pending playback remains bounded; stale queued sounds and overdue countdown ticks are skipped.

Playback, the deployment probe, and audio integration tests share `createSoundResource`. It opens a file stream before declaring Ogg Opus input. Passing the filename directly to the voice SDK instead forces arbitrary-input conversion through FFmpeg, overriding the declared format. The audio regression test removes external tools from PATH to catch that accidental dependency.

The clock attaches an absolute monotonic expiry to every sound. Countdown ticks expire one second after their scheduled time; other cues expire after two seconds. The match manager passes that expiry to voice playback, which checks it immediately before each clip starts. Queueing never extends a cue's lifetime. Overlapping beeps retain the stricter expiry; a selected ding retains its own expiry.

Objective callout settings contain independent due-ding, advance-warning, and countdown controls for first and recurring reminders. An objective-level `spoken` flag swaps every advance beep for its voice clip. Built-in defaults set it; the `default_spoken_warnings` migration set it on built-in objectives in saved schedules, and other records saved before the flag existed read it as off. `setSpoken` updates every objective in one revision-checked write, skipping objectives whose voice clip is unavailable. The settings reader accepts the former speech JSON format, discards retired text, and sets countdowns off while retaining timing and enablement. Subsequent saves persist the sound format.

Deadlock's module declares `GuildVoiceStates` and passes bot-channel observations to the match manager. Each attempt tracks its own join acknowledgement: earlier leave acknowledgements are ignored before it joins, while departures after that acknowledgement cancel the attempt even during the connection handshake. Human membership changes stop the run when no humans remain. The voice adapter bounds every transition out of Ready with a 20-second recovery deadline, including direct Signalling/Connecting transitions. It never receives users' audio. Active clocks are deliberately in memory; after a bot restart, start again with the current match time.

## Data and upgrades

`Match` and `MatchPlayer` are legacy **Overwatch** tables, despite their generic names. Their table names, fields, and migration history remain unchanged. `DeadlockSchedule` is a separate game-owned model. A new game adds clearly named models and its own migration; it must not reuse the Overwatch match tables or add fake match records for timers.

The Prisma 7 adapter uses the same URL resolver as the migration CLI. A relative `file:` path stays relative to `prisma/`, matching the old Prisma behavior. The adapter explicitly uses `unixepoch-ms` timestamps to read and query existing Prisma 5 dates. New schema changes still use normal Prisma migrations.

Integration tests apply the existing migrations to a unique temporary database and test legacy numeric timestamps through the public Overwatch commands. Shared registry tests exercise independent games, intent composition, collision detection, and dispatch. See the [architecture decision](adr/0001-game-owned-features.md).
