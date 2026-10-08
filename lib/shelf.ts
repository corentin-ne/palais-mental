/** Pure helpers for books and games: where you are in them. */
import { Book, Game, ShelfState } from './types';

type Shelved = Pick<Book | Game, 'startedAt' | 'finishedAt' | 'droppedAt' | 'releaseDate'>;

export function shelfState(item: Shelved & { page?: number; hours?: number; percent?: number }, now = Date.now()): ShelfState {
  if (item.droppedAt) return 'dropped';
  if (item.finishedAt) return 'finished';
  if (item.startedAt || item.page || item.hours || item.percent) return 'started';
  if (item.releaseDate && item.releaseDate > now) return 'upcoming';
  return 'want';
}

/** 0–1 through a book, from the page you are at. */
export const bookFraction = (b: Pick<Book, 'page' | 'pages' | 'finishedAt'>) =>
  b.finishedAt ? 1 : b.page && b.pages ? Math.min(1, b.page / b.pages) : 0;

/** 0–1 through a game, from the completion you set. */
export const gameFraction = (g: Pick<Game, 'percent' | 'finishedAt'>) => (g.finishedAt ? 1 : g.percent ? Math.min(1, g.percent / 100) : 0);

/** Last time you did something with it. */
export const shelfActivity = (item: Pick<Book | Game, 'addedAt' | 'startedAt' | 'finishedAt'> & { touchedAt?: number }) =>
  Math.max(item.addedAt, item.startedAt ?? 0, item.finishedAt ?? 0, item.touchedAt ?? 0);

export const clampPage = (page: number, pages?: number) => Math.max(0, Math.min(pages || Infinity, Math.round(page)));

/** Pages read: the whole book once finished, else the page you are at. */
export const pagesRead = (b: Book) => (b.finishedAt ? (b.pages ?? b.page ?? 0) : (b.page ?? 0));

export const SHELF_STATES: ShelfState[] = ['started', 'want', 'upcoming', 'finished', 'dropped'];
