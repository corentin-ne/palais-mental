# Palais Mental

Track the shows and films you watch, the books you read and the games you play, and know the day anything new comes out. A calmer, faster take on TV Time: no ratings, no feed, no clutter.

Universal Expo app (iOS, Android, Web) · Expo Router · Zustand · i18next (EN/FR)

## Getting started

```bash
npm install
npm run android   # or: npm run ios / npm run web
npm run typecheck
```

**Test on a phone without a dev setup:** download the APK from the latest [GitHub release](../../releases). Every push to `main` (pre-release) and every `v*` tag (release) is built by `.github/workflows/android-release.yml`.

## What it does

- **Up next.** The next episode of every show you're watching, with its still, progress and one tick to mark it watched; the next one slides in. Below: what's airing soon, shows you haven't started, and films waiting on your watchlist.
- **Books and games.** Search Open Library, Google Books, Steam and Wikidata; keep your place (the page you're at, hours played and completion), finish, drop or start again. Books you're reading and games you're playing sit in **Up next** with a one-tap + (a page, or ten on a long press; an hour of play). Each page shows the release date (with a countdown when it's announced) and the rest of the series in order: prequels, sequels and every entry with its number and date.
- **Calendar.** Every upcoming episode, film, book and game release you follow, day by day, with premieres and new seasons flagged. Local notifications when an episode airs or a film comes out (phones).
- **Library.** Shows by state (watching, not started, up to date, finished, dropped), films (to watch, coming soon, watched), books and games (reading or playing, to read or play, coming soon, finished, dropped), as a poster wall with progress bars; filter by title and sort by recent, A–Z or next out.
- **Detail pages.** Parallax backdrop, synopsis, cast, seasons and episodes. Tick an episode (with undo), long-press a tick to mark everything up to it, mark a whole season, or catch up on every aired episode in one tap. Drop a show and resume it later.
- **Search.** One field for shows and films, add straight from the results. Before you type: what's on tonight and popular films.
- **Trailer, where to watch, more like this.** Trailers open on YouTube, streaming/rent/buy services for your country, and similar titles (with a TMDB key; search links otherwise). IMDb link on every title.
- **History.** Every episode and film you watched, day by day.
- **Light and dark.** Follows the system, or pick one in **You → Settings**. English and French.
- **Your data.** Export a full JSON backup (re-importable, merged on import) or CSV sheets of every episode, film, book and game. Automatic copies are kept on the phone every few days and can be merged back from **You → Your data**. Updates never reset the library: store migrations keep every entry and save a copy first.
- **Connections.** Letterboxd, Serializd, MyAnimeList and AniList by username (public profiles, no password or API key), plus Letterboxd, Serializd and IMDb export files. Serializd diaries tick the exact episodes and seasons you logged, each on its own date. Syncing is additive: titles missing here are added, episodes and films watched there are ticked here, ratings fill in, nothing is removed. The other way goes through each service's import page: **Export what's missing** writes a Letterboxd CSV or a MyAnimeList XML (also read by AniList) with only what that service doesn't have.
- **Sequels and universes.** From Wikidata: sequels, prequels, the same film, book or game series, franchise or fictional universe (MCU, Star Wars…) as anything in your library show up in the calendar (dashed) with a release-day notification, and recent ones in **Up next → Out now in your universes**.
- **Ratings.** Half-star ratings on films and shows, imported from other services, exported to Letterboxd and in the CSVs; sort the library by rating.

## Data sources

| What | Source | Key |
|---|---|---|
| Shows, episodes, air times, artwork, cast | TVmaze | none |
| Films (search, posters) | IMDb suggestions + iTunes | none |
| Film release dates, runtime, director, summary | Wikidata + Wikipedia, iTunes | none |
| Richer films: backdrops, cast, trending, exact dates; show backdrops TVmaze lacks | TMDB | optional, set in **You → Sources** |
| Books: search, covers, page counts, editions, trending | Open Library | none |
| Book publication dates (upcoming ones too), extra results | Google Books | none |
| Games: search, covers, release dates, top sellers, coming soon | Steam store | none |
| Book and game series, prequels, sequels, exact dates, platforms, console games | Wikidata + Wikipedia | none |

Shows still airing refresh every 6 hours, ended shows weekly, awaited films, books and games daily, plus pull-to-refresh.

## Structure

```
app/
  _layout.tsx            fonts, i18n, sync, notification routing, toast
  (tabs)/                Up next · Calendar · Library · You (+ search button in the tab bar)
  search.tsx             modal search
  show/[id].tsx          show detail (TVmaze id)
  movie/[id].tsx         film detail (tmdb-… / imdb-… / itunes-…)
  book/[id].tsx          book detail (ol-… / gb-… / wd-…)
  game/[id].tsx          game detail (steam-… / wd-…)
components/
  media/                 detail layout, Up next and reading/playing cards, poster and series rails, book/game detail
  ui/                    glass, buttons, chips, segmented, check, poster, motion, toast
lib/
  api.ts                 TVmaze, TMDB, IMDb, iTunes, Wikidata
  books.ts               Open Library, Google Books
  games.ts               Steam store, Wikidata
  series.ts              prequels, sequels and series order (Wikidata)
  shelf.ts               pure book/game progress logic
  progress.ts            pure show-progress logic
  sync.ts                refresh, calendar entries, notifications
  backup.ts              JSON / CSV export, import
store/useLibrary.ts      persisted library (AsyncStorage)
```
