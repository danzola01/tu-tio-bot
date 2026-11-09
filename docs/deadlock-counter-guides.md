# Deadlock counter guides

Design confirmed and implemented on 2026-11-09. Release status and server-side
verification are recorded separately in Artemis Manager's Tu Tio Bot deployment note.

## Confirmed needs

- Use the guide during a match, particularly while dead and waiting to respawn.
- Allow a moderate amount of reading: explain recommendations without becoming a long reference article.
- Proposed entry point: `/deadlock counter hero:…`.
- Selecting the enemy hero is sufficient; no player-hero input is needed.
- Seed the content from the YouTube transcript supplied in the design conversation.
- Include short explanations of why recommended items help and when they are useful; item pictures are desired.
- Initial scope is counterbuying from the supplied transcript, including the conditions attached to that advice; broader tactical research is outside the initial scope.
- Use priority recommendations plus additional options without an extremely compact first response. Pictures appear beside recommendations on all pages.
- Post the guide publicly in the channel where the command was invoked, so friends can read it. Do not use a private-first/share-button workflow.
- Associate advice with a reviewed patch/update and allow review after patches. Keep older guides available with the label “Reviewed for: [patch]. Not reviewed for later updates.” Use “Patch unverified” while the applicable patch is unknown.
- Maintain content manually with the assistant: the user can supply a replacement guide/transcript or patch notes for analysis. No Discord authoring interface or automatic patch monitoring is needed initially.
- Include all useful recommendations, grouped by purpose. Preserve timing, build, team-role, and duel qualifications. Lead with the creator's strongest recommendation where explicit; do not invent a universal ranking or force exactly three items per hero.
- Keep lengthy alternatives behind “More options” when needed.

## Confirmed presentation

- Public response headed by the enemy hero and a brief description of the threat being countered.
- Group item recommendations by purpose, with a small item picture, full name, why it helps, when to use it, and important limitations.
- Make the main response useful during a respawn timer without requiring a click for the core advice. Use “More options” only for longer alternatives, preserving the grouping and qualifications.
- Show source attribution when established and the reviewed-patch label. The supplied transcript's URL and patch remain unknown.
- Treat unclear transcript wording as a content-review issue rather than inventing mechanics, canonical names, or rankings. Patch-note analysis can identify affected advice; changing the reviewed-patch label requires an actual review, not merely receiving new notes.
- When a hero has no authored guide, explain that coverage is unavailable rather than generating advice during the lookup.

## Source boundaries

The supplied transcript primarily describes counter items and their conditional interactions.
It includes build, timing, teammate-coordination, and one-versus-one qualifications.
These qualifications must survive summarization rather than becoming unconditional shopping lists.

The transcript is source material, not independently verified current game mechanics.
Video URL, publication date, timestamps, and applicable patch have not been established.
Do not label advice current or reviewed merely because it was transcribed or entered today.
Several names appear in abbreviated or inconsistent forms (for example, “Indom,”
“Unstop,” and “e-shift”); canonical item names and artwork still need verification.
Some discussion refers to images absent from the transcript; those examples cannot
be reconstructed from the supplied text alone.

Source research did not confidently identify the video. Do not substitute a
similarly titled video or infer a patch from its publication date.

The community [Deadlock API documentation](https://api.deadlock-api.com/docs/)
and its [OpenAPI specification](https://api.deadlock-api.com/openapi.json)
document hero/item asset endpoints, versioned asset queries, and item artwork
fields including `shop_image`, `shop_image_webp`, `image`, and `image_webp`.
This is a candidate source for names and pictures, not validation of counter advice.
Live item-data retrieval during research returned HTTP 403; actual metadata and
artwork availability still require verification before choosing the integration.

## Implementation and maintenance

The implementation includes 38 heroes and 163 situational item recommendations.
`src/games/deadlock/counters/guides.ts` is the authoritative content. Each entry
has a hero, aliases, summary, recommendations, optional matchup warning, reviewed
patch, and source attribution. Keep advice grouped by purpose and preserve its
conditions. Initial guides have `reviewedPatch: null`; the source URL is absent
rather than guessed. Update source metadata when the video is identified.

The current item catalog resolved full names and artwork through
`https://api.deadlock-api.com/v1/assets/items`. Live retrieval through that endpoint
and PNG downloads succeeded on 2026-11-09, superseding the earlier failed
research requests. The catalog uses stable item IDs and class names. Examples of
resolved wording: “counter spell” → Counterspell, “e-shift” → Ethereal Shift,
“warpstone” → Warp Stone, “cultist” → Cultist Sacrifice, and the transcript's
“Curse” → Cursed Relic (`upgrade_glitch`). Its “debuff remover” terminology maps
to Dispel Magic (`upgrade_debuff_remover`). Hero spelling follows the catalog,
with source spellings retained as search aliases where useful.

Unclear references, such as the “anvil” phrase in the Lash section and examples
dependent on unseen video images, were omitted rather than guessed. Generic
anti-heal advice is represented by clearly labeled build-dependent alternatives,
without claiming the creator specifically ranked those items for that matchup.
This name/artwork lookup does not independently verify the counter mechanics.

### Updating advice after a patch

1. Supply a new guide/transcript or patch notes and compare changes to affected
   hero, item, and interaction advice. Record the source URL when available.
2. Edit affected guides, retaining uncertain claims for review rather than
   treating them as verified. Set an affected guide's `reviewedPatch` to null if
   its previous review no longer applies and it has not been rechecked.
3. Only set a guide's `reviewedPatch` to the new update after reviewing the whole
   guide, including relevant item interactions. Receiving patch notes or
   refreshing artwork does not constitute that review. Do not advance every
   guide's label automatically.
4. Run `npm run check`, review the content diff, and use the normal release
   procedure. No AI service, automatic patch polling, or Discord editing UI is used.

### Artwork and installation

`src/games/deadlock/counters/items.ts` records item identities and source image
URLs. The 32 used item PNGs and their fetch manifest are bundled under `assets/deadlock/counters/`.
The bot sends these files as embed thumbnails; there is no runtime API dependency.
Names are required even if a Discord client cannot display images.
Artwork/game assets belong to their respective owners; the community metadata
source is Deadlock API, which is not affiliated with Valve.

For an intentional metadata/artwork refresh, use the supported Node 24 runtime:

```bash
npx tsx scripts/sync-deadlock-counter-assets.ts
npm run check
```

The script resolves the existing identities, validates the image host and PNG
signature, and fails on missing entries rather than guessing replacements. Review
the updated metadata, images, and manifest together. To add an item, first seed
its verified ID, class name, and unique local filename in the catalog, then run
the refresh and add the recommendation. Refreshing assets can change display
names without validating the source guide's mechanics.

Keep the entire `assets/deadlock/counters/` directory in the deployed checkout.
No new dependency, environment variable, database migration, or service is needed.
The normal [deployment procedure](deployment.md) builds, registers slash commands
with `npm run deploy`, and restarts the bot. Text channels need Embed Links and
Attach Files permissions, plus permission to send messages.

`src/games/deadlock/counters/messages.ts` renders four item cards per page, with
source/review information and warnings on every page. Buttons carry a version,
hero ID, and page number; dispatch is stateless and shared by channel readers.
Navigation replaces the original message and its attachments. Unsupported or
out-of-range buttons receive a private explanation. No timer state is accessed.

To undo the feature, revert its command, component routing, content, tests, and
bundled assets together, then rebuild, register commands, and restart through the
same release procedure. Do not roll back the database. Old buttons are rejected
by the dispatcher if their command is removed or by the version/page checks if
their guide is no longer supported.

## Starting implementation context

Before this feature, Deadlock commands were guild-only and replied privately.
The bot supported embeds and autocomplete, but autocomplete was objective-specific.
There was no Deadlock hero/item catalog, item-art integration, counter-guide
content, or transcript-ingestion system.
Counter lookup does not conceptually require a running timer or voice connection.

## Verification

Local `npm run check` passed under a temporary Node 24.22.2 runtime: typecheck,
build, 107 tests across 17 files, and dependency audit (zero vulnerabilities),
after integrating the existing spoken-warning release from `origin/main`.
Coverage includes every guide page's Discord size limits, bundled PNG signatures
and attachment names, full recommendation reachability, aliases, matchup warnings,
public command responses, unchanged private timer replies, autocomplete routing,
button dispatch, and invalid/stale pages.
The compiled renderer also resolved every bundled artwork path across all 55
guide pages. `git diff --check` passed.

At implementation time, live command registration and Discord rendering were not tested.
After release, run `/deadlock counter hero:Abrams` in the bot-commands channel;
confirm a friend can see the pictures and navigate to Warp Stone with More
options and back. Check one-page guides and missing coverage, then confirm the
existing objective autocomplete and timer status still work. These are pending
interactive checks; local payload tests do not establish Discord permissions or
client rendering. Source-video attribution and patch verification also remain
pending. No runtime configuration, service, or database was changed locally.
