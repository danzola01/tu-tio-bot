# Security and dependency review

Reviewed October 22, 2026 as part of the game-module refactor and Deadlock implementation, with audio/dependency validation updated October 26 for sound reminders. This covers the repository's dependency tree, runtime and workflow configuration, current text files for selected secret patterns, and the changed command/database/voice paths. It is not a penetration test or a full Git-history secret audit.

## Dependency findings

The initial full `npm audit` reported **15 package findings: 8 high, 6 moderate, and 1 low**. The upgraded lockfile reports **zero known findings**, including development dependencies. This is the registry advisory result at review time, not a guarantee against future advisories. `npm run check` and CI rerun the full audit and fail on any reported severity.

Stable dependencies were updated, including:

- Discord.js 14.25.1 to 14.27.0.
- Prisma/client 5.22.0 to 7.10.1, with the matching SQLite adapter.
- TypeScript 5.9.3 to 7.0.2 and tsx 4.21.0 to 4.23.15.
- Vitest and its V8 coverage package 4.1.0 to 5.0.5.
- Zod 3.25.76 to 4.6.7; dotenv 16.6.1 to 18.0.9.
- Pino 9.14.0 to 10.4.0; pino-pretty 11.3.0 to 13.2.0.
- QuickChart 3.1.3 to 4.0.0, retaining the chart configuration version used by the existing graphs.
- Node type definitions from the 20.x line to 24.19.2, matching the supported runtime family.

Updated transitive packages resolve the reported Undici, ws, lodash, nanoid, fast-copy, Vite/Vitest, PostCSS, picomatch, source-map-js, and esbuild findings. No forced audit upgrade, prerelease dependency, or audit suppression was used. Prisma's npm CLI `latest` tag pointed at an 8.0 release candidate; the tested Prisma/client/adapter family remains on stable 7.10.1. Node 26 type definitions are deliberately not used for a Node 24 project.

A clean install still emits an upstream `prebuild-install` deprecation notice from the current native SQLite driver. That transitive installer remains in the supported Prisma adapter's dependency tree; the full advisory audit is clean.

Deadlock adds `@discordjs/voice` 0.19.2 and its supported DAVE implementation. Audio now uses original bundled Ogg Opus tones; the runtime no longer invokes eSpeak NG, FFmpeg, or a speech provider.

## Runtime and CI

Node 20 in the old deployment workflow is [end-of-life](https://nodejs.org/en/about/previous-releases). The project now targets Node 24.22.1 or a later Node 24 patch. [24.22.1 is an official security release](https://nodejs.org/en/blog/release/v24.22.1). Runtime pins, package engines, strict install checking, and production-start checking agree on this requirement. Verification uses Node 24, rather than the host's older default binary.

Checkout, setup-node, and SSH actions were upgraded and pinned to release commit hashes. Workflows have read-only repository permissions, do not persist checkout credentials, run checks before deployment, deploy the checked commit, and avoid cancelling an active deployment midway through. Dependabot checks npm and Actions weekly.

## Application and data handling

- Shared interaction routing rejects direct messages before reaching guild-dependent game code. Command failures and failed error replies are caught and logged.
- Duplicate command names fail during composition rather than routing to another game's handler. The bot allows user mentions, with role and everyone mentions disabled.
- Logging redacts known token/authorization fields. Environment validation remains centralized.
- Existing production statistics queries continue to bind SQL values. Tests no longer construct raw `DELETE` statements from table names.
- Committed development/test SQLite files were removed from the Git index while local copies were preserved. Database files, journals, generated code, and environment variants are ignored. Existing Git history still contains historical database snapshots; this change does not rewrite it.
- A deployment preflight refuses a checkout change that would remove an existing SQLite file. This protects the initial transition away from tracked snapshots. See [upgrade instructions](deployment.md).
- Integration tests use unique temporary databases and the real migrations, so they cannot reset the configured live database. Regression checks cover old SQLite timestamp storage, existing match commands, autocomplete routing, and both chart types.
- Deadlock schedule mutations require the configured/application/team owner. All server members can control its single clock. Objective data is strictly validated and SQLite updates use a revision guard. Audio preparation completes before committing edits, preserving the previous schedule on failure.
- Runtime audio resolves two fixed bundled files, without subprocesses, user-provided paths, or a writable cache. Playback queues are bounded and stop/dispose cancels pending playback. The development-only tone generator invokes FFmpeg through an argument array with a timeout.
- Deadlock requests voice states and sends audio; it does not receive or record user speech. Discord voice uses the library's DAVE support. No audio wording or recordings are stored. Earlier speech-format schedules are read as sound settings without synthesizing their retired text.
- A current text-file scan for private keys, Discord-token patterns, and AWS access-key patterns found no matches. Values were not printed. This targeted scan does not establish that every possible credential format or historical commit is clean.

## Remaining deployment checks

The actual Oracle VM runtime, systemd executable, architecture, and OS patch level were not accessible in this repository review. Install/select the supported Node runtime for both SSH and systemd, and migrate the live database outside the checkout before the first release. The workflow checks its executing runtime and refuses destructive database checkout changes.

The SSH action now accepts `ORACLE_HOST_FINGERPRINT`. Its actual value was unavailable; configure a fingerprint obtained through a trusted route to enable host verification through that field. QuickChart remains an external renderer receiving chart data, as before. No Discord login, slash-command publication, SSH connection, or live deployment was performed by this review.

## Maintenance

The architecture upgrade was verified with a clean Node 24 install, all 48 baseline tests, V8 coverage generation, and unchanged JSON definitions for the six existing slash commands. Coverage generation was checked for tooling compatibility; it does not imply every command branch or production integration is tested.

The Deadlock full check passed typechecking, compilation, all 73 tests then present, and a full audit with zero findings. Subsequent review fixes passed the affected command/match/voice tests, adding seven lifecycle regressions, with typechecking and compilation passing afterward. The clock suite also covers independent recurring warnings; application/team ownership is checked at the command boundary. The earlier speech implementation was tested locally; the October 26 sound revision replaces that pipeline with bundled beep/ding assets and Opus playback checks. Library diagnostics confirmed DAVE, native AES-256-GCM, and FFmpeg libopus availability. Live Discord/Oracle voice behavior remains unverified. See the [Deadlock code review](deadlock-review.md).

Use `npm ci` and commit `package-lock.json` with dependency changes. Run `npm run check`; use `npm run test:coverage` when changing coverage tooling. Keep Prisma packages and Vitest/coverage packages aligned. Review the release notes and run a clean install when changing native dependencies or the Node runtime. Update `.node-version`, `.nvmrc`, and `engines.node` together for Node security releases. Deployment details and runtime limitations are in [deployment.md](deployment.md).

The October 26 sound revision passed the full check with 85 tests and zero npm audit findings. The final overlap regression and fix passed all 19 affected clock/voice/match tests, plus typechecking and compilation. Bundled beep/ding Opus checks also passed, with no runtime synthesis tools or writable cache. See the [sound revision review](deadlock-sounds-review.md) for findings and resolutions.
