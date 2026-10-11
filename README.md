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
- **Up next.** The next episode of every show you're watching, with its still, progress and one tick to mark it watched; the next one slides in. It picks up after the furthest episode you ticked, so starting a show mid-way doesn't send you back to the pilot. Below: shows you haven't started and films on your watchlist, in one rail. On Android, an **Up next widget** puts the same next episodes on the home screen, with the tick.
- **Books and games.** Search Open Library, Google Books, Steam and Wikidata; keep your place (the page you're at, hours played and completion), pause, finish, drop or start again. Books you're reading and games you're playing sit in **Up next** with a one-tap + (a page, or ten on a long press; an hour of play). Each page shows the release date (with a countdown when it's announced) and the rest of the series in order: prequels, sequels and every entry with its number and date.
- **Series kept together.** Like a show's seasons: films, books and games of the same series sit on one poster in the library (a little pile, with how many you've seen, read or played), placed by where you are in it. Its page lists every entry in order, the ones you don't have too (Toy Story 1–5, every *One Piece* volume), each with a tick: tick one to mark it (it's added if needed), hold a tick to mark everything up to it. Series come from Wikidata, or from the number in the title when it has none ("ONE PIECE 12", "Part Two", "Tome 3"). Every film, book or game page links to its series.
- **Playtime filled in.** Mark a game played ("I've played it", or finished) without hours and it gets the average playtime from HowLongToBeat; each game page shows how long the story and the whole game take on average.
- **Journal.** Rate an episode, a series, a film, a book or a game and write a few words: **You** shows the latest notes, **See all** every one of them by kind. No dates, just what you thought.
- **Calendar.** Every upcoming episode, film, book and game release you follow, day by day, with premieres and new seasons flagged. Local notifications when an episode airs or a film comes out (phones).
- **Library.** Shows by state (watching, not started, up to date, finished, dropped), films (to watch, coming soon, watched), books and games (reading or playing, to read or play, coming soon, finished, dropped), as a poster wall with progress bars; typing searches the whole tab (and says how many matches the other tabs hold); sort by recent, A–Z, next out or rating.
- **Detail pages.** Parallax backdrop, synopsis, cast, seasons and episodes. Tick an episode (with undo), long-press a tick to mark everything up to it, mark a whole season, or catch up on every episode left in one tap (each with undo). The episode you pick up at is highlighted, and episodes you skipped can be marked in one tap. Drop a show and resume it later.
- **Navigation.** Up next is the round button at the centre of the bar, with Calendar and Library on one side, Social and You on the other.
- **Search.** The magnifier on Up next, Calendar and Library (the library's filter hands over what you typed). One field for shows, films, books and games, add straight from the results. Before you type: what's on tonight and popular films.
- **Trailer, where to watch, more like this.** Trailers open on YouTube, streaming/rent/buy services for your country, and similar titles (with a TMDB key; search links otherwise). IMDb link on every title.
- **Light and dark.** Follows the system, or pick one in **You → Settings**. English and French.
- **Your data.** Export a full JSON backup (re-importable, merged on import) or CSV sheets of every episode, film, book and game. Automatic copies are kept on the phone every few days and can be merged back from **You → Your data**, which also holds connections, backups and CSV sheets. Updates never reset the library: store migrations keep every entry and save a copy first.
- **Connections.** Films and series, anime, books and games, read from the phone with no server in between:
  - *Public profiles, a username:* Letterboxd, Serializd, MyAnimeList, AniList, Kitsu, Goodreads (shelf feeds), Open Library (reading log), BookWyrm (any instance), Steam (wishlist).
  - *A personal key you create on the service:* Trakt (client ID), Hardcover (API token), Steam (Web API key: library and playtime), RetroAchievements (web API key).
  - *Your own media server:* Plex (X-Plex-Token), Jellyfin and Emby (API key), local http addresses included.
  - *Export files:* Letterboxd, IMDb, Trakt, TV Time, Netflix viewing activity (episodes matched by name), Serializd, Goodreads, StoryGraph, LibraryThing/Libib-style book lists, HowLongToBeat/Grouvee/Backloggd/Playnite-style game lists.

  Syncing is additive: titles missing here are added, episodes, films, books and games finished there are marked here, ratings, pages and playtime fill in, nothing is removed. The other way goes through each service's import page: a Letterboxd CSV, a MyAnimeList XML (also read by AniList), a Goodreads CSV (Goodreads, StoryGraph, Hardcover, BookWyrm), an IMDb-format CSV (Trakt, Simkl), and an .ics calendar of everything upcoming (Google, Apple, Outlook).
- **Sequels and universes.** From Wikidata: sequels, prequels, the same film, book or game series, franchise or fictional universe (MCU, Star Wars…) as anything in your library show up in the calendar (dashed) with a release-day notification, and recent ones in **Up next → Out now in your universes**.
- **Social.** Open the **Social** tab and choose a name: that comes first, the rest appears once you are in with everyone else: no email, no password, no code. Recommend a title with a few words, to everyone or to one person; five per kind can be a *favourite*. Ratings are shared only if you say so: one switch for all of them in **Social**, and one on each page to show or hide that rating whatever the switch says. What it gives back: a red band across posters, like the one a bookshop wraps around a prize-winner ("Léa says try this", "Favourite of Tom", "Group prize 2026", "Unanimous", "Recommended by 3 people", "Loved by Léa", "Divisive"), with thresholds that follow the size of the group so it works at three or four; or a band you write yourself when recommending, quoted and signed like a blurb (*“A masterpiece” — Pierre*), in the colour you pick, your stars above it if you like; a **The group liked** rail on Up next for what the others recommend or rated four stars and up and you don't have yet; a line under search results; everyone's rating and words on each page, with a thank-you; **Social** itself (its own tab), where every recommendation is listed (all, for you, yours), then what the group rated, best first, then who is there; and a discussion under every episode, closed until you have ticked it (before that, only how many messages are waiting). All of it is read from what the phone last synced: offline, or with the server down, the app is what it was and Social shows what it had. Nobody sees what you watch, read or play: the library, progress and history never leave the phone.
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

## Social server

Social runs on a free Supabase project (Postgres, EU). The app holds its URL and publishable key (`lib/supabase.ts`); what a member can read or write is decided by the row-level security rules in `supabase/migrations/`, not by the key.

- **What is stored:** a name per member, the ratings they chose to show, recommendations (with their band), thank-yous, episode messages and reactions, and for each title they refer to its ids, name, year and poster link. Nothing else: no library, progress or history.
- **Who can read it:** members of the same group, and only them. Each member can change or delete only their own rows; leaving deletes everything they shared.
- **Joining:** one group (`base`) that everyone is in as soon as they choose a name (one name each, 50 members at most). Anyone who installs the app can therefore join and read what is shared there. Groups are real in the schema, with a hashed access code each, for the day there are several.
- **In transit and at rest:** every call is HTTPS; the database is encrypted on disk by Supabase, but what is shared is not end-to-end encrypted: members read it, and so can whoever owns the project. The device's anonymous session is kept in the app's private storage.
- **Assuming a stranger joins:** a shared title carries a plain id and an https poster, drawn only from the hosts the app already talks to; quotas cap what one account can write; names can't be taken twice.
- **Changing the schema:** add a migration in `supabase/migrations/`, then `npx supabase db push` (after `npx supabase login` and `npx supabase link`).
- **Staying awake:** free projects pause after a week without a query; `.github/workflows/supabase-keepalive.yml` pings it twice a week.

## Structure

```
app/
  _layout.tsx            Spark provider, i18n, sync, notification routing, toast
  (tabs)/                Up next · Calendar · Library · You (+ search button in the tab bar)
  search.tsx             modal search
  social.tsx             Social: every recommendation, the group's ratings, who is there and what you share
  show/[id].tsx          show detail (TVmaze id)
  movie/[id].tsx         film detail (tmdb-… / imdb-… / itunes-…)
  book/[id].tsx          book detail (ol-… / gb-… / wd-…)
  game/[id].tsx          game detail (steam-… / wd-…)
spark/                   Spark UI kit native layer (vendored copy, see spark/VERSION): tokens, glass, controls
constants/theme.ts       the app's theme built on the kit's tokens (appearance × accent × display quality)
components/
  media/                 detail layout, Up next and reading/playing cards, poster and series rails, book/game detail
  friends/               Social: your name, the block on each page, the episode discussion, the recommendations rail
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
  supabase.ts            the Social server over plain fetch: an anonymous account, REST behind row-level security
  friends.ts             Social: joining, sync, shared ratings, recommendations, episode discussions
  ribbons.ts             the bands across posters, suggestions and taste agreement, worked out on the device
store/useLibrary.ts      persisted library (AsyncStorage)
store/useFriends.ts      what the group shared, kept on the device
supabase/                the Social database: schema, access rules (migrations/) and project config
```
