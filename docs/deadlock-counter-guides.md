# Deadlock counter guides

`/deadlock counter hero:Abrams` posts item recommendations in the current text channel. Choose the enemy hero; no player-hero selection, active timer, or voice connection is needed. Anyone can use More options and Back to change the shared message's page. Buttons keep working across restarts because each one identifies its guide and page.

The implementation has 38 hero guides, 163 recommendations, 55 pages, and 32 bundled item PNGs. Each page has up to four item cards, with names, pictures, reasons to buy, and relevant conditions. Matchup warnings and the patch label appear on every page. Unknown heroes receive an unavailable-guide response.

## Sources and accuracy

The initial advice summarizes the YouTube transcript supplied during design. Its video URL, publication date, and applicable patch remain unknown. All guides have `reviewedPatch: null` and display "Patch unverified". The transcript does not establish current game mechanics.

Preserve build, timing, team-role, and duel conditions when editing advice. Do not turn alternatives into a shopping list or invent a ranking. Present the recommendation directly in the bot's voice. Keep source attribution in metadata rather than repeating it in every Discord response.

The November 9, 2026 asset refresh resolved names and artwork through the community [Deadlock API](https://api.deadlock-api.com/docs/). The checked-in catalog and fetch manifest record the results. Earlier research requests failed with HTTP 403; the implementation fetch succeeded. This verified item identities and image retrieval, not counter mechanics.

For example, the catalog maps the transcript's "e-shift" to Ethereal Shift and "Curse" to Cursed Relic, class `upgrade_glitch`. Dispel Magic has class `upgrade_reduce_debuff_duration`. Unclear references such as the Lash section's "anvil" phrase and examples that depend on unseen video images were omitted. Build-dependent anti-heal alternatives do not imply a source ranking.

## Content maintenance

`src/games/deadlock/counters/guides.ts` owns the advice. Each entry has a hero ID, aliases, summary, recommendations, an optional matchup warning, reviewed patch, and source metadata. `items.ts` owns item identities, names, image URLs, and local filenames. `messages.ts` renders pages and their navigation.

To review a guide after a patch:

1. Compare a supplied guide, transcript, or patch notes with the affected hero and item interactions. Record the source URL when available.
2. Edit the affected recommendations and retain their conditions. Set `reviewedPatch` to null when an old review no longer applies and the guide has not been rechecked.
3. Set a new reviewed patch only after reviewing the whole guide. Receiving patch notes or updating artwork does not complete that review.
4. Run `npm run check`, inspect the content diff, and follow the [release procedure](deployment.md).

A reviewed guide displays "Reviewed for: [patch]. Not reviewed for later updates." Keep old advice available with that warning. The bot has no automatic patch monitoring, runtime advice generation, or Discord editing interface.

## Artwork maintenance

The PNGs and fetch manifest live in `assets/deadlock/counters/`. The bot attaches local files as embed thumbnails and makes no runtime item API requests. Item names remain visible if a client cannot show the pictures. Game assets belong to their respective owners; Deadlock API is a community service unaffiliated with Valve.

For an intentional metadata and artwork refresh, select the supported Node 24 runtime and run:

```bash
npx tsx scripts/sync-deadlock-counter-assets.ts
npm run check
```

The script resolves existing item identities, checks the image host and PNG signature, and fails on missing entries. Review the changed catalog, images, and manifest together. To add an item, seed its verified ID, class name, and unique filename in the catalog, refresh the assets, then add the recommendation. A display-name change does not verify the guide's mechanics.

Deploy the whole `assets/deadlock/counters/` directory. This feature needs no additional dependency, environment variable, service, or database migration. Register commands and restart through the normal release process. Text channels need View Channel, Send Messages, Embed Links, and Attach Files.

Navigation replaces the original message and attachments. Invalid versions, unknown guides, and out-of-range pages receive a private explanation. To remove the feature, revert its command, component routing, content, tests, and assets together, then rebuild, register commands, and restart. Do not roll back the database.

## Verification

The November 9 implementation check passed typechecking, build, 107 tests across 17 files, and a dependency audit with zero findings. Tests cover every page's Discord size limits, PNG signatures and attachment names, recommendation reachability, aliases, warnings, public replies, private timer replies, autocomplete, and button dispatch. The compiled renderer resolved artwork across all 55 pages.

Artemis Manager's local `actions/tu-tio-bot-deployment.md` note records the release and copy cleanup. Server checks confirmed readable artwork, registered commands, and text-channel permissions. Client rendering and shared pagination remain pending in that record. Run `/deadlock counter hero:Abrams`, have a friend check the pictures and navigate to Warp Stone, then return with Back. Also check a one-page guide and existing objective autocomplete.

Source-video attribution and patch verification remain pending. Payload and asset tests do not verify game advice or Discord client rendering.
