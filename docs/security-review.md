# Security and dependency review

The original review ran on October 22, 2026 during the game-module refactor, with an audio update on October 26. The November 9 documentation audit checked the current code, workflows, and asset handling described below. Neither review is a penetration test or a full Git-history secret audit.

## Dependencies and runtime

The October upgrade reduced `npm audit` findings from 15 to zero. That result describes the registry advisories at the time. `npm run check` and CI rerun the full audit, including development dependencies, and fail on any reported severity.

The repository requires Node 24.22.1 or a newer Node 24 patch. Runtime pins, package engines, strict installation checks, and the runtime-check script agree on this requirement. The minimum includes the [October 21 Node security release](https://nodejs.org/en/blog/release/v24.22.1).

On November 9, 2026, the documentation audit reran the existing suite under Node 24.22.1. All 107 tests passed, the audio probe read the tones and five spoken clips, and `npm audit --audit-level=low` reported zero vulnerabilities.

The upgraded dependency families include Discord.js 14.27, Prisma/client/SQLite adapter 7.10, TypeScript 7, Vitest/coverage 5, Zod 4, dotenv 18, Pino 10, and QuickChart 4. Use the lockfile for exact versions. A clean install may emit a transitive `prebuild-install` deprecation notice from the native SQLite driver. A deprecation notice and a vulnerability advisory are different findings.

Deadlock uses `@discordjs/voice` with DAVE support. It plays checked-in tones and spoken Ogg Opus clips. Runtime playback does not invoke FFmpeg, a speech engine, or an external speech API. Voice generation is a separate development command that sends supplied objective names to OpenRouter using `OPENROUTER_API_KEY`, then invokes FFmpeg to encode the result.

## Application and data handling

- Shared interaction routing rejects direct messages before invoking game code. It catches command failures and failures to send error replies.
- The registry rejects duplicate game IDs and command names. The client permits user mentions but disables automatic role and everyone mentions. Counter-guide payloads disable all mention parsing.
- Environment validation requires the Discord token, application ID, guild ID, and SQLite URL. Logging redacts selected token and authorization fields. These rules are not a general secret detector; avoid logging credentials under other fields.
- Production statistics queries bind SQL values. Integration tests use temporary SQLite databases and apply the real migrations without resetting the configured database.
- Database files, journals, generated code, and environment variants are ignored by Git. Historical Git commits still contain old database snapshots. The October targeted text scan found no selected credential patterns; this audit did not repeat that scan or establish that Git history is secret-free.
- The deployment checkout guard rejects tracked SQLite deletions when the files still exist. It is not a backup. The workflow resets the checkout and runs migrations, so a stopped-service database checkpoint is an operator step. See [deployment](deployment.md).
- Only the configured owner, application owner, or team owner can edit a saved Deadlock schedule. Server members share clock controls and previews. Settings validation, sound preparation, and revision-checked writes preserve a prior schedule when an edit fails or conflicts.
- Audio paths use fixed tone filenames or validated objective IDs inside `assets/deadlock/voice/`. Playback queues are bounded, expire stale cues, and cancel pending playback on stop. The bot sends audio and observes voice membership; it does not receive or record user speech.
- Counter guides send local PNGs and authored text. Lookups make no item API or AI requests. Button IDs encode a version, hero, and page; command handling validates them before rendering. The development asset refresher restricts image hosts and validates PNG signatures.

## External services

Discord receives bot messages and voice playback. Overwatch charts use QuickChart, which receives the chart configuration and values. Counter guides need no runtime item service. The optional development generators contact OpenRouter for voices and Deadlock API for item metadata and artwork.

Keep `.env`, SSH keys, database backups, and private recovery material out of Git. The bot host needs no OpenRouter key unless someone intentionally runs the development generator there.

## CI and deployment

Checkout, setup-node, and SSH actions are pinned to commit hashes. Workflows use read-only repository permissions and do not persist checkout credentials. Pull requests run checks; pushes to `main` run those checks before the Oracle deployment. The deploy job selects the checked commit and serializes releases without cancelling one midway through.

The workflow accepts `ORACLE_HOST_FINGERPRINT`. Configure a SHA256 host-key fingerprint obtained through a trusted route. This audit did not inspect repository secret values or confirm whether the fingerprint is set.

The local Artemis Manager deployment record documents Oracle runtime installation and successful releases through November 9. It records an external database, supported Node runtime, service startup, preserved history, and bundled asset checks. Those dated results supersede the original review's uninspected-host status. This documentation audit did not connect to Oracle or verify its OS patch level.

Live voice playback, counter-guide rendering, and shared pagination remain pending as structured interactive checks in that record. See the [deployment smoke tests](deployment.md#deadlock-setup). Payload tests, Opus probes, and Discord login do not prove client rendering or voice connectivity.

## Maintenance

Use `npm ci` and commit `package-lock.json` with dependency changes. Run `npm run check`; run `npm run test:coverage` when changing coverage tooling. Keep Prisma packages and Vitest/coverage packages aligned. Repeat a clean install and checks when changing native dependencies or Node. Update `.node-version`, `.nvmrc`, and `engines.node` together when raising the runtime minimum.

The [original timer review](deadlock-review.md) and [sound revision review](deadlock-sounds-review.md) retain their dated findings, regressions, and test counts. They do not describe the current dependency advisory state or establish live Discord behavior.
