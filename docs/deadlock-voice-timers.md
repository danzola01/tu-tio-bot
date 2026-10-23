# Deadlock voice timers

Status: agreed first-version design, confirmed by the user on October 22, 2026. Deadlock feature implementation has not started. The [game-module architecture](architecture.md) is now in place as its foundation.

## Purpose

Help three friends learning Deadlock remember objectives through short English voice callouts. A player manually starts the match clock in Discord. Objective names, timings, recurrence, advance warnings, and spoken wording can be changed through Discord as the game or the players' preferences change.

## Agreed scope

- Support one active match clock per Discord server. Start joins the caller's voice channel. Clock controls are shared among the friends.
- Provide start, stop, pause, resume, sync-to-current-match-time, and a way to inspect the clock and schedule. Start can accept elapsed time for late starts.
- Use match-clock reminders without game-state, speech, or camp-clear detection.
- Only the bot owner manages the saved schedule. Add, edit, disable, and remove objectives through Discord without deploying code or recording audio manually.
- Save objective settings across bot restarts. Schedule edits affect the next start; an active match retains its original settings and callouts.
- Begin with small camps, medium camps, large camps, bridge powerups ("bridge buffs"), and Sinner's Sacrifice ("Sinners"). Sinners must include recurring checks as well as the first-spawn announcement at 8:00.
- A robotic local English voice is acceptable initially. Better voice quality is an early improvement priority. Changing the speech engine should leave objective settings and clock behavior intact.

## Editable objective settings

The agreed choices define editable initial defaults. Each objective supports:

- A name and an enabled/disabled setting.
- Its first scheduled time.
- Whether a first-time advance warning and due callout play, and how early the warning plays.
- Whether reminders repeat and their interval. The first repeat is one interval after the first scheduled time.
- Whether repeating reminders have advance warnings and due callouts, with a configurable warning lead time.
- Spoken wording for the first-time and recurring callouts and their warnings. Defaults use the objective name and configured lead time; custom wording allows shorter or fuller announcements.

Warnings and due callouts can be toggled independently for first-time and recurring reminders. In particular, owners can turn recurring warnings on later without changing code. Changes to warning lead times must also be reflected in generated warning speech.

## Initial defaults

These defaults were accepted as part of the design and can be edited in Discord:

- **Small camps:** first at 2:00; "check camps" every 90 seconds afterward, starting at 3:30. This repeat interval follows the user's original example and is a reminder preference.
- **Medium camps:** first at 5:00; repeats initially disabled.
- **Large camps:** first at 8:00; repeats initially disabled.
- **Bridge buffs:** first at 5:00; repeat every five minutes, at 10:00, 15:00, and so on.
- **Sinners:** first at 8:00; "check Sinners" every five minutes afterward, starting at 13:00.

First-time announcements have a 30-second advance warning and a due callout. Repeating reminders initially have only a due callout. Combine objectives due together into one announcement, including large camps and Sinners at 8:00. All these warning, repetition, and wording choices are editable.

## Clock and voice behavior

- Pause freezes the match clock and prevents scheduled callouts until resume.
- Syncing forward skips callouts passed by the correction; never play a backlog.
- Syncing backward re-arms future callouts, including ones already spoken. For example, the 2:00 callout fires again after rewinding to 1:30 and reaching 2:00 again.
- Stop ends playback and leaves voice. Also stop and leave when no human participants remain in the channel.
- A permanent voice-connection failure or bot restart ends the active timer. Players manually start again at the current match time. Automatic recovery and concurrent matches within the same server are outside the first version.

## Audio preparation

Use local speech synthesis and cache generated callouts when their wording changes. Timing-only edits can reuse audio unless they change words in the warning. Prepare audio before an edited schedule becomes available for a new match; a preparation failure should leave the previous working schedule available and explain the failure in Discord. Provide a way to preview an objective's callouts.

Prefer [eSpeak NG](https://github.com/espeak-ng/espeak-ng) for the initial robotic voice. [Piper](https://github.com/OHF-Voice/piper1-gpl) is a candidate for the early natural-voice improvement. Both can generate WAV on headless Linux without a recurring speech-service fee. VM resources and pronunciation still need validation. Keep synthesis separate from clock and reminder scheduling so the voice can be replaced easily.

## Timing evidence and accuracy boundary

The proposed first-spawn values are community-reported current schedules with moderate confidence; they are not a complete current timetable verified from Valve. References: [Deadlock Labs](https://deadlocklabs.gg/tools/map/), [SenseOS camp guide](https://senseos.gg/guides/deadlock/jungle-camps/), [powerup wiki](https://deadlock.wiki/Powerups).

Camp and Sinner respawns depend on clearing or destroying the objective. Without those inputs, repeating reminders cannot establish actual availability. Recurring camp and Sinner callouts therefore say "check" rather than promising a respawn. For example, 8:00, 13:00, and 18:00 are proposed Sinner reminder times, not guaranteed spawn times. The [Sinner community reference](https://deadlock.wiki/Sinner) reports a five-minute respawn after destruction or full clearance at hybrid locations.

Historical official evidence supports, but does not establish live behavior as of October 22, 2026:

- Valve's [March 16, 2025 update](https://forums.playdeadlock.com/threads/03-16-2025-update.58880/) moved Sinners' first spawn to 8:00 and retained a five-minute respawn. The official page was rate-limited during research; [SteamDB's transcription](https://steamdb.info/patchnotes/17745934/) preserved the wording.
- Valve's [June 27, 2024 update](https://forums.playdeadlock.com/threads/06-27-2024-update.8486/) established five-minute powerup recurrence; the [May 8, 2025 update](https://store.steampowered.com/news/app/1422450/view/524216645064852902) moved the first powerup spawn to 5:00.
- The [November 21, 2025 notes](https://forums.playdeadlock.com/threads/11-21-2025-update.90383/) reduced small-camp respawn duration. The [January 20, 2026 follow-up](https://forums.playdeadlock.com/threads/12-29-2025-update.95233/#post-198450) reduced neutral respawn times while explicitly excluding Sinners. Neither establishes a fixed global recurrence for camps or Sinners.

## Repository feasibility and deployment prerequisites

The shared command registry can host a new `src/games/deadlock/` module registered in `src/games/index.ts`. Keep Deadlock commands, timing rules, objective settings, and voice/timer state within that module. Use a distinct `/deadlock` command root. The module declares the voice-state intent alongside its commands; the shared registry combines it with other games' intents. Shared Discord routing and infrastructure remain game-neutral.

Voice playback, objective settings, audio preparation, and active timer state remain new capabilities. Add game-specific Prisma models for saved objectives; the existing `Match` and `MatchPlayer` tables belong to Overwatch. Shared SQLite infrastructure can retain settings, while active-match recovery is unnecessary for the agreed first version.

The project and CI now target Node 24.22.1 or a newer Node 24 patch, which exceeds the checked voice library release 0.19.2's Node 22.12 minimum. The library has not been added yet; recheck its current stable release when implementing voice. Production still needs channel access, Connect/Speak permissions, a DAVE-capable voice library, speech tooling, and working UDP connectivity. The actual VM runtime, architecture, and voice connectivity remain unverified. Follow [deployment and upgrading](deployment.md), then validate join, playback, and leave before rolling out timers.

References: [voice connections](https://discordjs.guide/voice/voice-connections), [release package requirements](https://github.com/discordjs/discord.js/blob/%40discordjs%2Fvoice%400.19.2/packages/voice/package.json), [Discord voice protocol](https://docs.discord.com/developers/topics/voice-connections).
