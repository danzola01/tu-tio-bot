# Deadlock sound reminders

Join a regular Discord voice channel and run `/deadlock start` when the match clock starts. This is a manually synchronized reminder clock. It does not watch the game, listen to speech, or detect objective clears.

## Match controls

| Command | Behavior |
| --- | --- |
| `/deadlock start` | Join your voice channel and start at 0:00. |
| `/deadlock start time:4:20` | Start at the current elapsed game time. Preparation/join time counts toward the clock. |
| `/deadlock pause` | Freeze the clock and cancel current/queued sounds. |
| `/deadlock resume` | Continue from the paused time. |
| `/deadlock sync time:1:30` | Set the clock, keeping its paused/running state. Cancel current/queued sounds. |
| `/deadlock status` | Show the channel, elapsed time, state, and next reminder. |
| `/deadlock stop` | Stop the timer and all playback, then leave voice. |
| `/deadlock schedule` | Show saved objectives for the next start. |
| `/deadlock objective show objective:sinners` | Show all saved settings and text for an objective. |
| `/deadlock preview objective:sinners kind:first-warning` | Join your channel, play that saved callout, then leave. Requires the timer to be stopped. |

Clock controls, inspection, and previews are available to server members. Only one timer or preview runs per server. Starting requires being in a voice channel; the bot needs View Channel, Connect, and Speak. Stage channels are not supported.

Forward sync skips everything up to the new time, without replaying missed callouts. Backward sync re-arms callouts strictly after the new time, including previously played ones. Rewinding from 2:10 to 1:30 therefore allows the 2:00 ding to play again. A callout exactly at the sync time is skipped. Long event-loop or playback delays discard stale reminders instead of building a backlog.

The bot leaves when no humans remain, when moved/kicked, or after a permanent voice failure. A restart loses the active clock; use `start time:...` to recover. Saved settings survive. Brief voice reconnects keep the clock moving and skip announcements that cannot be played.

## Defaults

| Objective ID | First time | Repeats |
| --- | --- | --- |
| `small-camps` | 2:00 | Every 1:30, starting 3:30 |
| `medium-camps` | 5:00 | Off |
| `large-camps` | 8:00 | Off |
| `bridge-buffs` | 5:00 | Every 5:00, starting 10:00 |
| `sinners` | 8:00 | Every 5:00, starting 13:00 |

Each first time gets an advance beep 30 seconds before, a five-second countdown, and a due ding. For 2:00: beep at 1:30; beep at 1:55, 1:56, 1:57, 1:58, and 1:59; ding at 2:00. The ding replaces a beep at the due instant. Each component can be disabled independently. Repeats get only a due ding by default. Simultaneous beeps become one beep. A due ding takes priority if it overlaps a beep. Repeating camp and Sinner cues are farming reminders; actual respawns depend on clearing them. These are editable reminder defaults; see the [design's timing evidence](deadlock-voice-timers.md#timing-evidence-and-accuracy-boundary).

## Editing objectives

Only the bot application owner (or team owner) may edit saved schedules. `BOT_OWNER_ID` overrides that identity when configured. All changes apply on the next start; an active match keeps its original schedule and audio.

Examples:

```text
/deadlock objective edit objective:small-camps warning:30 countdown:5 announce:true
/deadlock objective edit objective:sinners repeat-warning:30 repeat-countdown:5 repeat-announce:true
/deadlock objective edit objective:medium-camps enabled:false
/deadlock objective add name:Custom reminder first:12:00 repeat:3:00 warning:20
/deadlock objective remove objective:custom-reminder
```

Add requires `name` and `first`; it creates a stable ID from the name. Use the objective autocomplete selector for edits, removal, inspection, and previews. Renaming leaves that ID unchanged. An added objective starts enabled with a first due ding, an advance beep of up to 30 seconds, and a countdown of up to five seconds (shortened to fit before its first time); repeats start off.

| Option | Meaning |
| --- | --- |
| `name` | Display name, up to 48 characters. Renaming does not re-record a spoken warning. |
| `first` | First scheduled match time. |
| `repeat` | Interval after the first time; `off` disables repeats. |
| `enabled` | Enable or disable the entire objective. |
| `spoken` | Speak the objective's name instead of its first and recurring advance beeps. |
| `warning` | First advance beep lead time; `off` disables it. |
| `repeat-warning` | Recurring advance beep lead time; `off` disables it. |
| `announce` | Enable the first due ding independently of beeps. |
| `repeat-announce` | Enable recurring due dings independently of beeps. |
| `countdown` | First countdown length, 1–30 seconds; `off` disables it. |
| `repeat-countdown` | Recurring countdown length, 1–30 seconds; `off` disables it. |

Times accept whole seconds, `MM:SS`, or `HH:MM:SS`, up to 24 hours. First times and intervals must be positive. Use `off` for disabling advance beeps, countdowns, or repeats. Warning and countdown lead times must be shorter than the first time or repeat interval. At most 25 objectives can be saved per server.

To get only a ding, set `warning:off countdown:off announce:true`. To learn which beep is which, set `spoken:true`: the advance warning then says, for example, "Sinners coming up" (the countdown beeps and due ding stay the same). Spoken warnings follow the `warning` and `repeat-warning` lead times; with repeat warnings off, repeats stay ding-only. To get only countdown beeps, set `warning:off countdown:5 announce:false`. Recurring settings are independent. Countdown ticks are single beeps from T−N through T−1, with no tick at T.

Saving validates settings and checks the enabled sound assets before updating the database. An audio failure keeps the previous saved schedule. If another edit wins during preparation, retry the rejected edit. Edits apply on the next start. Earlier saved speech schedules keep their timings and warning/due choices; countdowns default off for those records until enabled. Old text and text-edit commands are retired.

Preview kinds are `first`, `first-warning`, `repeat`, `repeat-warning`, `first-countdown`, and `repeat-countdown`. A countdown preview plays one sample beep, not a timed sequence. The selected objective/component must be enabled. Pausing or syncing cancels pending sounds; forward sync skips past ticks and backward sync re-arms future ticks. After a stall, countdown ticks a full second old are discarded rather than rushed through.

## Spoken warnings

Spoken warnings are pre-recorded clips named after objective IDs, in `assets/deadlock/voice/`. The five default objectives ship with clips; spoken warnings are off until enabled per objective. A custom objective needs its own clip first, or saving with `spoken:true` fails with instructions:

```text
npm run generate:voices -- "Custom reminder"
```

This calls OpenRouter's text-to-speech API with `OPENROUTER_API_KEY` from `.env`, then encodes `custom-reminder.ogg` with FFmpeg. Commit the clip and redeploy. Run it without names to re-record the defaults. `DEADLOCK_TTS_MODEL` and `DEADLOCK_TTS_VOICE` override the voice. The bot host never calls OpenRouter.

When an advance warning coincides with other sounds, a due ding plays first, then each distinct spoken warning; coinciding beeps are skipped. Every clip still has to start within two seconds of its scheduled time, so a third simultaneous line may be skipped.

## Audio and troubleshooting

The beep, bell-like ding, and spoken warnings are bundled Ogg Opus assets. Playback needs no speech engine, FFmpeg, writable audio cache, or paid service. Run `npm run check:audio` to read every asset through the Discord playback pipeline. If it fails, restore `assets/deadlock/` and check read permissions. `DEADLOCK_AUDIO_DIR` is no longer used.

If joining or playback fails, check channel permissions and the host’s UDP connectivity, then restart the timer at the current game time. See [deployment](deployment.md) for the host setup and live smoke test.
