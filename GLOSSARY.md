# Tu Tio Bot

Language for the bot's game features.

## Overwatch history

**Overwatch match**:
A recorded Overwatch result, including its map, mode, outcome, and participating players.
_Avoid_: Generic game match

**Overwatch session**:
A player's recorded Overwatch matches from the last 12 hours.
_Avoid_: Deadlock timer, match clock

## Deadlock reminders

**Match clock**:
The elapsed time shown in a Deadlock match, used as the reference for reminders.
_Avoid_: Server time, session duration

**Objective**:
A Deadlock camp or other game feature for which players want scheduled reminders.

**Powerup**:
A timed buff pickup at a bridge location in Deadlock, also called a "bridge buff" by the players.

**Camp check**:
A reminder to consider farming a camp, without asserting that the camp has respawned.

**Reminder schedule**:
The planned times, repeat intervals, advance beeps, countdowns, and due dings for objective reminders.

**Sound reminder**:
An audible beep, ding, or spoken warning heard by players in a Discord voice channel.

**Spoken warning**:
A pre-recorded clip naming an objective, played in place of its advance beep when enabled.
_Avoid_: Text-to-speech announcement (nothing is synthesized at runtime)

**Scheduled reminder**:
A reminder due at a predetermined match-clock time, independently of observed game events.

**Recurring reminder**:
A scheduled reminder repeated at a predetermined interval.

**Advance warning**:
A single beep before a scheduled reminder is due.


**Countdown**:
A sequence of one-second beeps immediately before a scheduled reminder is due.

**Due ding**:
The distinct sound marking a reminder’s scheduled match time, without asserting actual objective availability.
