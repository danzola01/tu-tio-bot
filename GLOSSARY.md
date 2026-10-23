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
The planned times, repeat intervals, advance warnings, and callout wording for objective reminders.

**Voice callout**:
A spoken reminder heard by players in a Discord voice channel.
_Avoid_: Notification, ping

**Scheduled reminder**:
A reminder due at a predetermined match-clock time, independently of observed game events.

**Recurring reminder**:
A scheduled reminder repeated at a predetermined interval.

**Advance warning**:
A voice callout before a scheduled reminder is due.

