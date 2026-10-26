# Deadlock sound reminder review

Reviewed October 26, 2026 against `5189d190817795297495f9a6c2a74e80718251b4`, the last working speech implementation. Sound feature commit: `f001d5f`; queued-expiry fix: `39c702e`. Standards and spec reviews ran independently in two rounds, without editing files.

## Standards

Two P2 documented violations were identified across the rounds:

1. **Countdown expiry was lost before playback.** The clock discarded expiry after collection, while the voice queue allowed two seconds from enqueue. A queued tick could start after its one-second lifetime. This violated the architecture promise that “stale queued sounds and overdue countdown ticks are skipped.” Fixed by carrying an absolute monotonic expiry from the clock through the match manager and checking it before each clip starts.
2. **An overlapping warning could revive an expired countdown.** Countdown filtering happened before coalescing, leaving the warning's longer lifetime. With warning/countdown both five seconds before a 120-second objective, collecting at 116.5 seconds emitted the expired 115-second cue. This violated “Overlapping beeps retain the stricter expiry.” Fixed by coalescing with the stricter deadline before filtering expired groups. Ding precedence remains intact.

No additional judgement-call code smells were identified. Both findings are addressed and covered by regressions.

## Spec

One P2 finding: **countdown freshness only applied during collection**, violating “Countdown ticks older than one second are dropped after stalls.” The queue could play a 119-second countdown tick at 120.5 seconds behind an earlier ding. The follow-up spec review confirmed the absolute-expiry fix, including forwarding through match controls, per-clip playback checks, and ding precedence. It found no further actionable findings or scope creep.

The second standards round's overlapping-warning case was subsequently reproduced with a failing clock regression, fixed locally, and verified without a third delegated round.

## Validation

The full check passed typechecking, compilation, **85 tests**, and a full dependency audit with **zero vulnerabilities**. The final overlap fix then passed all **19 affected clock, voice, and match tests**, including one additional regression, plus typechecking and compilation. The bundled asset probe read 9 beep and 36 ding Opus packets without external audio tools. Compiled asset resolution was also checked from outside the checkout directory.

Live Discord/Oracle join, sound, and leave validation remains a deployment check. At the time of this review nothing had been pushed or deployed.

Findings: Standards **2 P2**, both addressed; Spec **1 P2**, addressed. No unaddressed findings on either axis.

## First CI failure and correction

The first pushed [deployment run](https://github.com/danzola01/tu-tio-bot/actions/runs/40375180841) passed 85 tests but failed the sound integration test with `FFmpeg/avconv not found!`; Oracle deployment was skipped. Local FFmpeg availability had masked the dependency: the SDK treats string filenames as arbitrary input even when Ogg Opus is specified. See the [pinned SDK source](https://github.com/discordjs/discord.js/blob/%40discordjs%2Fvoice%400.19.2/packages/voice/src/audio/AudioResource.ts).

The failure was reproduced with external tools removed from PATH. Playback and the probe now share a resource factory that passes a file stream with explicit Ogg Opus type. The integration regression also removes external tools from PATH and uses that production factory. The reproduction then passed (9 beep and 36 ding packets), as did all 86 tests, typechecking, compilation, and the dependency audit with zero findings.
