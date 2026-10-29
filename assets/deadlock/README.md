# Reminder sounds

`beep.ogg` is a short 880 Hz tone for advance warnings and countdowns.
`ding.ogg` is a decaying bell-like tone for the scheduled time.

These original synthesized sounds were generated for this project by
`node scripts/generate-deadlock-sounds.mjs` (FFmpeg with libopus is needed
only to regenerate them). Both are stereo 48 kHz Ogg Opus and shorter than
one second. Runtime playback requires neither FFmpeg nor speech tooling.

`voice/<objective-id>.ogg` are spoken warnings ("Sinners coming up.") recorded
with OpenRouter text-to-speech (ElevenLabs `eleven-v3`, voice `brian`) by
`npm run generate:voices`, then trimmed, loudness-matched, and encoded to the same
format. They are AI-generated audio; regenerating needs `OPENROUTER_API_KEY` and FFmpeg.

Run `npm run check:audio` to validate every asset without joining Discord.
