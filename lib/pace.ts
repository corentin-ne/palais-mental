/** Pure: how much is left of what you're in the middle of, and when you'll be done at your own pace. */
import { progressOf } from './progress';
import { Book, Game, Show } from './types';

const DAY = 86_400_000;
/** Your pace is read over this window: what you did lately, not three years ago. */
const WINDOW = 28 * DAY;

export interface Pace {
  /** Minutes left (shows), pages left (books) or hours left (games). */
  left: number;
  unit: 'minutes' | 'pages' | 'hours';
  /** When you'd be done going on as you have lately; absent until there is a pace to speak of. */
  finishAt?: number;
  /** Per day, over the window (episodes, pages, hours). */
  perDay?: number;
}

export function showPace(show: Show, now = Date.now()): Pace | undefined {
  const p = progressOf(show, now);
  if (!p.left) return undefined;
  const left = p.ahead.reduce((n, e) => n + (e.runtime ?? show.runtime ?? 0), 0);
  const recent = Object.values(show.watched).filter((at) => at > now - WINDOW);
  if (recent.length < 2) return { left, unit: 'minutes' };
  // Over the days since the first of those episodes (a week at least): three in two days isn't a pace yet.
  const span = Math.max(7, (now - Math.min(...recent)) / DAY);
  const perDay = recent.length / span;
  return { left, unit: 'minutes', perDay, finishAt: now + Math.ceil(p.left / perDay) * DAY };
}

export function bookPace(book: Book, now = Date.now()): Pace | undefined {
  if (!book.pages || book.finishedAt) return undefined;
  const page = book.page ?? 0;
  const left = Math.max(0, book.pages - page);
  if (!left) return undefined;
  if (!page || !book.startedAt) return { left, unit: 'pages' };
  const span = Math.max(3, (now - book.startedAt) / DAY);
  const perDay = page / span;
  return { left, unit: 'pages', perDay, finishAt: now + Math.ceil(left / perDay) * DAY };
}

/** `typical`: the hours most people put in (HowLongToBeat). */
export function gamePace(game: Game, typical: number | undefined, now = Date.now()): Pace | undefined {
  if (!typical || game.finishedAt) return undefined;
  const hours = game.hours ?? 0;
  const left = Math.max(0, Math.round((typical - hours) * 2) / 2);
  if (!left) return undefined;
  if (!hours || !game.startedAt) return { left, unit: 'hours' };
  const span = Math.max(3, (now - game.startedAt) / DAY);
  const perDay = hours / span;
  return { left, unit: 'hours', perDay, finishAt: now + Math.ceil(left / perDay) * DAY };
}

/** A finish date this far out says nothing useful: shown as "at this pace, a while". */
export const FAR = 365 * DAY;
