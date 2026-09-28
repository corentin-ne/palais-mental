# Palais Mental

A cinematic 3D life-logger. Every movie, series, album, book, board game and video game you log becomes a physical object in your own room, and the room grows as you do.

Universal Expo app (iOS, Android, Web) · Expo Router · React Three Fiber · Zustand · i18next (EN/FR)

## Getting started

```bash
npm install
npm run ios       # or: npm run android / npm run web
npm run typecheck
```

## Structure

```
palais-mental/
├── app/                        # Expo Router
│   ├── _layout.tsx             # i18n bootstrap, language sync, stack
│   └── index.tsx               # R3F room + absolute native UI overlay
├── components/
│   ├── 3d/
│   │   ├── Canvas.tsx          # web renderer  (@react-three/fiber)
│   │   ├── Canvas.native.tsx   # native renderer (@react-three/fiber/native + expo-gl)
│   │   ├── MentalPalace.tsx    # <Canvas frameloop="demand">, lights, animated room shell
│   │   ├── CameraRig.tsx       # bezier camera flights between overview and zones
│   │   ├── CategoryShelf.tsx   # InstancedMesh storage, growing shelf frame, tap-to-focus
│   │   └── HeroItemSpawner.tsx # center-screen spawn, disc slices, box open/close, fly-to-shelf
│   └── ui/
│       ├── LogSheet.tsx        # category picker + title/episodes form
│       ├── SeriesPanel.tsx     # "Log Episode" / new season
│       └── Stepper.tsx
├── constants/theme.ts
├── hooks/useLanguageSync.ts    # store override ⇄ i18next ⇄ device locale
├── lib/
│   ├── types.ts                # item / hero-event schema
│   ├── palaceLayout.ts         # pure math: room levels, zones, shelf growth, slot positions
│   ├── itemVisuals.ts          # per-category sizes, palettes, stable per-item variation
│   ├── itemGeometry.ts         # shared geometry cache (item boxes, disc slices)
│   ├── easing.ts               # easings, cubic bezier, delta clamping
│   └── sceneSignals.ts         # per-frame flags that must not re-render React
├── locales/
│   ├── en.json
│   ├── fr.json
│   └── i18n.ts                 # i18next + expo-localization (fallback: en)
└── store/usePalaceStore.ts     # zustand + AsyncStorage persistence
```

## Architecture notes

**Rendering budget.** The canvas runs with `frameloop="demand"`. Nothing renders while the room is idle. Each animation (camera flight, room expansion, shelf growth, hero) calls `invalidate()` only while it is moving. Every frame delta is clamped (`safeDelta`) so the first frame after an idle period doesn't jump. The light count is fixed (the hero light stays mounted at intensity 0) so no shader recompiles in the middle of an animation.

**Hero Swap.**
1. `logItem` / `logEpisode` commit data immediately (persisted), reserve the shelf slot, and push a `HeroEvent`.
2. `HeroItemSpawner` renders `heroQueue[0]` as a standalone high-fidelity group in front of the camera. It waits for the camera to land, then plays: clip-plane scan + fresnel beam + light → (series: lid opens, slice flies in, disc inserts, lid snaps shut) → bezier flight to the slot.
3. `completeHero` marks the item `settled` and pops the queue in one store write. In the same React commit the hero unmounts and `CategoryShelf` writes the instance matrix. Both sides share one `BufferGeometry` and use the same pure slot math, so the swap is invisible.

**TV series.** Each season is `{ episodeCount, watched }`. Episode `i` of `n` is an annular sector spanning `[2πi/n, 2π(i+1)/n)` (`getDiscSliceGeometry`, cached). The disc's fraction is `watched / episodeCount`.

**Growth.**
- Shelves start at 8 slots and grow 4 slots at a time up to 20. After that a new tier spawns.
- The room levels up at 20 / 50 / 100 / 200 / 400 / 800 total items. Walls and zones damp to the new size.

**Localization.** All UI strings live in `locales/*.json`. The store keeps `language: 'system' | 'en' | 'fr'`. `'system'` follows the device locale live and falls back to English.

## Versioning

Commits follow `vX.Y.Z - <description>`.
