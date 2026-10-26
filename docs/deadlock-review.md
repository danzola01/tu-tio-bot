# Deadlock implementation review

This section records the original October 22 speech implementation and lifecycle fixes. The October 26 sound revision has a [separate review](deadlock-sounds-review.md).

Review base: `1ba4c67003bc0ab3043568cb3f95d904db1e6972` (game-module architecture baseline). Feature commit: `587bdae`. Reviewed October 22, 2026 using separate standards and spec reviewers. Both reviews were read-only.

## Standards

No actionable findings. The implementation respects documented game ownership, data separation, and lifecycle boundaries in the architecture, ADR, and glossary. No baseline code smell warranted an actionable finding.

## Spec

Two P2 findings in the initial review:

1. **Permanent connection failures could leave a silent timer running.** Recovery originally watched only Disconnected; the SDK can transition directly from Ready to Signalling/Connecting. This partially implemented “A permanent voice-connection failure or bot restart ends the active timer.” Fixed by watching every transition out of Ready, cancelling playback immediately and enforcing a 20-second recovery deadline. Reaching Ready cancels that deadline; expiry ends the timer through the existing failure callback. Regression tests cover all three paths and successful recovery.
2. **A previous stop's acknowledgement could cancel a new start.** A delayed bot-departure event could stop a new run while it prepared audio. This made the agreed start/stop controls race incorrectly. Fixed by applying departure cleanup only once the current run has established its own voice session. Tests reproduce the delayed acknowledgement during both start and preview preparation.

No other missing requirements or scope creep were identified in the initial review. Both fixes passed focused regression tests.

## Follow-up

The second standards review found no actionable issues and confirmed the two original fixes. The second spec review confirmed those fixes but identified one further P2: a move after the bot's join acknowledgement but before connection readiness could be ignored, finishing startup in the wrong channel. This violated the documented behavior, “The bot leaves when no humans remain, when moved/kicked”.

That finding is now addressed by tracking the current attempt's join acknowledgement in the match manager. Earlier leave events cannot cancel a fresh attempt; once that attempt joins its requested channel, any departure cancels it, including during the handshake. Two new command-level regressions reproduced the problem for both start and preview before the fix, then passed afterward. The affected command and match suites passed all 15 tests, with typechecking and compilation also passing. This final fix was verified locally, without a third delegated review round.

Findings across both rounds: Standards **0**; Spec **3 P2 lifecycle issues**, all addressed. Unaddressed findings: **0** on each axis. Live Discord voice playback remains a deployment check.
