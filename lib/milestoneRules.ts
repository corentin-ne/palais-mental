/** Pure: the moments worth celebrating in one change of the library, found by comparing before and after. */
import { progressOf, seasonsOf, showState } from './progress';
import { StatKind, countsOf } from './stats';
import { Book, Game, Movie, Show } from './types';

type Library = { shows: Record<string, Show>; movies: Record<string, Movie>; books: Record<string, Book>; games: Record<string, Game> };

export type Milestone =
  | { kind: 'goal'; stat: StatKind; count: number; year: number }
  | { kind: 'showFinished'; show: Show }
  | { kind: 'seasonDone'; show: Show; season: number }
  | { kind: 'bookFinished'; book: Book }
  | { kind: 'gameFinished'; game: Game };

/** More entries than this changed at once: an import, a sync or a refresh, not something you just did. */
const BULK = 3;
/** A finish dated longer ago than this was backdated (an import), not just made. */
const FRESH = 60_000;

const changed = <T,>(a: Record<string, T>, b: Record<string, T>) => (a === b ? [] : Object.keys(b).filter((id) => a[id] && a[id] !== b[id]));

/** Seasons whose every aired episode is watched. */
function doneSeasons(show: Show, now: number) {
  const out = new Set<number>();
  for (const { season, episodes } of seasonsOf(show.episodes)) {
    const aired = episodes.filter((e) => e.airstamp && e.airstamp <= now);
    if (aired.length && aired.length === episodes.length && aired.every((e) => show.watched[e.id])) out.add(season);
  }
  return out;
}

/** The one moment to mark for this change (the biggest), if any. */
export function milestoneOf(prev: Library, next: Library, goals: Partial<Record<StatKind, number>>, now = Date.now()): Milestone | undefined {
  const shows = changed(prev.shows, next.shows).filter((id) => prev.shows[id].watched !== next.shows[id].watched);
  const movies = changed(prev.movies, next.movies);
  const books = changed(prev.books, next.books);
  const games = changed(prev.games, next.games);
  if (shows.length + movies.length + books.length + games.length > BULK) return undefined;
  if (!shows.length && !movies.length && !books.length && !games.length) return undefined;

  const year = new Date(now).getFullYear();
  const stats: StatKind[] = [...(movies.length ? ['movie' as const] : []), ...(books.length ? ['book' as const] : []), ...(games.length ? ['game' as const] : [])];
  if (stats.some((k) => goals[k])) {
    const before = countsOf(prev, year);
    const after = countsOf(next, year);
    for (const stat of stats) {
      const goal = goals[stat];
      if (goal && before[stat] < goal && after[stat] >= goal) return { kind: 'goal', stat, count: after[stat], year };
    }
  }

  for (const id of shows) {
    const a = prev.shows[id];
    const b = next.shows[id];
    if (showState(a, now) !== 'finished' && showState(b, now, progressOf(b, now)) === 'finished') return { kind: 'showFinished', show: b };
  }
  const fresh = (at?: number) => !!at && Math.abs(now - at) < FRESH;
  for (const id of books) if (!prev.books[id].finishedAt && fresh(next.books[id].finishedAt)) return { kind: 'bookFinished', book: next.books[id] };
  for (const id of games) if (!prev.games[id].finishedAt && fresh(next.games[id].finishedAt)) return { kind: 'gameFinished', game: next.games[id] };
  for (const id of shows) {
    const before = doneSeasons(prev.shows[id], now);
    const after = doneSeasons(next.shows[id], now);
    const added = [...after].filter((s) => !before.has(s));
    // One season ticked off, not several at once (a whole show marked at once is not a season moment).
    if (added.length === 1) return { kind: 'seasonDone', show: next.shows[id], season: added[0] };
  }
  return undefined;
}
