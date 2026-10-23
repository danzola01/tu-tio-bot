# Tu Tio Bot

A Discord bot for our server, organized into independent game modules. Overwatch match tracking is implemented. The [Deadlock voice timer design](docs/deadlock-voice-timers.md) is agreed and ready for a separate implementation.

## Requirements

Use **Node 24.22.1 or a newer Node 24 patch**, with npm. The pinned version is in [.node-version](.node-version) and [.nvmrc](.nvmrc). This baseline includes the [October 21, 2026 Node security release](https://nodejs.org/en/blog/release/v24.22.1).

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

5. Enable **Server Members Intent** in the Discord Developer Portal for Overwatch member autocomplete, invite the bot with `bot` and `applications.commands` scopes, and give it access to its text channels. Register commands and start:

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

## Development

```bash
npm run typecheck       # Application, tests, and configuration
npm run build           # Compile into dist/
npm test                # Unit and isolated SQLite integration tests
npm run test:coverage
npm run check           # Typecheck, build, tests, and dependency audit
npm start               # Run the compiled bot
```

Integration tests create and remove temporary SQLite databases, apply the real migration history, and never reset the configured development or production database. Generated Prisma Client, build output, credentials, and database files are ignored by Git.

`npm run wipe:overwatch` permanently deletes all Overwatch match history in the configured database. The old `npm run wipe` remains an alias. This is unrelated to other games' future data.

## Extending the bot

Each game owns its commands, rules, and data access under `src/games/<game>/`. Shared Discord interaction handling, command registration, configuration, logging, and database construction stay outside those directories. Register a game's factory once in `src/games/index.ts`; runtime and command deployment use the same catalog.

- [Architecture and adding a game](docs/architecture.md)
- [Deployment and upgrading](docs/deployment.md)
- [Security review and dependency maintenance](docs/security-review.md)
- [Game module decision](docs/adr/0001-game-owned-features.md)
- [Project terminology](GLOSSARY.md)
- [Planned Deadlock feature](docs/deadlock-voice-timers.md)
