# Palais Mental

A mental palace for the films, series, albums, books, board games and video games that stayed with you. Each one becomes an object in a 3D room. Each collection has its own piece of furniture, and the furniture changes shape as the collection grows.

Universal Expo app (iOS, Android, Web) · Expo Router · React Three Fiber · Zustand · i18next (EN/FR)

## Getting started

```bash
npm install
npm run android   # or: npm run ios / npm run web
npm run typecheck
```

**Test on a phone without a dev setup:** download the APK from the latest [GitHub release](../../releases). Every `v*` tag is built by `.github/workflows/android-release.yml`.

## What you can do

- **Palace (home).** The room itself is the menu. The window is home; a chip, a swipe or a tap on a piece of furniture turns your head toward a collection. Tap an object to lift it out, drag to turn it, and edit it in place.
- **Add in a few taps.** Tap **+**, type a few letters, tap the right cover. Metadata and artwork come from free, keyless catalogs, queried in parallel and merged:
  - films: iTunes and Wikipedia
  - series: TVmaze (seasons, episode counts, next episodes) and iTunes
  - albums: iTunes, Deezer, and MusicBrainz with the Cover Art Archive
  - books: Google Books and Open Library
  - video games: Steam and Wikipedia
  - board games: Wikipedia

  Manual entry is always one row away.
- **Library.** The whole collection as a wall of covers, with search, filters and sorting.
- **Soon.** The only place where time appears: new episodes of your series (followed through TVmaze) and release days of things you added before they came out, with optional local notifications.
- **You.** Your collections, your favourites, and settings.

## Design principles

- **No scores.** No journal, dates, streaks, progress bars or unlock messages. The furniture evolving is the only sign of growth.
- **Minimal interface.** The room is the menu; the interface is a row of chips, one card and the **+** button.
- **Editorial look.** Near-white paper and near-black ink, with the cover art as the colour. Instrument Sans for the interface, Instrument Serif for accents.
- **Motion.** Springs everywhere: furniture morphs between stages, objects pop out of a pearl of light, camera moves are short and decisive.

## The 3D palace

- **Room.** One cornerless lathe surface (floor, cove, round wall, dome) with an arched window cut in the shader, a window seat, plants and a rug.
- **Furniture.** Each collection stands on the flat floor in front of the curved wall, in cream lacquer, pastel back panels, oak planks and brass. It evolves with the collection:

  | Objects | Shape |
  |---|---|
  | 0–5 | pedestal with an arched backdrop |
  | 6–15 | console on brass legs |
  | 16–35 | bookcase with bays and light lines |
  | 36–71 | cabinet crowned by an arch |
  | 72+ | wall unit flanked by arched towers |

  Parts keep stable ids across stages and are driven by springs, so an evolution morphs instead of swapping models. Each part is rebuilt at its exact size, so rounded corners never stretch.
- **Objects.** Two parts per object (a tinted body plus vertex-coloured trims), drawn with two instanced draw calls per collection. Every object has its own stable proportions, so a shelf never looks uniform:
  - books: paperbacks and hardcovers of varied thickness and height
  - music: occasional double LPs
  - films: DVDs, Blu-rays and steelbooks
  - board games: big, small, long and tall boxes
  - video games: standard, slim, handheld and big-box cases
  - series: the box gets thicker with every season

  Furniture packs objects by their real thickness, bay by bay.
- **Arrival.** A new object is born in the centre of the screen: light spirals into a small pearl, the pearl collapses, and the object unwinds out of it with an elastic pop and a ring of light, then flies to its slot. The furniture gives a small bounce as it lands.
- **Rendering.** `frameloop="demand"`: an idle palace draws nothing. Ambient dust and cloud drift run only briefly after an interaction. Web adds ambient occlusion and bloom on true highlights.

## Structure

```
app/(tabs)/              index (palace) · library · soon · profile (You) · _layout (tabs, sheets, release sync)
components/3d/           MentalPalace, CameraRig, CategoryFurniture, FeaturedCover, HeroItemSpawner, InspectItem, environment/…
components/ui/           LogFlow (search → confirm), ItemSheet, TabBar, Toast, Motion, CoverArt, Glass, Sheet, Controls, Icon…
lib/catalog.ts           free catalog providers + pure, tested parsers + merge
lib/releases.ts          next episodes, awaited releases, local notifications
lib/furnitureGeometry.ts soft furniture parts (rounded blocks, capsules, arches)
lib/palaceLayout.ts      round room, zones, furniture stages, parts and packing
store/usePalaceStore.ts  collection + settings (persisted, schema v4)
```

## Versioning

Commits follow `vX.Y.Z - <description>`. Tags `vX.Y.Z[-alpha]` produce a GitHub release with an Android APK.
