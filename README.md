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

- **Spark UI kit look.** Frosted glass over a soft aurora, one accent colour you pick in Settings (every decorative colour derives from it, with readable text on any of them), fixed colours for states and data, system fonts and measured motion: anything you press catches the kit's rim light (the edge of the card lights in the accent where your finger lands, fading along the border), and the tab you're on is all accent, icon and label in bold. Light and dark, plus a lite display mode for older phones (opaque surfaces, no blur, no looping animation). Built on the kit's native layer, vendored in `spark/`.
- **Up next.** The next episode of every show you're watching, with its still, progress and one tick to mark it watched; the next one slides in. It picks up after the furthest episode you ticked, so starting a show mid-way doesn't send you back to the pilot. Below: what's airing soon, shows you haven't started, and films waiting on your watchlist.
- **Books and games.** Search Open Library, Google Books, Steam and Wikidata; keep your place (the page you're at, hours played and completion), finish, drop or start again. Books you're reading and games you're playing sit in **Up next** with a one-tap + (a page, or ten on a long press; an hour of play). Each page shows the release date (with a countdown when it's announced) and the rest of the series in order: prequels, sequels and every entry with its number and date.
- **Series kept together.** Like a show's seasons: films, books and games of the same series sit on one poster in the library (a little pile, with how many you've seen, read or played), placed by where you are in it. Its page lists every entry in order, the ones you don't have too (Toy Story 1–5, every *One Piece* volume), each with a tick: tick one to mark it (it's added if needed), hold a tick to mark everything up to it. Series come from Wikidata, or from the number in the title when it has none ("ONE PIECE 12", "Part Two", "Tome 3"). Every film, book or game page links to its series.
- **Playtime filled in.** Mark a game played ("I've played it", or finished) without hours and it gets the average playtime from HowLongToBeat; each game page shows how long the story and the whole game take on average.
- **Calendar.** Every upcoming episode, film, book and game release you follow, day by day, with premieres and new seasons flagged. Local notifications when an episode airs or a film comes out (phones).
- **Library.** Shows by state (watching, not started, up to date, finished, dropped), films (to watch, coming soon, watched), books and games (reading or playing, to read or play, coming soon, finished, dropped), as a poster wall with progress bars; filter by title and sort by recent, A–Z or next out.
- **Detail pages.** Parallax backdrop, synopsis, cast, seasons and episodes. Tick an episode (with undo), long-press a tick to mark everything up to it, mark a whole season, or catch up on every episode left in one tap (each with undo). The episode you pick up at is highlighted, and episodes you skipped can be marked in one tap. Drop a show and resume it later.
- **Search.** One field for shows and films, add straight from the results. Before you type: what's on tonight and popular films.
- **Trailer, where to watch, more like this.** Trailers open on YouTube, streaming/rent/buy services for your country, and similar titles (with a TMDB key; search links otherwise). IMDb link on every title.
- **History.** Every episode and film you watched, day by day.
- **Light and dark.** Follows the system, or pick one in **You → Settings**. English and French.
- **Your data.** Export a full JSON backup (re-importable, merged on import) or CSV sheets of every episode, film, book and game. Automatic copies are kept on the phone every few days and can be merged back from **You → Your data**. Updates never reset the library: store migrations keep every entry and save a copy first.
- **Connections.** Films and series, anime, books and games, read from the phone with no server in between:
  - *Public profiles, a username:* Letterboxd, Serializd, MyAnimeList, AniList, Kitsu, Goodreads (shelf feeds), Open Library (reading log), BookWyrm (any instance), Steam (wishlist).
  - *A personal key you create on the service:* Trakt (client ID), Hardcover (API token), Steam (Web API key: library and playtime), RetroAchievements (web API key).
  - *Your own media server:* Plex (X-Plex-Token), Jellyfin and Emby (API key), local http addresses included.
  - *Export files:* Letterboxd, IMDb, Trakt, TV Time, Netflix viewing activity (episodes matched by name), Serializd, Goodreads, StoryGraph, LibraryThing/Libib-style book lists, HowLongToBeat/Grouvee/Backloggd/Playnite-style game lists.

  Syncing is additive: titles missing here are added, episodes, films, books and games finished there are marked here, ratings, pages and playtime fill in, nothing is removed. The other way goes through each service's import page: a Letterboxd CSV, a MyAnimeList XML (also read by AniList), a Goodreads CSV (Goodreads, StoryGraph, Hardcover, BookWyrm), an IMDb-format CSV (Trakt, Simkl), and an .ics calendar of everything upcoming (Google, Apple, Outlook).
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
| Book ratings, readers, characters, places, authors, more by the author, same publisher, books alike, Open Library series | Open Library | none |
| Awards, characters, settings, publisher, engine, modes, director, composer, age ratings, adaptations (films, series, games) and sources | Wikidata | none |
| Game reviews, Metacritic, price, features, screenshots, more from the developer and publisher | Steam store | none |
| Average playtime (story, all styles) | HowLongToBeat | none |
| Film series (for the library's piles), numbered book volumes | Wikidata, Open Library | none |
| Linux and Steam Deck compatibility | ProtonDB | none |
| Best price across stores | CheapShark | none |

Shows still airing refresh every 6 hours, ended shows weekly, awaited films, books and games daily, plus pull-to-refresh.

## Structure

```
app/
  _layout.tsx            Spark provider, i18n, sync, notification routing, toast
  (tabs)/                Up next · Calendar · Library · You (+ search button in the tab bar)
  search.tsx             modal search
  show/[id].tsx          show detail (TVmaze id)
  movie/[id].tsx         film detail (tmdb-… / imdb-… / itunes-…)
  book/[id].tsx          book detail (ol-… / gb-… / wd-…)
  game/[id].tsx          game detail (steam-… / wd-…)
spark/                   Spark UI kit native layer (vendored copy, see spark/VERSION): tokens, glass, controls
constants/theme.ts       the app's theme built on the kit's tokens (appearance × accent × display quality)
components/
  media/                 detail layout, Up next and reading/playing cards, poster and series rails, book/game detail
  ui/                    the app's controls on the kit: glass, buttons, chips, segmented, check, poster, motion, toast
lib/
  api.ts                 TVmaze, TMDB, IMDb, iTunes, Wikidata
  books.ts               Open Library, Google Books
  games.ts               Steam store, Wikidata
  series.ts              prequels, sequels and series order (Wikidata)
  connect.ts             connections: matching, additive sync, export files
  sources/               readers per service (films and series, books, games) and export-file parsers
  calendarFile.ts        .ics export of upcoming releases
  extras.ts              book and game page extras: facts, scores, rails, adaptations (Wikidata)
  cache.ts               on-device cache for slow, rarely changing answers
  storage.ts             batched writes for the persisted stores
  shelf.ts               pure book/game progress logic
  progress.ts            pure show-progress logic
  sync.ts                refresh, calendar entries, notifications
  backup.ts              JSON / CSV export, import
store/useLibrary.ts      persisted library (AsyncStorage)
```
