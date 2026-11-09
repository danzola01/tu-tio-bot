# Deadlock sound timers

The timer design is implemented. The October 26, 2026 revision replaced runtime speech synthesis with bundled tones. Later revisions added pre-recorded spoken warnings and made them the default for built-in objectives. See the [command guide](deadlock-usage.md), [architecture](architecture.md), and [deployment checks](deployment.md#deadlock-setup).

## Purpose and scope

The bot helps three friends remember Deadlock objectives through sound reminders. A player starts a clock in Discord and synchronizes it with the game. The bot does not detect game state, speech, objective clears, or respawns.

Each server has one active timer or preview. Start joins the caller's regular voice channel, and server members share clock controls. Only the bot owner can edit the saved schedule. Timings, names, enabled settings, repeats, warnings, countdowns, and due dings can change without deploying code. Custom spoken warnings require a generated clip and a deployment first.

Saved settings survive restarts. An active timer uses a prepared snapshot, so schedule edits apply on the next start. Active clocks stay in memory; after a bot restart, players start again at the current game time.

## Objective settings

Each objective has a stable ID, display name, enabled setting, first time, and optional repeat interval. The first repeat falls one interval after the first time. Renaming preserves the ID and its voice-clip filename.

First and recurring reminders each have independent controls for a due ding, advance warning lead time, and countdown. A countdown lasts 1 to 30 seconds and beeps once per second, ending one second before the due time. Warnings and countdowns must fit before the first time or within the repeat interval. An objective's `spoken` flag selects a recorded clip instead of an advance beep.

## Default schedule

| Objective | First time | Repeat interval |
| --- | --- | --- |
| Small camps | 2:00 | 1:30 |
| Medium camps | 5:00 | Off |
| Large camps | 8:00 | Off |
| Bridge buffs | 5:00 | 5:00 |
| Sinners | 8:00 | 5:00 |

These are the defaults in `src/games/deadlock/objectives.ts`. Small-camp and Sinner repeats are farming reminders; they do not establish actual respawns. A saved schedule may differ from these defaults.

Built-in objectives start with a spoken warning 30 seconds before the first time, a five-second countdown, and a due ding. Repeats start with only a due ding. Custom objectives start with an advance beep, countdown, and due ding; their lead times shorten to fit early first times. Custom repeats stay off unless set when adding or editing the objective.

For small camps, the default first reminder says "Small camps coming up" at 1:30, beeps at 1:55 through 1:59, and dings at 2:00. Turning spoken warnings off changes the 1:30 warning to a beep. Simultaneous beeps become one cue. A due ding or spoken warning replaces coinciding beeps; a ding plays before any spoken warnings at the same time.

The owner can switch spoken warnings for all objectives with `/deadlock spoken`. Enabling skips objectives without a recorded clip and reports their names. Earlier speech-format schedules retain their timing and warning/due settings, discard old text, and default countdowns to off. The `default_spoken_warnings` migration enabled speech for saved built-in objectives.

## Clock and voice behavior

Pause freezes the clock and cancels playback. Resume continues at the paused time. Sync preserves the paused or running state and cancels playback. Forward sync skips passed callouts; backward sync re-arms callouts strictly after the corrected time. A callout exactly at the sync time is skipped.

Start includes preparation and voice-join time in elapsed match time. Stop cancels the attempt or active timer and leaves voice. Moving or kicking the bot, the last human leaving, or a permanent voice failure also ends the timer. Brief reconnects keep the clock moving and skip unavailable playback. Voice recovery has a 20-second deadline.

Every scheduled cue has an absolute monotonic expiry. Countdown ticks expire after one second; other reminders expire after two seconds. Playback checks expiry before each clip starts, so queued sounds cannot extend their lifetime. Multiple spoken warnings can therefore cause later clips to expire before playback.

## Audio assets and validation

The checked-in `assets/deadlock/beep.ogg` and `ding.ogg` files are stereo 48 kHz Ogg Opus and shorter than one second. Recorded warnings live at `assets/deadlock/voice/<objective-id>.ogg`. Playback needs no speech engine, FFmpeg, writable cache, or speech API key. Development generators use FFmpeg, and voice generation also calls OpenRouter. See the [asset notes](../assets/deadlock/README.md).

Schedule writes validate settings and prepare enabled sounds before saving. A missing asset or revision conflict preserves the previous schedule. A preview can play a saved due ding, advance warning, or one countdown sample while the timer is stopped. Warning previews use the objective's selected beep or spoken clip.

## Timing evidence and accuracy boundary

The October 22 design research used community schedules and historical patch notes. This documentation audit checked the configured defaults against the code; it did not verify them against the current game patch. Treat them as editable reminder preferences.

The original community references were [Deadlock Labs](https://deadlocklabs.gg/tools/map/), the [SenseOS camp guide](https://senseos.gg/guides/deadlock/jungle-camps/), the [powerup wiki](https://deadlock.wiki/Powerups), and the [Sinner wiki](https://deadlock.wiki/Sinner).

The historical patch references were Valve's [March 16, 2025 update](https://forums.playdeadlock.com/threads/03-16-2025-update.58880/), [June 27, 2024 update](https://forums.playdeadlock.com/threads/06-27-2024-update.8486/), [May 8, 2025 update](https://store.steampowered.com/news/app/1422450/view/524216645064852902), [November 21, 2025 update](https://forums.playdeadlock.com/threads/11-21-2025-update.90383/), and [January 20, 2026 follow-up](https://forums.playdeadlock.com/threads/12-29-2025-update.95233/#post-198450). Research used [SteamDB's transcription](https://steamdb.info/patchnotes/17745934/) when the March page was rate-limited. These references do not establish current objective availability or fixed global camp respawns.

## Implementation and deployment evidence

The module at `src/games/deadlock/` owns commands, settings, clocks, and voice cleanup under the `/deadlock` root. It declares `GuildVoiceStates`; shared routing and database construction remain outside the game module. `DeadlockSchedule` stores each server's settings and revision. The existing `Match` and `MatchPlayer` tables belong to Overwatch.

The repository tests clock behavior, settings persistence, lifecycle handling, and local Opus playback. The local Artemis Manager deployment record documents a supported Oracle runtime, preserved database history, successful Discord login, and bundled audio checks through November 9. Its structured interactive voice test remains pending. This audit did not repeat host checks or join a voice channel. Follow [deployment](deployment.md) to verify join, playback, and leave.
