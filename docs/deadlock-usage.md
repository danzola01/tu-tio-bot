# Deadlock voice reminders

Join a regular Discord voice channel and run `/deadlock start` when the match clock starts. This is a manually synchronized reminder clock. It does not watch the game, listen to speech, or detect objective clears.

## Match controls

| Command | Behavior |
| --- | --- |
| `/deadlock start` | Join your voice channel and start at 0:00. |
| `/deadlock start time:4:20` | Start at the current elapsed game time. Preparation/join time counts toward the clock. |
| `/deadlock pause` | Freeze the clock and cancel current/queued speech. |
| `/deadlock resume` | Continue from the paused time. |
| `/deadlock sync time:1:30` | Set the clock, keeping its paused/running state. Cancel current/queued speech. |
| `/deadlock status` | Show the channel, elapsed time, state, and next reminder. |
| `/deadlock stop` | Stop the timer and all playback, then leave voice. |
| `/deadlock schedule` | Show saved objectives for the next start. |
| `/deadlock objective show objective:sinners` | Show all saved settings and text for an objective. |
| `/deadlock preview objective:sinners kind:first-warning` | Join your channel, play that saved callout, then leave. Requires the timer to be stopped. |

Clock controls, inspection, and previews are available to server members. Only one timer or preview runs per server. Starting requires being in a voice channel; the bot needs View Channel, Connect, and Speak. Stage channels are not supported.

Forward sync skips everything up to the new time, without replaying missed callouts. Backward sync re-arms callouts strictly after the new time, including previously spoken ones. Rewinding from 2:10 to 1:30 therefore allows the 2:00 callout to speak again. A callout exactly at the sync time is skipped. Long event-loop or playback delays discard stale reminders instead of building a backlog.

The bot leaves when no humans remain, when moved/kicked, or after a permanent voice failure. A restart loses the active clock; use `start time:...` to recover. Saved settings and audio cache survive. Brief voice reconnects keep the clock moving and skip announcements that cannot be played.

## Defaults

| Objective ID | First time | Repeats |
| --- | --- | --- |
| `small-camps` | 2:00 | Every 1:30, starting 3:30 |
| `medium-camps` | 5:00 | Off |
| `large-camps` | 8:00 | Off |
| `bridge-buffs` | 5:00 | Every 5:00, starting 10:00 |
| `sinners` | 8:00 | Every 5:00, starting 13:00 |

Each first time gets a 30-second warning and a due callout. Repeats get only a due callout by default. Simultaneous objectives play as one sequential batch. Camp and Sinner repeats say “check”: their actual respawns depend on clearing them. These are editable reminder defaults; see the [design's timing evidence](deadlock-voice-timers.md#timing-evidence-and-accuracy-boundary).

## Editing objectives

Only the bot application owner (or team owner) may edit saved schedules. `BOT_OWNER_ID` overrides that identity when configured. All changes apply on the next start; an active match keeps its original schedule and audio.

Examples:

```text
/deadlock objective edit objective:small-camps repeat:2:00
/deadlock objective edit objective:sinners repeat-warning:30 repeat-text:Check Sinners when safe.
/deadlock objective edit objective:medium-camps enabled:false
/deadlock objective add name:Custom reminder first:12:00 repeat:3:00 warning:20
/deadlock objective remove objective:custom-reminder
```

Add requires `name` and `first`; it creates a stable ID from the name. Use the objective autocomplete selector for edits, removal, inspection, and previews. Renaming leaves that ID unchanged. An added objective starts enabled with a first due callout and a warning of up to 30 seconds; repeats start off.

| Option | Meaning |
| --- | --- |
| `name` | Spoken/display name, up to 48 characters. |
| `first` | First scheduled match time. |
| `repeat` | Interval after the first time; `off` disables repeats. |
| `enabled` | Enable or disable the entire objective. |
| `warning` | First warning lead time; `off` disables it. |
| `repeat-warning` | Recurring warning lead time; `off` disables it. |
| `announce` | Enable the first due callout independently of its warning. |
| `repeat-announce` | Enable recurring due callouts independently of warnings. |
| `first-text` | First due callout wording. |
| `warning-text` | First warning wording. |
| `repeat-text` | Recurring due wording. |
| `repeat-warning-text` | Recurring warning wording. |

Times accept whole seconds, `MM:SS`, or `HH:MM:SS`, up to 24 hours. First times and intervals must be positive. Use `off` for disabling warnings/repeats. Warning lead times must be shorter than the first time or repeat interval. At most 25 objectives can be saved per server.

Text accepts `{name}` and `{seconds}` placeholders, up to 180 characters. `{seconds}` expands to the warning lead time (or 0 in due text). Set a text option to the literal `default` to reset its template. For example, `warning-text:{name} in {seconds} seconds.` updates automatically when the name or lead time changes. Use shorter custom phrases to reduce chatter.

Saving validates settings and prepares enabled callouts before updating the database. A preparation failure keeps the previous saved schedule. If another edit wins while audio is preparing, retry the rejected edit. Timing-only changes reuse cached clips unless the rendered warning text changes. Preview kinds are `first`, `first-warning`, `repeat`, and `repeat-warning`; the selected objective/callout must be enabled.

## Voice and troubleshooting

The initial voice is local English eSpeak NG, converted by FFmpeg to cached Ogg Opus. A better speech provider can replace it without changing timers or saved wording. There is no paid speech account or runtime audio reception.

If speech preparation fails, run `npm run check:audio` as the service account and check that `espeak-ng` and `ffmpeg` are on its PATH and that its audio cache is writable. The default is `data/deadlock-audio/` in the checkout; `DEADLOCK_AUDIO_DIR` can select a persistent absolute directory. Changing engine/voice settings in a future provider should also change its cache identity.

If joining or playback fails, check channel permissions and the host's UDP connectivity, then restart the timer at the current game time. See [deployment](deployment.md) for the host setup and smoke test.
