# Palais Mental

A mental palace for the films, series, albums, books, board games and video games that stayed with you. Each one becomes an object in a quiet 3D room. Each collection has its own niche, and the niche fills, grows and earns small decorative objects over time.

Universal Expo app (iOS, Android, Web) · Expo Router · React Three Fiber · Zustand · i18next (EN/FR)

## Getting started

```bash
npm install
npm run android   # or: npm run ios / npm run web
npm run typecheck
```

**Test on a phone without a dev setup:** download the APK from the latest [GitHub release](../../releases). Every `v*` tag is built by `.github/workflows/android-release.yml`.

## What you can do

- **Palace (home).** The room itself is the menu. The window is home; a chip, a swipe or a tap on a niche turns your head toward a collection. Tap an object to lift it out, drag to turn it, and edit it in place.
- **Add in a few taps.** Tap **+**, type a few letters, tap the right cover. Metadata and artwork come from free, keyless catalogs, queried in parallel and merged:
  - films: iTunes and Wikipedia
  - series: TVmaze (seasons, episode counts, next episodes) and iTunes
  - albums: iTunes, Deezer, and MusicBrainz with the Cover Art Archive
  - books: Google Books and Open Library
  - video games: Steam and Wikipedia
  - board games: Wikipedia

  Manual entry is always one row away.
- **Library.** The whole collection as a wall of covers, with search, filters and sorting.
- **Soon.** The only place where time appears: new episodes of your series (followed through TVmaze) and release days of things you added before they came out, with optional quiet local notifications.
- **You.** How big your palace is, how close the next room is, what each niche earns next, your favourites, and settings.

## Design principles

- **Timeless.** No journal, dates, streaks or "log again". You arrange a place; you don't fill in a diary.
- **Editorial look.** Near-white paper and near-black ink, with the cover art as the colour. Instrument Sans for the interface, Instrument Serif for accents.
- **Motion with purpose.** Lists enter with a staggered rise. The tab indicator slides. Counters count up and progress bars spring. Ratings pop. Earned decor grows in with a little bounce. Sheets and toasts use springs, and search shows skeletons while it loads.
- **UX psychology, used gently:**
  - Goal gradient: "2 more to earn a turntable", "13 more objects and the room opens up".
  - Peak moments: new decor and room growth get their own message.
  - Undo instead of confirmation dialogs.
  - Recognition over recall: recent searches, and series in progress offered before you type.
  - A soft ask explains the value in context before the system notification prompt appears.
  - The **+** gives one small bounce at launch so you know where to start.

## The 3D palace

- **Room.** One cornerless lathe surface (floor, cove, round wall, dome) with an arched window cut in the shader, a window seat, plants and a rug.
- **Niches.** Lacquered arches set into the wall, each with a fluted lining, a brass edge, oak planks and warm light lines. They widen, then add tiers, as they fill.
- **Objects.** Two parts per object (a tinted body plus vertex-coloured trims), drawn with two instanced draw calls per collection. Every object has its own stable proportions, so a shelf never looks uniform:
  - books: paperbacks and hardcovers of varied thickness and height
  - music: occasional double LPs
  - films: DVDs, Blu-rays and steelbooks
  - board games: big, small, long and tall boxes
  - video games: standard, slim, handheld and big-box cases
  - series: the box gets thicker with every season

  Niches pack objects by their real thickness.
- **Decor.** An oak ledge under each niche holds up to five procedural objects, earned at 1, 3, 7, 12 and 20 items: a turntable, a reading lamp, meeples, a projector, a candle, and so on (23 in all).
- **Rendering.** `frameloop="demand"`: an idle palace draws nothing. Ambient dust and cloud drift run only briefly after an interaction. Web adds ambient occlusion and bloom on true highlights.

## Structure

```
app/(tabs)/              index (palace) · library · soon · profile (You) · _layout (tabs, sheets, release sync)
components/3d/           MentalPalace, CameraRig, CategoryShelf, NicheDecor, FeaturedCover, HeroItemSpawner, InspectItem, environment/…
components/ui/           LogFlow (search → confirm), ItemSheet, TabBar, Toast, Motion, CoverArt, Glass, Sheet, Controls, Icon…
lib/catalog.ts           free catalog providers + pure, tested parsers + merge
lib/releases.ts          next episodes, awaited releases, local notifications
lib/milestones.ts        decor unlocks and room growth
lib/decorGeometry.ts     procedural decor objects
lib/palaceLayout.ts      round room, zones, niche packing
store/usePalaceStore.ts  collection + settings (persisted, schema v4)
```

## Versioning

Commits follow `vX.Y.Z - <description>`. Tags `vX.Y.Z[-alpha]` produce a GitHub release with an Android APK.
