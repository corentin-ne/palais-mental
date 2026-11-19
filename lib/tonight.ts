/** Pure: what fits in the time you have tonight, from what you're in the middle of and what is waiting. */
import { episodeCode, lastActivity, progressOf, showState } from './progress';
import { shelfActivity, shelfState } from './shelf';
import { Book, Game, MediaKind, Movie, Show } from './types';

type Library = { shows: Record<string, Show>; movies: Record<string, Movie>; books: Record<string, Book>; games: Record<string, Game> };

export interface Idea {
  key: string;
  kind: MediaKind;
  href: string;
  title: string;
  poster?: string;
  /** What exactly: "S02E03", "3 episodes", "about 40 pages", "a session". */
  what: { key: string; params?: Record<string, unknown> };
  minutes: number;
  /** Higher first. */
  score: number;
}

const DAY = 86_400_000;
/** When a length isn't known: a typical episode, a typical film. */
const EPISODE = 45;
const FILM = 110;
/** Minutes per page, roughly. */
const PAGE = 1.5;
/** Episodes in one go, at most. */
const BINGE = 4;

/** Recently touched counts more: 1 today, fading to 0 over a month. */
const fresh = (at: number, now: number) => Math.max(0, 1 - (now - at) / (30 * DAY));

/** `budget` in minutes; Infinity for the whole evening. `rand` is there for tests. */
export function ideasFor(lib: Library, budget: number, now = Date.now(), rand = Math.random): Idea[] {
  const out: Idea[] = [];
  const jitter = () => rand() * 0.35;

  for (const show of Object.values(lib.shows)) {
    const p = progressOf(show, now);
    const state = showState(show, now, p);
    const first = state === 'notStarted' ? show.episodes.find((e) => e.airstamp && e.airstamp <= now) : p.next;
    if ((state !== 'watching' && state !== 'notStarted') || !first) continue;
    const per = first.runtime ?? show.runtime ?? EPISODE;
    if (per > budget) continue;
    const available = state === 'watching' ? p.left : 1;
    const count = Math.max(1, Math.min(available, BINGE, Math.floor(budget / per)));
    out.push({
      key: `show:${show.id}`,
      kind: 'show',
      href: `/show/${show.tvmazeId}`,
      title: show.title,
      poster: show.poster,
      what: count > 1 ? { key: 'tonight.episodes', params: { count, from: episodeCode(first) } } : { key: 'tonight.episode', params: { code: episodeCode(first) } },
      minutes: per * count,
      // In the middle of it beats starting something; what you touched lately beats the rest.
      score: (state === 'watching' ? 1.2 : 0.6) + fresh(lastActivity(show), now) + jitter(),
    });
  }

  for (const m of Object.values(lib.movies)) {
    if (m.watchedAt || (m.releaseDate && m.releaseDate > now)) continue;
    const minutes = m.runtime ?? FILM;
    if (minutes > budget) continue;
    // A film that fills the evening well is a better answer than a short one in a long evening.
    const fit = Number.isFinite(budget) ? minutes / budget : 0.6;
    out.push({ key: `movie:${m.id}`, kind: 'movie', href: `/movie/${m.id}`, title: m.title, poster: m.poster, what: { key: 'tonight.film', params: { time: minutes } }, minutes, score: 0.7 + fit * 0.6 + jitter() });
  }

  const evening = Number.isFinite(budget) ? budget : 120;
  for (const b of Object.values(lib.books)) {
    if (shelfState(b, now) !== 'started') continue;
    const pages = Math.round(evening / PAGE / 5) * 5 || 5;
    const left = b.pages ? Math.max(0, b.pages - (b.page ?? 0)) : undefined;
    out.push({
      key: `book:${b.id}`,
      kind: 'book',
      href: `/book/${b.id}`,
      title: b.title,
      poster: b.cover,
      what: left != null && left <= pages ? { key: 'tonight.finishBook', params: { count: left } } : { key: 'tonight.pages', params: { count: pages } },
      minutes: evening,
      score: 0.9 + fresh(shelfActivity(b), now) + (left != null && left <= pages ? 0.5 : 0) + jitter(),
    });
  }
  for (const g of Object.values(lib.games)) {
    if (shelfState(g, now) !== 'started' || budget < 30) continue;
    out.push({ key: `game:${g.id}`, kind: 'game', href: `/game/${g.id}`, title: g.title, poster: g.cover, what: { key: 'tonight.session' }, minutes: evening, score: 0.9 + fresh(shelfActivity(g), now) + jitter() });
  }

  return out.sort((a, b) => b.score - a.score);
}
