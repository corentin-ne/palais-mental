# Palais Mental

A cinematic 3D life-logger. Every movie, series, album, book, board game and video game you log becomes a physical object in your own room, and the room grows as you do.

Universal Expo app (iOS, Android, Web) · Expo Router · React Three Fiber · Zustand · i18next (EN/FR)

## Getting started

```bash
npm install
npm run ios       # or: npm run android / npm run web
npm run typecheck
```

## Art direction

Luminous, dreamy, soft. No dark mode. The camera always stands **inside** the room at eye level (1.2–1.7 m); there is no top-down, bird's-eye or isometric shot anywhere.

- **Home view**: you stand facing a deep, bevelled arched window. Through it: a gradient sky with an HDR sun, fluffy instanced clouds and pastel hills.
- **Soft shapes**: every item, shelf, cabinet, sill and frame uses rounded or bevelled geometry. Every wall, floor and ceiling seam is filled with a concave cove, so the room has no hard corners.
- **Light**: fake volumetric god rays (the window outline swept along the sun direction), a soft sun patch on the floor with mullion shadows, and dust motes that only glint while they cross a beam.
- **Post (web)**: bloom, auto-focus depth of field (tracks the window, the shelf or the live hero), a light vignette and Khronos PBR Neutral tone mapping. **Native**: no full-screen passes. Additive halos stand in for bloom, and the renderer applies Neutral tone mapping directly.

## Structure

```
palais-mental/
├── app/                          # Expo Router
│   ├── _layout.tsx               # i18n bootstrap, language sync, stack
│   └── index.tsx                 # R3F room + absolute native UI overlay
├── components/
│   ├── 3d/
│   │   ├── Canvas(.native).tsx   # web / expo-gl renderer
│   │   ├── MentalPalace.tsx      # <Canvas frameloop="demand">, lights, rounded room, window, ambient clock
│   │   ├── CameraRig.tsx         # eye-level bezier dolly + yaw/pitch head turns (window ⇄ furniture)
│   │   ├── CategoryShelf.tsx     # rounded container, swelling growth, InstancedMesh storage
│   │   ├── HeroItemSpawner.tsx   # center-screen spawn, sunbeam/halo/sparkles, disc slices, fly-to-shelf
│   │   ├── Effects(.native).tsx  # post stack (web) / intentional no-op (native)
│   │   └── environment/
│   │       ├── SkyAndLandscape.tsx
│   │       ├── SunShafts.tsx     # god-ray prisms + floor sun patch
│   │       └── DustMotes.tsx     # GPU-driven dust
│   └── ui/                       # LogSheet, SeriesPanel, Stepper
├── shaders/                      # GLSL as TS strings: sky, lightShaft, dust, heroFx, common (window SDF)
├── lib/                          # pure layout math, geometry cache, easing, scene signals, types
├── locales/                      # en.json, fr.json, i18n.ts (expo-localization, fallback: en)
└── store/usePalaceStore.ts       # zustand + AsyncStorage persistence
```

## Architecture notes

**Rendering budget.** The canvas runs with `frameloop="demand"`. Nothing renders while the room is idle. Camera flights, container growth, room expansion and heroes call `invalidate()` only while they move. Ambient life (dust, cloud drift, shaft shimmer) runs on a shared *ambient clock* that only advances during a short "breathing" window after an interaction (touch, flight, hero). After that the loop sleeps and those shaders freeze on their last frame. Every VFX is analytic and single-pass: no render targets, no raymarching, one draw call each. Deltas are clamped (`safeDelta`). The light count is fixed, so no shaders recompile mid-animation.

**Camera.** Position follows a cubic bezier, clamped inside the room. Orientation is interpolated in yaw/pitch space, never by lerping look-at points, so a 180° turn to the front wall can't swing through the camera. The head leads the body slightly and the camera banks gently into the turn.

**Hero Swap.**
1. `logItem` / `logEpisode` commit data immediately (persisted), reserve the shelf slot, and push a `HeroEvent`.
2. `HeroItemSpawner` renders `heroQueue[0]` in the center of the screen once the camera lands. It plays a light-scan reveal inside its own sunbeam, with a halo and a sparkle swarm driven entirely by one progress uniform. Series then run: lid opens → slice flies in → disc inserts → lid snaps shut. Finally the hero flies along a bezier to its slot.
3. `completeHero` marks the item `settled` and pops the queue in one store write. The hero unmounts and `CategoryShelf` writes the instance matrix in the same commit. Both sides share one `BufferGeometry`, so the swap is invisible.

**TV series.** Each season is `{ episodeCount, watched }`. Episode `i` of `n` is a bevelled annular sector spanning `[2πi/n, 2π(i+1)/n)`. The disc's fraction is `watched / episodeCount`.

**Growth.** Containers start at 8 slots and grow 4 at a time up to 20; after that a new tier spawns. Frame geometry is rebuilt at the new size, so rounded corners stay true, then scaled from old/new → 1 so the container visibly swells. The room levels up at 20 / 50 / 100 / 200 / 400 / 800 items, and its walls, coves and window wall damp to the new size.

**Localization.** All UI strings live in `locales/*.json`. The store keeps `language: 'system' | 'en' | 'fr'`. `'system'` follows the device locale live and falls back to English.

## Versioning

Commits follow `vX.Y.Z - <description>`.
