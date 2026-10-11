/** Pure: what you watched, read and played over a year (or ever), counted from the dates you marked things. */
import { Book, Game, Movie, Show } from './types';

type Library = { shows: Record<string, Show>; movies: Record<string, Movie>; books: Record<string, Book>; games: Record<string, Game> };

/** What a chart or a goal counts: episodes watched, films watched, books and games finished. */
export type StatKind = 'show' | 'movie' | 'book' | 'game';
export const STAT_KINDS: StatKind[] = ['show', 'movie', 'book', 'game'];

/** One bar of the chart: a month of the year, or a whole year over all time. */
export type Bucket = { at: number } & Record<StatKind, number>;

export interface Stats {
  episodes: number;
  showMinutes: number;
  films: number;
  filmMinutes: number;
  books: number;
  /** Pages of the books finished in the period. */
  pages: number;
  games: number;
  /** The twelve months (`at`: 0–11) of a year, or every year from the first to the last (`at`: the year). */
  buckets: Bucket[];
  /** Genres of the shows and films watched and the games finished, most frequent first. */
  genres: { name: string; count: number }[];
  /** How many titles you gave each rating: index 0 is half a star, 9 is five stars. */
  ratings: number[];
  /** Mean rating, 1–10. */
  average?: number;
  /** Days on which you marked something. */
  activeDays: number;
  /** The longest run of such days in a row. */
  streak: number;
  /** Shows by episodes watched in the period. */
  topShows: { show: Show; episodes: number }[];
}

const TOP = 5;
const GENRES = 6;
const yearOf = (ms: number) => new Date(ms).getFullYear();
/** A local calendar day as a whole number, so that consecutive days differ by one. */
const dayOf = (ms: number) => {
  const d = new Date(ms);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
};

/** Everything dated in the library: one entry per episode watched, film watched, book or game finished. */
function* marks(lib: Library): Generator<[StatKind, number]> {
  for (const show of Object.values(lib.shows)) for (const at of Object.values(show.watched)) yield ['show', at];
  for (const m of Object.values(lib.movies)) if (m.watchedAt) yield ['movie', m.watchedAt];
  for (const b of Object.values(lib.books)) if (b.finishedAt) yield ['book', b.finishedAt];
  for (const g of Object.values(lib.games)) if (g.finishedAt) yield ['game', g.finishedAt];
}

/** The years you marked something in, latest first. */
export function yearsOf(lib: Library) {
  const years = new Set<number>();
  for (const [, at] of marks(lib)) years.add(yearOf(at));
  return [...years].sort((a, b) => b - a);
}

/** How many of each kind you marked in `year`: what the goals are measured against. */
export function countsOf(lib: Library, year: number) {
  const counts: Record<StatKind, number> = { show: 0, movie: 0, book: 0, game: 0 };
  for (const [kind, at] of marks(lib)) if (yearOf(at) === year) counts[kind]++;
  return counts;
}

/** `year` absent: over all time. */
export function statsOf(lib: Library, year?: number): Stats {
  const inPeriod = (at?: number): at is number => !!at && (year == null || yearOf(at) === year);
  const years = yearsOf(lib);
  const first = year == null ? (years[years.length - 1] ?? 0) : 0;
  const buckets: Bucket[] = Array.from({ length: year == null ? (years.length ? years[0] - first + 1 : 0) : 12 }, (_, i) => ({ at: first + i, show: 0, movie: 0, book: 0, game: 0 }));
  const days = new Set<number>();
  for (const [kind, at] of marks(lib)) {
    if (!inPeriod(at)) continue;
    buckets[year == null ? yearOf(at) - first : new Date(at).getMonth()][kind]++;
    days.add(dayOf(at));
  }

  const genres = new Map<string, number>();
  const ratings = Array<number>(10).fill(0);
  /** A title of the period: its genres count once, its rating too. Over all time, anything rated counts. */
  const title = (active: boolean, item: { rating?: number }, names: string[] = []) => {
    if (active) for (const g of names) genres.set(g, (genres.get(g) ?? 0) + 1);
    if (item.rating && (active || year == null)) ratings[Math.max(1, Math.min(10, Math.round(item.rating))) - 1]++;
  };

  const out = { episodes: 0, showMinutes: 0, films: 0, filmMinutes: 0, books: 0, pages: 0, games: 0 };
  const topShows: Stats['topShows'] = [];
  for (const show of Object.values(lib.shows)) {
    let episodes = 0;
    let minutes = 0;
    const runtimes = new Map(show.episodes.map((e) => [String(e.id), e.runtime]));
    for (const [id, at] of Object.entries(show.watched)) {
      if (!inPeriod(at)) continue;
      episodes++;
      // An episode missing from the list (not fetched again yet) counts for the show's usual length.
      minutes += runtimes.get(id) ?? show.runtime ?? 0;
    }
    out.episodes += episodes;
    out.showMinutes += minutes;
    if (episodes) topShows.push({ show, episodes });
    title(episodes > 0, show, show.genres);
  }
  for (const m of Object.values(lib.movies)) {
    const seen = inPeriod(m.watchedAt);
    if (seen) {
      out.films++;
      out.filmMinutes += m.runtime ?? 0;
    }
    title(seen, m, m.genres);
  }
  for (const b of Object.values(lib.books)) {
    const read = inPeriod(b.finishedAt);
    if (read) {
      out.books++;
      out.pages += b.pages ?? b.page ?? 0;
    }
    title(read, b);
  }
  for (const g of Object.values(lib.games)) {
    const done = inPeriod(g.finishedAt);
    if (done) out.games++;
    title(done, g, g.genres);
  }

  const rated = ratings.reduce((n, c) => n + c, 0);
  return {
    ...out,
    buckets,
    genres: [...genres.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, GENRES),
    ratings,
    average: rated ? ratings.reduce((n, c, i) => n + c * (i + 1), 0) / rated : undefined,
    activeDays: days.size,
    streak: longestRun([...days]),
    topShows: topShows.sort((a, b) => b.episodes - a.episodes || a.show.title.localeCompare(b.show.title)).slice(0, TOP),
  };
}

function longestRun(days: number[]) {
  days.sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  days.forEach((d, i) => {
    run = i && d === days[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}
