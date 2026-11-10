# Tu Tio Bot

A Discord bot for our server, with independent Overwatch match tracking, Deadlock counterbuying guides, and Deadlock sound reminders.

## Requirements

Use Node 24.22.1 or a newer Node 24 patch, with npm. The pinned version is in [.node-version](.node-version) and [.nvmrc](.nvmrc). This baseline includes the [October 21, 2026 Node security release](https://nodejs.org/en/blog/release/v24.22.1).

Deadlock uses bundled beep and ding sounds, plus pre-recorded spoken warnings that name each default objective. Built-in objectives speak by default. The bot host needs no speech engine, FFmpeg, or writable audio cache. Run `npm run check:audio` to verify the Opus assets locally.

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

5. Enable Server Members Intent in the Discord Developer Portal for Overwatch member autocomplete. Invite the bot with `bot` and `applications.commands` scopes. Grant View Channel and Send Messages in its text channels, plus Embed Links and Attach Files for counter guides and charts. For Deadlock voice reminders, grant View Channel, Connect, and Speak in a regular voice channel. Register commands and start:

   ```bash
   npm run deploy
   npm run dev
   ```

For a production install or an existing Oracle VM, follow [deployment and upgrading](docs/deployment.md).

## Overwatch commands

- `/match add`: record a win, loss, or draw, with map, optional role/hero, and up to four squadmates.
- `/stats`: filter winrates by mode, map, player, role, or hero; choose a pie or line chart.
- `/leaderboard`: server rankings for players with at least five recorded matches.
- `/undo`: undo your most recent reported match in this server.
- `/insights`: personalized map and teammate insights.
- `/session`: results from the last 12 hours.

Map, hero, and member autocomplete remain available. Charts use the external QuickChart renderer.

## Deadlock counterbuying

Use `/deadlock counter hero:Abrams` to share item recommendations in the current channel. Guides explain why and when to buy each item, include bundled pictures, and retain matchup warnings. Anyone can use More options and Back to browse the public guide. No voice connection or active timer is required.

The initial 38 guides summarize a supplied YouTube transcript and are labeled Patch unverified. They are manually maintained; the bot does not generate advice or fetch game data during a lookup. See [guide content and maintenance](docs/deadlock-counter-guides.md). Grant Embed Links and Attach Files in the text channel, in addition to permission to send messages.

## Deadlock sound reminders

Join voice, then use `/deadlock start`. By default, built-in objectives get a spoken warning 30 seconds before their first reminder, countdown beeps for the final five seconds, and a distinct ding when due. Each part is optional. Small camps, bridge buffs, and Sinners also get recurring reminders. Anyone in the server can use the clock controls:

- `/deadlock start time:4:20` starts at the current game time.
- `/deadlock pause`, `/deadlock resume`, `/deadlock sync time:1:30`, and `/deadlock status` control or inspect the clock.
- `/deadlock stop` stops playback and leaves voice. The bot also leaves when no humans remain.
- `/deadlock schedule` shows saved settings; `/deadlock preview objective:sinners` plays a sample while the timer is stopped.

Only the bot owner can add, edit, or remove saved objectives. For example, `/deadlock objective edit objective:small-camps warning:30 countdown:5 announce:true`. Edits apply on the next start. The owner can use `/deadlock spoken enabled:false` to switch advance warnings to beeps. See the [command and settings guide](docs/deadlock-usage.md) for every option and the default schedule. Repeated camp and Sinner sounds are farming reminders, not detected respawns.

## Development

```bash
npm run typecheck       # Application, tests, and configuration
npm run build           # Compile into dist/
npm test                # Unit and isolated SQLite integration tests
npm run test:coverage
npm run check           # Typecheck, build, tests, and dependency audit
npm run check:audio     # Check tones and spoken clips; no Discord connection
npm start               # Run the compiled bot
```

Integration tests create and remove temporary SQLite databases, apply the real migration history, and never reset the configured development or production database. Audio integration tests read the bundled Ogg Opus sounds through the Discord playback pipeline. Generated Prisma Client, build output, credentials, and database files are ignored by Git.

`npm run wipe:overwatch` permanently deletes all Overwatch match history in the configured database. The old `npm run wipe` remains an alias. Deadlock settings are unaffected.

## Extending the bot

Each game owns its commands, rules, and data access under `src/games/<game>/`. Shared Discord interaction handling, command registration, configuration, logging, and database construction stay outside those directories. Register a game's factory once in `src/games/index.ts`; runtime and command deployment use the same catalog.

- [Architecture and adding a game](docs/architecture.md)
- [Deployment and upgrading](docs/deployment.md)
- [Security review and dependency maintenance](docs/security-review.md)
- [Game module decision](docs/adr/0001-game-owned-features.md)
- [Project terminology](GLOSSARY.md)
- [Deadlock usage](docs/deadlock-usage.md) and [design](docs/deadlock-voice-timers.md)
- [Counter guide content and artwork](docs/deadlock-counter-guides.md)

The [timer review](docs/deadlock-review.md) and [sound revision review](docs/deadlock-sounds-review.md) record the October 2026 implementations. Their test counts and deployment status describe those reviews, not the current release.
