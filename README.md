# Palais Mental

Track the shows and films you watch, and know the day anything new comes out. A calmer, faster take on TV Time: no ratings, no feed, no clutter.

Universal Expo app (iOS, Android, Web) · Expo Router · Zustand · i18next (EN/FR)

## Getting started

```bash
npm install
npm run android   # or: npm run ios / npm run web
npm run typecheck
```

**Test on a phone without a dev setup:** download the APK from the latest [GitHub release](../../releases). Every push to `main` is built by `.github/workflows/android-release.yml`.

## What it does

- **Up next.** The next episode of every show you're watching, with its still, progress and one tick to mark it watched; the next one slides in. Below: what's airing soon, shows you haven't started, and films waiting on your watchlist.
- **Calendar.** Every upcoming episode and film release you follow, day by day, with premieres and new seasons flagged. Local notifications when an episode airs or a film comes out (phones).
- **Library.** Shows by state (watching, not started, up to date, finished, dropped) and films (to watch, coming soon, watched), as a poster wall with progress bars.
- **Detail pages.** Parallax backdrop, synopsis, cast, seasons and episodes. Tick an episode, long-press a tick to mark everything up to it, or mark a whole season. Drop a show and resume it later.
- **Search.** One field for shows and films, add straight from the results. Before you type: what's on tonight and popular films.
- **Your data.** Export a full JSON backup (re-importable, merged on import) or CSV sheets of every episode and film.

## Data sources

| What | Source | Key |
|---|---|---|
| Shows, episodes, air times, artwork, cast | TVmaze | none |
| Films (search, posters) | IMDb suggestions + iTunes | none |
| Film release dates, runtime, director, summary | Wikidata + Wikipedia, iTunes | none |
| Richer films: backdrops, cast, trending, exact dates; show backdrops TVmaze lacks | TMDB | optional, set in **You → Sources** |

Shows still airing refresh every 6 hours, ended shows weekly, awaited films daily, plus pull-to-refresh.

## Structure

```
app/
  _layout.tsx            fonts, i18n, sync, notification routing, toast
  (tabs)/                Up next · Calendar · Library · You (+ search button in the tab bar)
  search.tsx             modal search
  show/[id].tsx          show detail (TVmaze id)
  movie/[id].tsx         film detail (tmdb-… / imdb-… / itunes-…)
components/
  media/                 detail layout, Up next card, poster rail
  ui/                    glass, buttons, chips, segmented, check, poster, motion, toast
lib/
  api.ts                 TVmaze, TMDB, IMDb, iTunes, Wikidata
  progress.ts            pure show-progress logic
  sync.ts                refresh, calendar entries, notifications
  backup.ts              JSON / CSV export, import
store/useLibrary.ts      persisted library (AsyncStorage)
```
