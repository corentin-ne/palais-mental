# Palais Mental

A cinematic 3D life-logger. Every movie, series, album, book, board game and video game you log becomes a physical object in your own room, and the room grows as you do.

Universal Expo app (iOS, Android, Web) · Expo Router · React Three Fiber · Zustand · i18next (EN/FR) · expo-blur · react-native-svg

## Getting started

```bash
npm install
npm run ios       # or: npm run android / npm run web
npm run typecheck
```

## What you can do

Palais Mental is a **log app first**. The 3D palace is where your log turns into a place.

- **Log in three taps**: tap **+**, type a few letters, then tap the right cover. Titles, creators, years and artwork come from public catalogs: Open Library for books, iTunes for films, series seasons (with episode counts) and albums, and Wikipedia for board and video games. Manual entry is always one row away. Pick when it happened (today, yesterday or any earlier day), add a rating in half stars and a note.
- **Journal**: your diary, day by day, with cover thumbnails, ratings, notes, "again" badges and episode entries. A *Continue watching* row logs the next episode of a series in one tap. A search with nothing typed offers your recent logs for a quick re-log.
- **Library**: every memory as a wall of covers. Search by title, person, year or note, filter by collection with counts, and sort by recent, rating or A–Z.
- **Palace**: the collection as a round, cornerless, sunlit room. Each collection has an arched niche that shows its latest cover face-out and grows as it fills. Swipe or tap a chip to turn toward a collection; tap an object to lift it out and open it.
- **You**: logs this year, streak, average rating, a split by collection, month-by-month bars, favourites, and settings (language, ambient effects, haptics, reset).

## Design

Editorial and crisp. Near-white paper, near-black ink, and the cover art as the colour. Instrument Sans for the interface; Instrument Serif italic for dates, notes and quiet accents. A floating glass tab bar keeps the log button at its centre. Anything without artwork gets a generated cover (a collection-palette gradient, the title in serif italic, and the collection's icon).

The palace renders crisply: ambient occlusion, bloom on true highlights only, Neutral tone mapping so covers keep their real colours, and no depth-of-field haze.

## Structure

```
app/_layout.tsx                 fonts, i18n, root stack
app/(tabs)/_layout.tsx          tabs + global LogFlow, ItemSheet, Toast
app/(tabs)/index.tsx            Journal
app/(tabs)/library.tsx          Library
app/(tabs)/palace.tsx           3D palace + overlay
app/(tabs)/profile.tsx          You: stats and settings
components/ui/                  LogFlow (search → confirm), ItemSheet, CoverArt, TabBar, Toast, Glass, Sheet, Controls, Icon…
components/3d/                  MentalPalace, CameraRig, CategoryShelf, FeaturedCover, HeroItemSpawner, InspectItem, environment/…
lib/catalog.ts                  keyless catalog search + pure, tested parsers
lib/stats.ts                    journal grouping, streaks, yearly stats
store/usePalaceStore.ts         items, journal events, settings (persisted, schema v3)
store/useUiStore.ts             log flow and toast state (transient)
```

## Architecture notes

**Rendering budget.** `frameloop="demand"`: nothing renders while the room is still. Flights, niche growth, shelf reflow, heroes and the inspector call `invalidate()` only while they move. Ambient life runs on an *ambient clock* that only advances for a few seconds after an interaction; it can be switched off. Each collection costs two draw calls, and each VFX is one analytic single-pass shader. The light count is fixed, so no shaders recompile mid-animation.

**Additive effects** end in `ADDITIVE_OUTPUT_CHUNK`, which applies tone mapping but no colour-space conversion. That way glows sum in linear space both through the web composer and when drawing straight to the sRGB canvas on native.

**Journal model.** Items are the collection. `events` is the diary: `log`, `relog` and `episode` entries with their own dates. Logging a title that is already in the collection (same catalog id, or same category and title) adds a `relog` event instead of a duplicate. Schema v3 migrates older saves by giving every item one `log` event at its creation date.

**Heroes only where they are seen.** Logging from the Journal or the Library commits instantly. The center-screen hero plays only when you log from the Palace tab, so a hidden canvas never animates.

**Hero Swap.** Logging commits data and reserves the slot immediately, then queues a `HeroEvent`. The hero plays in the center of the screen and flies to the slot computed from the same pure layout the shelf uses. `completeHero` settles the item in the same commit that unmounts the hero. Both sides share cached geometry, so the swap is invisible. The inspector uses the same trick in reverse: `inspectId` hides the instance until the object has glided back.

**TV series.** Each season is `{ episodeCount, watched }`. Episode `i` of `n` is a bevelled annular sector spanning `[2πi/n, 2π(i+1)/n)`.

**Growth.** Niches start at 8 slots and widen 4 at a time up to 20; after that a new tier spawns and the arch rises. The room grows at 20 / 50 / 100 / 200 / 400 / 800 items.

**Localization.** All strings live in `locales/*.json` with identical key sets. `'system'` follows the device locale live and falls back to English.

## Versioning

Commits follow `vX.Y.Z - <description>`.
