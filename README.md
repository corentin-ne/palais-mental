# Palais Mental

Track the shows and films you watch, the books you read and the games you play, and know the day anything new comes out. A calmer, faster take on TV Time: no feed, no clutter, and your library never leaves the phone.

Universal Expo app (Android, iOS, Web) · Expo Router · Zustand · i18next (English, French)

## Run it

```bash
npm install
npm run android   # or: npm run ios / npm run web
npm run typecheck
npm test
```

**On a phone, no dev setup:** install the APK from the latest [GitHub release](../../releases). The app checks for a newer release at launch and installs it over itself (same signing key every time, see [signing/](signing/README.md)).

## What it does

**Tracking**

- **Up next.** The next episode of every show you're watching, one tick to mark it; it picks up after the furthest episode you ticked, not at the first gap. Books you're reading and games you're playing sit there too, with a one-tap + (a page, ten on a long press, an hour of play). Below: what you haven't started, with **Pick one** when you can't decide. On Android, a home-screen widget shows the same episodes, with the tick.
- **Library.** A poster wall per kind, by state (watching, not started, up to date, finished, dropped; to watch, coming soon, watched; reading or playing, paused, to read or play…). Typing searches the whole tab and counts matches in the others; sort by recent, A–Z, next out or rating.
- **Series kept together.** Films, books and games of one series share a poster and a page listing every entry in order, the ones you don't have included. Tick one to mark it, hold a tick to mark everything up to it. Series come from Wikidata, or from the number in the title.
- **Detail pages.** Synopsis, cast, seasons and episodes; tick an episode, a season, everything up to an episode or everything left, each with undo. Trailer, where to watch in your country, similar titles, IMDb link. Games get average playtime from HowLongToBeat.
- **Calendar.** Every upcoming episode, film, book and game you follow, day by day, with a local notification on the day. Sequels and titles from the same series or universe as something you have show up too (dashed).
- **Journal and ratings.** Half-star ratings and a few words on an episode, a series, a film, a book or a game; **You** lists them.
- **Statistics.** **You → Statistics**: a year of yours (or all of them) in numbers. Episodes, films, books and games month by month, time spent, active days and days in a row, your genres, how you rate, the shows you watched most. Set a goal for the year (films, books, games) and follow it there.
- **Search.** One field for shows, films, books and games; add straight from the results.

**Your data**

- **Backups.** A full JSON backup (merged on import) and CSV sheets, in **You → Your data**. A copy of the library is kept on the phone every few days and can be merged back. Updates never reset the library: migrations keep every entry and save a copy first.
- **Connections.** Read from the phone, no server in between:
  - *A username (public profiles):* Letterboxd, Serializd, MyAnimeList, AniList, Kitsu, Goodreads, Open Library, BookWyrm, Steam (wishlist).
  - *A personal key:* Trakt, Hardcover, Steam (library and playtime), RetroAchievements.
  - *Your media server:* Plex, Jellyfin, Emby (local addresses included).
  - *Export files:* Letterboxd, IMDb, Trakt, TV Time, Netflix, Serializd, Goodreads, StoryGraph and other book lists, HowLongToBeat, Grouvee, Backloggd, Playnite and other game lists.

  Syncing only adds: missing titles, what you finished there, ratings, pages and playtime. Nothing is removed. The other way goes through each service's import page: a Letterboxd CSV, a MyAnimeList XML (AniList reads it too), a Goodreads CSV (StoryGraph, Hardcover, BookWyrm), an IMDb CSV (Trakt, Simkl), and an .ics calendar of what's upcoming.

**Social**

Choose a name in the **Social** tab (in **You** with solo mode on, see Settings) and you're in the group: no email, no password. Rating a title and writing a few words about it is how you recommend it: share them if you want to (one switch for all, one per title). Social is one page: the people in the group with how close their taste is to yours, what they loved that you don't have, then a feed of reviews, ratings (gathered per person and day) and episode messages, veiled until you have seen the episode. In return you also get bands across posters ("Unanimous", "Divisive", "Group prize"), a **The group liked** rail on Home, everyone's stars and words on each page, emoji reactions, and a discussion under every episode, closed until you have ticked it. Everything is read from the last sync, so the app works the same offline. Nobody sees what you watch, read or play.

**Look**

The Spark UI kit (vendored in [spark/](spark/README.md)): frosted glass over a soft aurora, one accent colour you pick, light and dark, and a lite mode for older phones (no blur, no looping animation).

## Data sources

All keyless, except TMDB (optional, set in Settings: adds film backdrops, cast, trending and exact dates).

| What | Source |
|---|---|
| Shows, episodes, air times, artwork, cast | TVmaze |
| Films | IMDb suggestions, iTunes, Wikidata + Wikipedia; TMDB with a key |
| Books | Open Library, Google Books (publication dates) |
| Games | Steam store, HowLongToBeat (playtime), ProtonDB (Linux, Steam Deck), CheapShark (prices) |
| Series, sequels, universes, awards, adaptations, console games | Wikidata |

Shows still airing refresh every 6 hours, ended shows weekly, awaited films, books and games daily, plus pull-to-refresh.

## Social server

A free Supabase project (Postgres, EU). The app holds its URL and publishable key (`lib/supabase.ts`); what a member can read or write is decided by the row-level security rules in `supabase/migrations/`, not by the key.

- **Stored:** a name per member, the ratings and reviews they chose to show (a review is a post on episode 0, so no schema change was needed and older versions simply don't show it), recommendations from versions before 1.11, episode messages and reactions, and for each title its ids, name, year and poster link. No library, progress or history.
- **Readable by:** members of the same group only. Each member can change or delete only their own rows; leaving deletes everything they shared.
- **Joining:** one group (`base`), open to anyone who installs the app and chooses a name (50 members at most). Groups with a hashed access code exist in the schema for the day there are several.
- **Not end-to-end encrypted:** calls are HTTPS and the database is encrypted on disk, but members, and whoever owns the project, can read what is shared.
- **If a stranger joins:** shared titles carry a plain id and an https poster from hosts the app already talks to; quotas cap what one account can write; names can't be taken twice.
- **Schema changes:** add a migration in `supabase/migrations/`, then `npx supabase db push` (after `npx supabase login` and `npx supabase link`).
- **Keep-alive:** free projects pause after a week idle; `.github/workflows/supabase-keepalive.yml` pings it twice a week.

## Releases

Every push to `main` builds a signed APK and publishes it as `v<version in package.json>`; a `v*` tag publishes that tag. A version with a `-` is a pre-release. The build (`.github/workflows/android-release.yml`) typechecks, runs the tests, and fails if the APK isn't signed with the release key.

To release: bump `version` in `package.json` and `app.json` (with `android.versionCode` and `ios.buildNumber`), then push.

## Where things are

```
app/                     screens (Expo Router)
  (tabs)/                Calendar · Library · Up next · Social · You
  show|movie|book|game/  detail pages
  collection/            a series: every entry in order
  search, data, journal, stats, connections, settings
components/
  media/ show/           detail layout, cards, rails, episode rows
  friends/               Social: your name, the block on each page, episode discussions
  ui/                    the app's controls, built on the kit
spark/                   Spark UI kit, native layer (vendored, see spark/VERSION)
constants/theme.ts       the app's theme on the kit's tokens
lib/
  api, books, games      metadata sources
  series, collections, related, extras, wikidata   series, universes and page extras
  progress, shelf, journal, stats   pure logic: where you are in a show, a book, a game; your numbers
  sync                   refresh, upcoming releases, notifications
  connect, sources/      connections: readers per service, matching, additive sync, export files
  backup, calendarFile   JSON / CSV / .ics export, import, automatic copies
  storage, libraryParts  batched writes; episode lists kept apart from the library
  cache, cacheBudget     on-device cache for slow answers, within a size budget
  supabase, friends, ribbons   Social: server calls, sync, bands and suggestions
  updates, widget        new releases; the Android widget kept in step
store/                   Zustand stores: library, connections, friends, prefs, ui
widget/                  the Android home-screen widget and its background task
plugins/                 build-time config (Android storage size)
supabase/                the Social database: migrations and project config
tests/                   unit tests for the pure logic (node --test)
```
