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

- **Log** a movie, series, album, book, board game or video game: title, creator (director, artist, author…), year, a rating out of five in half stars, and a note.
- **Wander**: the dock, a horizontal swipe, or a tap on a niche turns your head toward a collection. The window is home.
- **Inspect**: tap any object in a niche. It slides out and floats in front of you while its sheet is open. Drag to turn it. Every field edits in place. Remove it with an inline confirmation, and the rest of the shelf glides to close the gap.
- **Series**: log episodes from the niche card or from the box itself. Each episode adds a slice to the season disc, and a finished season snaps into its media box. Add seasons as they come.
- **Library**: search every memory by title, person, year or note. Filter by collection and sort by recent, A–Z or rating.
- **Settings**: language (Auto / English / Français), ambient light and dust, haptics, per-collection counts, and a guarded reset.

## Art direction

Luminous, soft, modern. No dark mode. The camera always stands **inside** the room at eye level (1.2–1.75 m). No top-down, bird's-eye or isometric shot exists.

- **A cornerless room**: the palace is a single lathe surface. A flat floor rolls through a wide cove into a round wall and closes in a dome. The room is a backdrop, not a set. The arched window is cut into the wall in the fragment shader and framed in deep lacquered moulding with a cushioned seat.
- **Collections as sculpted niches**: lacquered arches set into the curved wall, lined with the category's pastel, fitted with oak planks and warm light lines. They swell wider, then taller, as they fill.
- **Refined objects**: two parts per item (a tinted body plus vertex-coloured trims): cases with spine labels, books with boards, page blocks and gilt bands, sleeves with the vinyl peeking out, board-game boxes with lid seams, game cases with headers.
- **Light**: baked image-based lighting (a procedural PMREM studio) for soft reflections, fake volumetric god rays, a floor sun patch with mullion shadows, and dust that only glints inside a beam. On web: N8AO ambient occlusion, bloom on true highlights only, auto-focus depth of field, SMAA, and Khronos PBR Neutral tone mapping.
- **Interface**: frosted glass (expo-blur), Fraunces for display and Figtree for text, hand-drawn SVG icons, spring-driven sheets and presses, and haptics.

## Structure

```
app/                         _layout (fonts, i18n) · index (room + overlay, swipe navigation)
components/3d/
  MentalPalace.tsx           canvas (frameloop="demand"), IBL, lights, ambient clock
  CameraRig.tsx              eye-level bezier dolly + yaw/pitch head turns inside the circle
  CategoryShelf.tsx          sculpted niche, 2 InstancedMeshes, reflow, tap-to-focus / tap-to-inspect
  HeroItemSpawner.tsx        center-screen spawn, sunbeam/halo/sparkles, disc slices, fly-to-slot
  InspectItem.tsx            lift an object out of its niche and present it
  ItemModel.tsx              one item from the shared cached geometry (hero + inspector)
  Effects(.native).tsx       post stack on web / intentional no-op on native
  environment/               RoomShell (dome, window, seat, plants, rug), SkyAndLandscape, SunShafts, DustMotes
components/ui/               Glass, Sheet, Controls, Icon, Dock, TopBar, FocusCard, HeroCaption,
                             LogSheet, ItemSheet, LibrarySheet, SettingsSheet
shaders/                     sky, lightShaft, dust, heroFx, common (window SDF, output chunks)
lib/                         palaceLayout (round room, zones, niches), itemGeometry, itemVisuals, envMap, …
store/usePalaceStore.ts      zustand + AsyncStorage (items, order, language, settings)
locales/                     en.json, fr.json, i18n.ts
```

## Architecture notes

**Rendering budget.** `frameloop="demand"`: nothing renders while the room is still. Flights, niche growth, shelf reflow, heroes and the inspector call `invalidate()` only while they move. Ambient life runs on an *ambient clock* that only advances for a few seconds after an interaction; it can be switched off. Each collection costs two draw calls, and each VFX is one analytic single-pass shader. The light count is fixed, so no shaders recompile mid-animation.

**Additive effects** end in `ADDITIVE_OUTPUT_CHUNK`, which applies tone mapping but no colour-space conversion. That way glows sum in linear space both through the web composer and when drawing straight to the sRGB canvas on native.

**Hero Swap.** Logging commits data and reserves the slot immediately, then queues a `HeroEvent`. The hero plays in the center of the screen and flies to the slot computed from the same pure layout the shelf uses. `completeHero` settles the item in the same commit that unmounts the hero. Both sides share cached geometry, so the swap is invisible. The inspector uses the same trick in reverse: `inspectId` hides the instance until the object has glided back.

**TV series.** Each season is `{ episodeCount, watched }`. Episode `i` of `n` is a bevelled annular sector spanning `[2πi/n, 2π(i+1)/n)`.

**Growth.** Niches start at 8 slots and widen 4 at a time up to 20; after that a new tier spawns and the arch rises. The room grows at 20 / 50 / 100 / 200 / 400 / 800 items.

**Localization.** All strings live in `locales/*.json` with identical key sets. `'system'` follows the device locale live and falls back to English.

## Versioning

Commits follow `vX.Y.Z - <description>`.
