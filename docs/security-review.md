# Security and dependency review

Reviewed October 22, 2026 as part of the game-module refactor. This covers the repository's dependency tree, runtime and workflow configuration, current text files for selected secret patterns, and the command/database paths changed in the refactor. It is not a penetration test or a full Git-history secret audit.

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
- A current text-file scan for private keys, Discord-token patterns, and AWS access-key patterns found no matches. Values were not printed. This targeted scan does not establish that every possible credential format or historical commit is clean.

## Remaining deployment checks

The actual Oracle VM runtime, systemd executable, architecture, and OS patch level were not accessible in this repository review. Install/select the supported Node runtime for both SSH and systemd, and migrate the live database outside the checkout before the first release. The workflow checks its executing runtime and refuses destructive database checkout changes.

The SSH action now accepts `ORACLE_HOST_FINGERPRINT`. Its actual value was unavailable; configure a fingerprint obtained through a trusted route to enable host verification through that field. QuickChart remains an external renderer receiving chart data, as before. No Discord login, slash-command publication, SSH connection, or live deployment was performed by this review.

## Maintenance

Verification completed with a clean Node 24 install, application/test typechecking, compilation, all 48 tests, V8 coverage generation, and a clean full dependency audit. The six existing slash-command JSON definitions also match those produced from the original checkout exactly. Coverage generation was checked for tooling compatibility; it does not imply every command branch or production integration is tested.

Use `npm ci` and commit `package-lock.json` with dependency changes. Run `npm run check`; use `npm run test:coverage` when changing coverage tooling. Keep Prisma packages and Vitest/coverage packages aligned. Review the release notes and run a clean install when changing native dependencies or the Node runtime. Update `.node-version`, `.nvmrc`, and `engines.node` together for Node security releases. Deployment details and runtime limitations are in [deployment.md](deployment.md).
