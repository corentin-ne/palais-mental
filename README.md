# Palais Mental

A mental palace for the films, series, albums, books, board games and video games that stayed with you. Each one becomes an object in a 3D room. Each collection has its own piece of furniture, and the furniture changes shape as the collection grows.

Universal Expo app (iOS, Android, Web) · Expo Router · React Three Fiber · Zustand · i18next (EN/FR)

## Getting started

```bash
npm install
npm run android   # or: npm run ios / npm run web
npm run typecheck
npm test          # catalog parsers and cover colours, with fixtures
```

**Test on a phone without a dev setup:** download the APK from the latest [GitHub release](../../releases). Every `v*` tag is built by `.github/workflows/android-release.yml`.

## What you can do

- **Palace (home).** The room itself is the menu. The window is home; a chip, a swipe or a tap on a piece of furniture turns your head toward a collection. Tap an object to lift it out, drag to turn it, and edit it in place.
- **Add in a few taps.** Tap **+**, type a few letters, tap the right cover. Metadata and artwork come from free, keyless catalogs, queried in parallel and merged (a later source fills a missing cover or year):
  - films: iTunes, IMDb suggestions, MyAnimeList (Jikan), Wikidata and Wikipedia
  - series: TVmaze (seasons, episode counts, next episodes), IMDb suggestions, iTunes, MyAnimeList and Wikidata
  - albums: iTunes, Deezer, MusicBrainz with the Cover Art Archive, and Wikipedia
  - books: Google Books, Open Library, Apple Books, MyAnimeList (manga), Gutendex and Wikidata
  - video games: Steam, GOG, IMDb suggestions, Wikipedia and Wikidata
  - board games: BoardGameGeek, Wikipedia and Wikidata

  Manual entry is always one row away. The same request made by several collections (the "Everything" search) goes out once.
- **Artwork everywhere.** Objects without a cover are looked up in the background. Tap the cover in an object's sheet to choose among every artwork the catalogs know. On the web, each object takes the dominant colour of its cover on the shelf.
- **Library.** The whole collection as a wall of covers, with search, filters and sorting.
- **Soon.** The only place where time appears: new episodes of your series (followed through TVmaze) and release days of things you added before they came out, with optional local notifications.
- **You.** Your collections, your favourites, and settings.

## Design principles

- **No scores.** No journal, dates, streaks, progress bars or unlock messages. The furniture evolving is the only sign of growth.
- **Minimal interface.** The room is the menu; the interface is a row of chips, one card and the **+** button.
- **Editorial look.** Near-white paper and near-black ink, with the cover art as the colour. Instrument Sans for the interface, Instrument Serif for accents.
- **Motion.** Springs everywhere: furniture morphs between stages, objects pop out of a pearl of light, camera moves are short and decisive.

## The 3D palace

- **Room.** One cornerless lathe surface (floor, cove, round wall, dome) with an arched window cut in the shader. The floor is procedural light-oak parquet (per-plank tone, grain, knots, seams) finished with an oak skirting; the walls are lime plaster. Around it: a lacquered TV console with fluted doors (films, series and games stand beside it), a 2000s silver mini hi-fi on an oak bench (music stands beside it), sheer curtains on a brass rod, a window seat, a paper lantern, a reading corner (bouclé armchair, floor lamp, side table), a coffee table on the rug, framed prints drawn by a shader, and plants.
- **Furniture.** Each collection stands on the flat floor in front of the curved wall, in cream lacquer, pastel back panels, oak planks and brass. It evolves with the collection:

  | Objects | Shape |
  |---|---|
  | 0–5 | pedestal with an arched backdrop |
  | 6–15 | console on brass legs |
  | 16–35 | bookcase with bays and light lines |
  | 36–71 | cabinet crowned by an arch |
  | 72+ | wall unit flanked by arched towers |

  A vase, then a plant, then candles gather on top as it evolves. Parts keep stable ids across stages and are driven by springs, so an evolution morphs instead of swapping models. Each part is rebuilt at its exact size, so rounded corners never stretch.
- **Objects.** Two parts per object (a tinted body plus vertex-coloured trims), drawn with two instanced draw calls per collection. Every object has its own stable proportions, so a shelf never looks uniform:
  - books: paperbacks and hardcovers of varied thickness and height
  - music: CD jewel cases, with the odd double-disc fatbox
  - films: DVDs, Blu-rays and steelbooks
  - board games: one box size (variants are configurable)
  - video games: standard, slim and handheld cases
  - series: the box gets thicker with every season

  Furniture packs objects by their real thickness, bay by bay.
- **Arrival.** A new object is born in the centre of the screen: light spirals into a small pearl, the pearl collapses, and the object unwinds out of it with an elastic pop and a ring of light, showing its real cover, then flies to its slot. The furniture gives a small bounce as it lands.
- **Rendering.** `frameloop="demand"`: an idle palace draws nothing. Ambient dust and cloud drift run only briefly after an interaction. Web adds ambient occlusion and bloom on true highlights.

## Customising

Every tunable lives in `config/`; the rest of the code reads from it.

| File | What you change there |
|---|---|
| `config/room.ts` | room size and growth, window, sun, where each collection stands (fixed angle or beside the TV, the hi-fi or another collection) |
| `config/collections.ts` | object sizes and shape variants, palettes, finishes, how densely furniture packs them |
| `config/furniture.ts` | stage thresholds and proportions, corner softness, oak and brass |
| `config/decor.ts` | which room pieces exist, where they stand, their colours |
| `config/look.ts` | light, sky, walls, floor and textile colours |
| `config/motion.ts` | camera lens and flight timing, arrival timing |
| `config/catalog.ts` | which sources each collection searches, in which order, and limits |

Surfaces get quiet procedural textures (wood grain, linen weave, bouclé, plaster, paper) from `lib/materialPatches.ts`; call `withSurface(material, kind)` on any standard material.

## Structure

```
app/(tabs)/              index (palace) · library · soon · profile (You) · _layout (tabs, sheets, release sync)
config/                  every tunable (see Customising)
components/3d/           MentalPalace, CameraRig, CategoryFurniture, FurnitureTop, FeaturedCover, CoverFace, HeroItemSpawner, InspectItem
components/3d/decor/     TV console, hi-fi, reading corner, coffee table, lantern, curtains, prints, plants (+ shared materials, placement)
components/3d/environment/ room shell, sky, sun shafts, dust, RoomDecor (composes the decor from config)
components/ui/           LogFlow (search → confirm), ItemSheet, TabBar, Toast, Motion, CoverArt, Glass, Sheet, Controls, Icon…
lib/catalog.ts           free catalog providers + pure, tested parsers + merge + cover matching
lib/covers.ts            background artwork lookup and cover colours
lib/coverColor.ts        dominant colour of a cover (web)
lib/releases.ts          next episodes, awaited releases, local notifications
lib/furnitureGeometry.ts soft furniture parts (rounded blocks, capsules, arches)
lib/palaceLayout.ts      round room, zones, furniture stages, parts and packing
store/usePalaceStore.ts  collection + settings (persisted, schema v4)
```

## Versioning

Commits follow `vX.Y.Z - <description>`. Tags `vX.Y.Z[-alpha]` produce a GitHub release with an Android APK.
