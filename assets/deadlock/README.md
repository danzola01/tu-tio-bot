# Deadlock assets

## Reminder audio

`beep.ogg` is a short 880 Hz tone for advance warnings and countdowns. `ding.ogg` is a decaying bell-like tone for the scheduled time. Both are original synthesized sounds, stereo 48 kHz Ogg Opus, and shorter than one second.

Regenerate them with:

```bash
node scripts/generate-deadlock-sounds.mjs
```

The generator needs FFmpeg with libopus. Runtime playback does not.

`voice/<objective-id>.ogg` contains pre-recorded warnings such as "Sinners coming up." The generator defaults to OpenRouter text-to-speech with ElevenLabs `eleven-v4-turbo` and voice `brian`. It adds a 150 ms lead-in, matches loudness, and encodes stereo 48 kHz Ogg Opus. These clips are AI-generated audio.

To regenerate the five defaults, set `OPENROUTER_API_KEY` in the environment or `.env`, install FFmpeg, and run:

```bash
npm run generate:voices
```

Pass objective names after `--` to generate custom clips. `DEADLOCK_TTS_MODEL` and `DEADLOCK_TTS_VOICE` override the generator's defaults. An objective's stable ID determines its clip filename; renaming a saved objective does not change that ID or re-record its clip. See [spoken warning maintenance](../../docs/deadlock-usage.md#spoken-warnings).

Run `npm run check:audio` to read the tones and every bundled voice clip through the Opus playback pipeline without joining Discord. Commit regenerated files and include them in the deployed checkout. The bot host needs no speech API key, FFmpeg, or writable audio cache.

## Counter-guide artwork

`counters/` contains item PNGs and their fetch manifest. The bot attaches these local files to public counter-guide messages. It does not download artwork during lookups. Item identities and image source URLs live in `src/games/deadlock/counters/items.ts`.

Follow [counter-guide maintenance](../../docs/deadlock-counter-guides.md#artwork-maintenance) to refresh the catalog and pictures together. Include the whole directory in deployment. Game assets belong to their respective owners.
