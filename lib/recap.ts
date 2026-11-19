/** Pure: a year of yours told as a story (the recap): totals, your best-rated, your binge, your busiest day. */
import { StatKind, Stats, countsOf, statsOf } from './stats';
import { Book, Game, MediaKind, Movie, Show } from './types';

type Library = { shows: Record<string, Show>; movies: Record<string, Movie>; books: Record<string, Book>; games: Record<string, Game> };

export interface RecapTitle {
  kind: MediaKind;
  href: string;
  title: string;
  poster?: string;
  rating?: number;
}

export interface Recap {
  year: number;
  stats: Stats;
  /** Titles got through: films watched, books and games finished, shows with at least one episode. */
  titles: number;
  /** Minutes in front of shows and films, plus hours played. */
  minutes: number;
  /** Your best-rated of the year, five at most. */
  top: RecapTitle[];
  /** Most episodes of a single show in one day. */
  binge?: { title: string; poster?: string; href: string; episodes: number; at: number };
  /** The day you marked the most. */
  busiest?: { at: number; count: number };
  /** The month (0–11) with the most marks. */
  bestMonth?: number;
  goals: { kind: StatKind; goal: number; count: number }[];
}

const yearOf = (ms: number) => new Date(ms).getFullYear();
const dayStart = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function recapOf(lib: Library, year: number, goals: Partial<Record<StatKind, number>> = {}): Recap {
  const stats = statsOf(lib, year);
  const inYear = (at?: number): at is number => !!at && yearOf(at) === year;

  const rated: (RecapTitle & { at: number })[] = [];
  const days = new Map<number, number>();
  const mark = (at: number) => days.set(dayStart(at), (days.get(dayStart(at)) ?? 0) + 1);
  let binge: Recap['binge'];
  let shows = 0;
  let hours = 0;

  for (const show of Object.values(lib.shows)) {
    const perDay = new Map<number, number>();
    let last = 0;
    for (const at of Object.values(show.watched)) {
      if (!inYear(at)) continue;
      mark(at);
      perDay.set(dayStart(at), (perDay.get(dayStart(at)) ?? 0) + 1);
      last = Math.max(last, at);
    }
    if (!last) continue;
    shows++;
    for (const [at, episodes] of perDay)
      if (episodes > 1 && (!binge || episodes > binge.episodes)) binge = { title: show.title, poster: show.poster, href: `/show/${show.tvmazeId}`, episodes, at };
    if (show.rating) rated.push({ kind: 'show', href: `/show/${show.tvmazeId}`, title: show.title, poster: show.poster, rating: show.rating, at: last });
  }
  for (const m of Object.values(lib.movies)) {
    if (!inYear(m.watchedAt)) continue;
    mark(m.watchedAt);
    if (m.rating) rated.push({ kind: 'movie', href: `/movie/${m.id}`, title: m.title, poster: m.poster, rating: m.rating, at: m.watchedAt });
  }
  for (const b of Object.values(lib.books)) {
    if (!inYear(b.finishedAt)) continue;
    mark(b.finishedAt);
    if (b.rating) rated.push({ kind: 'book', href: `/book/${b.id}`, title: b.title, poster: b.cover, rating: b.rating, at: b.finishedAt });
  }
  for (const g of Object.values(lib.games)) {
    if (!inYear(g.finishedAt)) continue;
    mark(g.finishedAt);
    hours += g.hours ?? 0;
    if (g.rating) rated.push({ kind: 'game', href: `/game/${g.id}`, title: g.title, poster: g.cover, rating: g.rating, at: g.finishedAt });
  }

  let busiest: Recap['busiest'];
  for (const [at, count] of days) if (!busiest || count > busiest.count) busiest = { at, count };

  const totals = stats.buckets.map((b) => b.show + b.movie + b.book + b.game);
  const max = Math.max(0, ...totals);
  const counts = countsOf(lib, year);

  return {
    year,
    stats,
    titles: shows + stats.films + stats.books + stats.games,
    minutes: stats.showMinutes + stats.filmMinutes + Math.round(hours * 60),
    top: rated
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.at - a.at)
      .slice(0, 5)
      .map(({ at: _at, ...t }) => t),
    binge,
    busiest,
    bestMonth: max ? totals.indexOf(max) : undefined,
    goals: (['movie', 'book', 'game'] as StatKind[]).filter((k) => goals[k]).map((kind) => ({ kind, goal: goals[kind]!, count: counts[kind] })),
  };
}

/** The year a recap is offered for: this one from mid-November, last year through January. */
export function recapYear(now = Date.now()): number | undefined {
  const d = new Date(now);
  if (d.getMonth() === 0) return d.getFullYear() - 1;
  if (d.getMonth() === 11 || (d.getMonth() === 10 && d.getDate() >= 15)) return d.getFullYear();
  return undefined;
}
