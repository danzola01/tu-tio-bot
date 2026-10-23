# Tu Tio Bot

A Discord bot for our server, with independent Overwatch match tracking and Deadlock voice reminders.

## Requirements

Use **Node 24.22.1 or a newer Node 24 patch**, with npm. The pinned version is in [.node-version](.node-version) and [.nvmrc](.nvmrc). This baseline includes the [October 21, 2026 Node security release](https://nodejs.org/en/blog/release/v24.22.1).

Deadlock speech also needs **eSpeak NG** and **FFmpeg with libopus** on the bot's host. On Debian/Ubuntu: `sudo apt-get install espeak-ng ffmpeg`. Run `npm run check:audio` to verify synthesis, cache permissions, and Opus decoding locally.

## Setup

1. Select the project runtime, for example with nvm:

   ```bash
   nvm install
   nvm use
   ```

2. Install dependencies and generate Prisma Client:

   ```bash
   npm ci
   cp .env.example .env
   ```

3. Fill in `.env`: `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, and `DATABASE_URL`. Keep credentials out of Git. With `DATABASE_URL="file:./dev.db"`, the database remains at `prisma/dev.db`, including after the Prisma upgrade.

4. Apply the existing migrations:

   ```bash
   npx prisma migrate deploy
   ```

5. Enable **Server Members Intent** in the Discord Developer Portal for Overwatch member autocomplete, invite the bot with `bot` and `applications.commands` scopes, and give it access to its text channels. For Deadlock, also grant **View Channel, Connect, and Speak** in your regular voice channel. Register commands and start:

   ```bash
   npm run deploy
   npm run dev
   ```

For a production install or an existing Oracle VM, follow [deployment and upgrading](docs/deployment.md).

## Current Overwatch commands

Existing command names and options are preserved:

- `/match add`: record a win, loss, or draw, with map, optional role/hero, and up to four squadmates.
- `/stats`: filter winrates by mode, map, player, role, or hero; choose a pie or line chart.
- `/leaderboard`: server rankings for players with at least five recorded matches.
- `/undo`: undo your most recent reported match in this server.
- `/insights`: personalized map and teammate insights.
- `/session`: results from the last 12 hours.

Map, hero, and member autocomplete remain available. Charts use the external QuickChart renderer.

## Deadlock voice reminders

Join voice, then use `/deadlock start`. First spawns get a 30-second warning and a due callout. Small camps, bridge buffs, and Sinners also get recurring reminders. Anyone in the server can use the clock controls:

- `/deadlock start time:4:20` starts at the current game time.
- `/deadlock pause`, `/deadlock resume`, `/deadlock sync time:1:30`, and `/deadlock status` control or inspect the clock.
- `/deadlock stop` stops playback and leaves voice. The bot also leaves when no humans remain.
- `/deadlock schedule` shows saved settings; `/deadlock preview objective:sinners` plays a sample while the timer is stopped.

Only the bot owner can add, edit, or remove saved objectives. For example, `/deadlock objective edit objective:small-camps repeat:2:00 warning:15 repeat-warning:off`. Edits apply on the next start. See the [command and settings guide](docs/deadlock-usage.md) for every option and the default schedule. Camp and Sinner repeats say “check”; they do not detect actual respawns.

## Development

```bash
npm run typecheck       # Application, tests, and configuration
npm run build           # Compile into dist/
npm test                # Unit and isolated SQLite integration tests
npm run test:coverage
npm run check           # Typecheck, build, tests, and dependency audit
npm run check:audio     # Real local synthesis and Opus check; no Discord connection
npm start               # Run the compiled bot
```

Integration tests create and remove temporary SQLite databases, apply the real migration history, and never reset the configured development or production database. The speech integration test uses the installed eSpeak NG and FFmpeg executables. Generated Prisma Client, audio cache, build output, credentials, and database files are ignored by Git.

`npm run wipe:overwatch` permanently deletes all Overwatch match history in the configured database. The old `npm run wipe` remains an alias. Deadlock settings are unaffected.

## Extending the bot

Each game owns its commands, rules, and data access under `src/games/<game>/`. Shared Discord interaction handling, command registration, configuration, logging, and database construction stay outside those directories. Register a game's factory once in `src/games/index.ts`; runtime and command deployment use the same catalog.

- [Architecture and adding a game](docs/architecture.md)
- [Deployment and upgrading](docs/deployment.md)
- [Security review and dependency maintenance](docs/security-review.md)
- [Game module decision](docs/adr/0001-game-owned-features.md)
- [Project terminology](GLOSSARY.md)
- [Deadlock usage](docs/deadlock-usage.md) and [design](docs/deadlock-voice-timers.md)
