# Deployment and upgrading

## Runtime

Use Node 24.22.1 or a newer Node 24 patch on developer machines, CI, and the Oracle VM. `.node-version` and `.nvmrc` pin the tested release. `package.json` and `.npmrc` reject unsupported installs. `npm run runtime:check` checks the executing binary. The minimum version includes the [October 21, 2026 security fixes](https://nodejs.org/en/blog/release/v24.22.1).

The workflow checks Node but does not install it on the VM. The SSH deployment shell and systemd's `ExecStart` must use a supported binary. Selecting a version in an interactive nvm shell does not change a unit with an absolute Node path.

Inspect the service with `sudo systemctl cat tu-tio-bot`. Run `scripts/check-runtime.mjs` using the exact executable in `ExecStart`. After any unit edit, run `sudo systemctl daemon-reload`. Install native SQLite dependencies under the target runtime and architecture.

### Recorded Oracle setup

Artemis Manager's local `actions/tu-tio-bot-deployment.md` record records the November 9, 2026 release on Oracle Linux 8.10 ARM64:

- The checkout is `/opt/tu-tio-bot/app`, and `tu-tio-bot.service` runs as `opc`.
- The shell and service use `/opt/tu-tio-bot/runtime/node-v24.22.1/bin/node`.
- The live database is `/opt/tu-tio-bot/data/data.sqlite`, outside the checkout.
- SELinux blocks service execution from the home-directory nvm installation. The runtime under `/opt` retains its distribution symlinks and standard SELinux labels.
- Native SQLite installation uses the existing GCC Toolset 13 through explicit `CC` and `CXX` settings. Its ARM64 prebuilt binary required a newer GLIBC than this host provided.

The record includes runtime installation, backups, and recovery instructions. Inspect the host before changing these settings. This documentation audit did not repeat the host checks.

## Database safeguards

Before upgrading, stop the bot and create a consistent SQLite backup outside the checkout. Use SQLite's backup API or backup command. Copying only the main file while a journal or WAL is active can lose data. Record the current release and database path with the backup.

Keep the configured `DATABASE_URL`. Relative `file:./dev.db` resolves to `prisma/dev.db` in both the migration CLI and application; absolute `file:/...` URLs keep their location. The adapter uses millisecond timestamps to read existing Overwatch dates. Apply the migration history with `prisma migrate deploy`. Never use `prisma migrate reset` or `prisma db push --force-reset` on the live database.

Production databases should stay outside the checkout. The service account needs write access to the database and its directory. If upgrading an older checkout that still tracks SQLite snapshots, take consistent backups and archive those files before replacing the checkout. The deployment guard rejects tracked database deletions when the files still exist. It does not create a backup or protect unrelated local changes from the workflow's `git reset --hard`.

The recorded Oracle database was already external. Do not relocate it or restore old development snapshots as part of a normal upgrade.

## Build and release

Merge a reviewed PR into `main` to release. A push to `main` starts `.github/workflows/deploy.yml`. It first calls the reusable checks workflow, which installs from the lockfile, typechecks, builds, runs isolated tests, and audits dependencies. The deployment job then builds on the runner before connecting to Oracle.

On Oracle, the workflow fetches `main`, runs the target commit's database checkout guard, and resets the checkout to the checked commit. It checks Node, installs dependencies, probes all bundled audio, applies migrations, builds, registers guild commands, and restarts systemd. Deployments run one at a time; newer pushes do not cancel an active release.

The workflow does not stop the bot before installation or create a database backup. Arrange the stopped-service checkpoint before merging the release PR, and do not run a manual deployment alongside Actions. If deployment fails while the service is stopped, inspect how far it got before deciding whether to finish the release or restore the previous code and dependencies.

The deployment account needs repository access and permission to restart `tu-tio-bot`. Keep `.env` out of Git and supply the values in `.env.example`. Set `NODE_ENV=production` for systemd. Ensure deployment and the service use the same absolute database URL.

### Manual release

Use this sequence only when no automated deployment is running. Complete the backup and checkout preflight above, then select the intended checked commit without discarding local configuration or data. From `/opt/tu-tio-bot/app`, with the supported runtime selected, run:

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

Include development dependencies because TypeScript, tsx, and the Prisma CLI are build and deployment tools. Command registration failures exit nonzero. Keep the entire `assets/deadlock/` directory, including voice clips and counter-guide PNGs.

### Release verification and rollback

Confirm the deployed commit, active service, expected Node executable, and successful Discord login in the logs. Check SQLite integrity, foreign keys, migration status, and preservation of existing history against the checkpoint. Recheck private configuration without printing credentials. Run `npm run check:audio` as the service account.

For a code rollback, preserve a fresh backup of the current database, then release a revert through the same checks. Reinstall dependencies and rebuild if restoring an older code version. Restoring an older database discards later writes and is a separate disaster-recovery decision.

## GitHub configuration

The workflow uses `ORACLE_HOST`, `ORACLE_USER`, `ORACLE_SSH_KEY`, and `ORACLE_PORT` secrets. It accepts `ORACLE_HOST_FINGERPRINT` for SSH host verification. Set it to the VM's SHA256 host-key fingerprint obtained through a trusted route. Without it, the SSH action cannot verify the host through that field. This audit did not inspect repository secret values or confirm that it is set.

Actions are pinned to commit hashes. Dependabot checks npm and GitHub Actions weekly. Run `npm run check` on dependency changes. Keep Prisma packages and Vitest/coverage packages in matching release families. When raising the minimum Node version, update `.node-version`, `.nvmrc`, and `engines.node` together, then repeat a clean install and checks.

## Deadlock setup

### Voice

Beep, ding, and spoken warnings are checked-in Ogg Opus files under `assets/deadlock/`. The service account must be able to read them. Playback needs no FFmpeg, speech engine, audio cache, speech API key, or extra JavaScript Opus encoder. The voice library includes DAVE support.

`npm run check:audio` verifies that every default objective has a spoken clip and reads the tones and all bundled voice clips through the Opus playback pipeline. It does not join Discord. `DEADLOCK_AUDIO_DIR` is retired. Developers need FFmpeg to regenerate tones or voices, and `OPENROUTER_API_KEY` to generate voices. See the [asset notes](../assets/deadlock/README.md).

Grant View Channel, Connect, and Speak in a regular voice channel. The module requests `GuildVoiceStates`; there is no privileged voice intent to enable in the portal. Allow Discord voice's outbound UDP connectivity. Set `BOT_OWNER_ID` to override the application or team owner's identity for saved-schedule edits.

After deployment, join voice and run these checks against the saved schedule:

1. Use `/deadlock preview objective:sinners` to verify join, ding, and leave.
2. Use `/deadlock preview objective:small-camps kind:first-warning` to check the saved advance warning. It speaks by default.
3. With small camps at the built-in defaults, start at `time:1:25`. Expect the spoken warning at 1:30, countdown beeps at 1:55 through 1:59, and a ding at 2:00. If spoken warnings are off, expect a beep at 1:30.
4. Check pause/resume, backward sync, stop, and leaving when the last human leaves. After a bot restart, start again at the current game time.

The deployment record leaves this structured interactive test pending. Local audio checks and Discord login do not prove voice playback or UDP connectivity.

### Counter guides

Grant View Channel, Send Messages, Embed Links, and Attach Files in the text channel. Run `/deadlock counter hero:Abrams`, confirm a friend can see the pictures, and use More options and Back. The November 9 record confirms registered command definitions, readable artwork, and calculated permissions; it leaves client rendering and shared navigation pending.

See the [usage guide](deadlock-usage.md) for commands and settings, and [counter guide maintenance](deadlock-counter-guides.md) for content and artwork updates.
