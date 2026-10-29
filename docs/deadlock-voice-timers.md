# Deadlock sound timers

Status: implemented design, revised October 26, 2026 to replace spoken announcements with beeps and dings, and October 28, 2026 to add optional pre-recorded spoken warnings. See the [command guide](deadlock-usage.md), [architecture](architecture.md), and [deployment prerequisites](deployment.md). Live Discord/Oracle voice playback still needs deployment validation.

## Purpose

Help three friends learning Deadlock remember objectives through short sound reminders. A player manually starts the match clock in Discord. Objective names, timings, recurrence, advance beeps, countdowns, and due dings can be changed through Discord as the game or the players' preferences change.

## Agreed scope

- Support one active match clock per Discord server. Start joins the caller's voice channel. Clock controls are shared among the friends.
- Provide start, stop, pause, resume, sync-to-current-match-time, and a way to inspect the clock and schedule. Start can accept elapsed time for late starts.
- Use match-clock reminders without game-state, speech, or camp-clear detection.
- Only the bot owner manages the saved schedule. Add, edit, disable, and remove objectives through Discord without deploying code or recording audio manually.
- Save objective settings across bot restarts. Schedule edits affect the next start; an active match retains its original settings and callouts.
- Begin with small camps, medium camps, large camps, bridge powerups ("bridge buffs"), and Sinner's Sacrifice ("Sinners"). Sinners must include recurring checks as well as the first reminder at 8:00.
- Use a short beep for advance warnings and countdowns, and a distinct bell-like ding at the scheduled time. Each objective can optionally replace its advance beeps with a pre-recorded clip that names it, so players can tell beeps apart while learning.

## Editable objective settings

The agreed choices define editable initial defaults. Each objective supports:

- A name and an enabled/disabled setting.
- Its first scheduled time.
- Whether a first-time advance warning and due callout play, and how early the warning plays.
- Whether reminders repeat and their interval. The first repeat is one interval after the first scheduled time.
- Whether repeating reminders have advance warnings and due callouts, with a configurable warning lead time.
- An independently optional countdown of 1–30 seconds for first and recurring reminders. It beeps once per second from T−N through T−1; the due ding replaces a beep at T.

Advance beeps, countdowns, and due dings can be toggled independently for first and recurring reminders. Owners can change their lead times and enable recurring countdowns without changing code. Warnings and countdowns must fit between match start and the first time, or within the repeat interval.

## Initial defaults

These defaults were accepted as part of the design and can be edited in Discord:

- **Small camps:** first at 2:00; reminders every 90 seconds afterward, starting at 3:30. This repeat interval follows the user's original example and is a reminder preference.
- **Medium camps:** first at 5:00; repeats initially disabled.
- **Large camps:** first at 8:00; repeats initially disabled.
- **Bridge buffs:** first at 5:00; repeat every five minutes, at 10:00, 15:00, and so on.
- **Sinners:** first at 8:00; reminders every five minutes afterward, starting at 13:00.

First reminders default to a 30-second advance beep, a five-second countdown, and a due ding. For a 2:00 objective, this means a beep at 1:30, one beep each at 1:55–1:59, and a ding at 2:00. Repeats default to a due ding only. All three parts are independently optional for both first and repeat reminders. Coalesce simultaneous beeps into one; a due ding takes priority over a beep at the same instant. Spoken warnings are off by default; when enabled, coinciding spoken warnings each play after any ding instead of a beep. New objectives use these defaults. Earlier saved speech schedules preserve their existing advance/due settings and start with countdowns off until explicitly enabled.

## Clock and voice behavior

- Pause freezes the match clock and prevents scheduled callouts until resume.
- Syncing forward skips callouts passed by the correction; never play a backlog.
- Syncing backward re-arms future callouts, including ones already played. For example, the 2:00 callout fires again after rewinding to 1:30 and reaching 2:00 again.
- Stop ends playback and leaves voice. Also stop and leave when no human participants remain in the channel.
- A permanent voice-connection failure or bot restart ends the active timer. Players manually start again at the current match time. Automatic recovery and concurrent matches within the same server are outside the first version.

## Audio assets

Use the checked-in `assets/deadlock/beep.ogg` and `ding.ogg` sounds. Both are stereo 48 kHz Ogg Opus and shorter than one second. Spoken warnings are `assets/deadlock/voice/<objective-id>.ogg`, recorded once with OpenRouter text-to-speech by `npm run generate:voices` and checked in. The host requires no speech tooling, FFmpeg, audio cache, API key, or synthesis service. The development-only generators use FFmpeg; they are not part of deployment or playback. A custom objective can be spoken only after its clip is generated and deployed.

Validate enabled sounds before committing schedule edits. A missing asset leaves the prior saved schedule unchanged and explains the failure in Discord. Preview supports a due ding, advance beep, or one countdown beep sample. Timing edits reuse the same assets. Countdown ticks older than one second are dropped after stalls; other missed reminders retain the existing two-second grace, preventing a backlog. No beep plays at the due instant when the ding is enabled.

## Timing evidence and accuracy boundary

The proposed first-spawn values are community-reported current schedules with moderate confidence; they are not a complete current timetable verified from Valve. References: [Deadlock Labs](https://deadlocklabs.gg/tools/map/), [SenseOS camp guide](https://senseos.gg/guides/deadlock/jungle-camps/), [powerup wiki](https://deadlock.wiki/Powerups).

Camp and Sinner respawns depend on clearing or destroying the objective. Without those inputs, repeating reminders cannot establish actual availability. Recurring camp and Sinner sounds are approximate farming reminders and do not establish a respawn. For example, 8:00, 13:00, and 18:00 are proposed Sinner reminder times, not guaranteed spawn times. The [Sinner community reference](https://deadlock.wiki/Sinner) reports a five-minute respawn after destruction or full clearance at hybrid locations.

Historical official evidence supports, but does not establish live behavior as of October 22, 2026:

- Valve's [March 16, 2025 update](https://forums.playdeadlock.com/threads/03-16-2025-update.58880/) moved Sinners' first spawn to 8:00 and retained a five-minute respawn. The official page was rate-limited during research; [SteamDB's transcription](https://steamdb.info/patchnotes/17745934/) preserved the wording.
- Valve's [June 27, 2024 update](https://forums.playdeadlock.com/threads/06-27-2024-update.8486/) established five-minute powerup recurrence; the [May 8, 2025 update](https://store.steampowered.com/news/app/1422450/view/524216645064852902) moved the first powerup spawn to 5:00.
- The [November 21, 2025 notes](https://forums.playdeadlock.com/threads/11-21-2025-update.90383/) reduced small-camp respawn duration. The [January 20, 2026 follow-up](https://forums.playdeadlock.com/threads/12-29-2025-update.95233/#post-198450) reduced neutral respawn times while explicitly excluding Sinners. Neither establishes a fixed global recurrence for camps or Sinners.

## Repository feasibility and deployment prerequisites

The `src/games/deadlock/` module is registered in `src/games/index.ts`. Deadlock commands, timing rules, objective settings, and voice/timer state live within that module under a distinct `/deadlock` command root. The module declares the voice-state intent alongside its commands; the shared registry combines it with other games' intents. Shared Discord routing and infrastructure remain game-neutral.

The `DeadlockSchedule` Prisma model stores each server's validated schedule and revision in shared SQLite infrastructure. The existing `Match` and `MatchPlayer` tables belong to Overwatch. Active timers remain in memory.

The project and CI target Node 24.22.1 or a newer Node 24 patch. The installed `@discordjs/voice` 0.19.2 includes its supported DAVE implementation. Bundled Ogg Opus playback needs no extra JavaScript Opus encoder or external audio executable. Production needs readable sound assets, channel access, Connect/Speak permissions, and working UDP connectivity. Local asset playback through Opus demuxing is verified; actual VM runtime, architecture, and voice connectivity remain unverified. Follow [deployment and upgrading](deployment.md), then validate join, playback, and leave.

References: [voice connections](https://discordjs.guide/voice/voice-connections), [release package requirements](https://github.com/discordjs/discord.js/blob/%40discordjs%2Fvoice%400.19.2/packages/voice/package.json), [Discord voice protocol](https://docs.discord.com/developers/topics/voice-connections).
