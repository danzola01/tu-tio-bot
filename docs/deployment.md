# Deployment and upgrading

## Runtime

Use Node **24.22.1 or a newer Node 24 patch** on developer machines, CI, and the Oracle VM. `.node-version` and `.nvmrc` pin the tested release; `package.json` and `.npmrc` reject unsupported installs. `npm run runtime:check` verifies the actual executing binary. Node 20 is [end-of-life](https://nodejs.org/en/about/previous-releases); 24.22.1 is a [security release](https://nodejs.org/en/blog/release/v24.22.1).

The checked-in runtime configuration does not install Node on the existing VM. Before its next deployment, install the supported Node version using your existing OS/package or version-manager setup. Ensure the SSH deployment shell and systemd's `ExecStart` both use that binary. Updating an interactive nvm shell alone does not change a systemd unit with an absolute Node path.

Inspect the existing service with `sudo systemctl cat tu-tio-bot`. Run `scripts/check-runtime.mjs` using the exact Node executable referenced by its `ExecStart`, and adjust the unit if needed. After any unit edit, run `sudo systemctl daemon-reload`. Native SQLite dependencies must be installed under the target Node version; do not copy `node_modules` from an older runtime or another architecture.

## Existing database upgrade

Before upgrading an existing install, stop the bot and take a SQLite-consistent backup outside the checkout, using SQLite's backup command or your existing backup tool. Do not copy only the main file while a journal/WAL is active.

Keep the existing `DATABASE_URL`. For example, `file:./dev.db` continues to resolve to `prisma/dev.db`, and an absolute `file:/...` URL keeps its location. The new adapter explicitly retains the old millisecond timestamp format. Overwatch tables and data retain their existing schema. The additive Deadlock migration creates `DeadlockSchedule`; apply the migration history normally.

Database snapshots are no longer tracked in Git, but the local copies were preserved during the refactor. The release preflight refuses to change the checkout if Git would remove an existing SQLite file. For this first upgrade, move the live database outside the checkout and set an absolute `DATABASE_URL`; archive and remove the old checkout snapshots after taking a consistent backup. The service account must have write access to the new database's directory. Never use `prisma migrate reset` or `prisma db push --force-reset` on the live database.

## Build and release

The deploy workflow runs the reusable checks workflow first. Checks install from the lockfile, typecheck, compile, run isolated tests including bundled sound playback, and run the dependency audit. Only then does deployment connect to Oracle, check for database-file removals, select the exact checked commit, verify the VM runtime, install dependencies, verify bundled Opus sounds, apply migrations, build, register commands, and restart systemd. Deployments are serialized and are not cancelled halfway through by a newer push.

The existing service is named `tu-tio-bot`, and the checkout is `/opt/tu-tio-bot/app`. The deployment account needs repository access and permission to restart that service. Its environment must supply the values from `.env.example`. Keep `.env` outside version control. `NODE_ENV=production` is appropriate for systemd.

Manual release commands, after selecting the correct runtime and checkout:

```bash
node scripts/check-runtime.mjs
npm ci --include=dev
npm run check:audio
npx prisma migrate deploy
npm run build
npm run deploy
sudo systemctl restart tu-tio-bot
sudo systemctl status tu-tio-bot --no-pager
```

Development dependencies are included during the build because TypeScript, tsx, and the Prisma CLI are build/deployment tools. A failed slash-command registration now exits nonzero and prevents a successful-looking deployment.

## GitHub configuration

The workflow uses the existing `ORACLE_HOST`, `ORACLE_USER`, `ORACLE_SSH_KEY`, and `ORACLE_PORT` secrets. It also accepts `ORACLE_HOST_FINGERPRINT` for SSH host verification. Set this to the VM's SHA256 host-key fingerprint obtained through a trusted route. If omitted, the SSH action cannot verify the host through that field; no fingerprint was available in the repository to validate.

Actions are pinned to reviewed release commit hashes. Dependabot checks npm and GitHub Actions weekly. Run `npm run check` on dependency changes and keep Prisma packages and Vitest/coverage packages in matching release families. For a new Node security patch, update `.node-version`, `.nvmrc`, and the minimum `engines.node` version together, then repeat a clean install and checks.

## Deadlock voice setup

The beep, ding, and spoken warnings are checked-in Ogg Opus files under `assets/deadlock/`. Keep that directory in the deployed checkout and allow the service account to read it. No eSpeak NG, FFmpeg, writable audio cache, or speech service is required. The npm voice library includes DAVE support; Ogg Opus playback requires no extra JavaScript Opus encoder.

Run `npm run check:audio` as the service account. It confirms every default objective has a spoken warning and reads each asset through the Discord Opus playback pipeline without joining Discord or writing files. Deployment runs this before migration/restart. `DEADLOCK_AUDIO_DIR` is retired and can be removed from old environments; an old speech cache may be archived or removed after confirming it is unused. FFmpeg is needed only by developers intentionally regenerating the bundled tones with `node scripts/generate-deadlock-sounds.mjs`, or the spoken warnings with `npm run generate:voices` (which also needs `OPENROUTER_API_KEY`).

Grant the bot View Channel, Connect, and Speak in the regular voice channel. `GuildVoiceStates` is requested by the game module; it does not require enabling a privileged voice intent in the portal. Allow the outbound UDP connectivity used by Discord voice. Set `BOT_OWNER_ID` if schedule editing should use an explicit Discord user ID; otherwise application/team ownership is used.

After command registration/restart, join voice and run `/deadlock preview objective:sinners`. Confirm join, a distinct ding, and leave. Start at `time:1:25` and verify the 1:30 advance beep, the 1:55–1:59 countdown beeps, and the 2:00 ding. Check pause/resume, backward sync, stop, and leaving when the last human leaves. A restart requires manually starting at the current game time. The first live Discord/Oracle smoke test remains unperformed; local audio validation does not establish network or permission readiness.

See the [usage guide](deadlock-usage.md) for all commands and editable settings.
