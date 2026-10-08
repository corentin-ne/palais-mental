/**
 * Keeps the library fresh and tells you when things come out: shows still airing are
 * refreshed from TVmaze every few hours, awaited films daily, and every upcoming episode
 * or release becomes a local notification. No server, no account.
 */
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import i18n from '@/locales/i18n';
import { fetchMovie, fetchShow } from './api';
import { fetchBook } from './books';
import { fetchGame } from './games';
import { autoSnapshot } from './backup';
import { autoSyncAccounts } from './connect';
import { refreshMovieSeries } from './collections';
import { refreshRelated, relationLabel, visibleRelated } from './related';
import { episodeCode } from './progress';
import { Book, Episode, Game, Movie, Show } from './types';
import { useLibrary } from '@/store/useLibrary';
import { RelatedRelease, useConnections } from '@/store/useConnections';

const SHOW_EVERY = 6 * 3_600_000;
const ENDED_EVERY = 7 * 86_400_000;
const MOVIE_EVERY = 86_400_000;
const CHANNEL = 'releases';
/** iOS keeps at most 64 pending notifications. */
const MAX_SCHEDULED = 60;

export type UpcomingEntry =
  | { kind: 'episode'; date: number; show: Show; episode: Episode }
  | { kind: 'movie'; date: number; movie: Movie }
  | { kind: 'book'; date: number; book: Book }
  | { kind: 'game'; date: number; game: Game }
  | { kind: 'related'; date: number; related: RelatedRelease };

/** Everything still to come, soonest first. Anything from today stays visible all day. */
export function getUpcoming(
  shows: Record<string, Show>,
  movies: Record<string, Movie>,
  now = Date.now(),
  related: RelatedRelease[] = [],
  books: Record<string, Book> = {},
  games: Record<string, Game> = {},
): UpcomingEntry[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const from = start.getTime();
  const out: UpcomingEntry[] = [];
  for (const show of Object.values(shows)) {
    if (show.droppedAt) continue;
    for (const episode of show.episodes) if (episode.airstamp && episode.airstamp >= from) out.push({ kind: 'episode', date: episode.airstamp, show, episode });
  }
  for (const movie of Object.values(movies)) if (!movie.watchedAt && movie.releaseDate && movie.releaseDate >= from) out.push({ kind: 'movie', date: movie.releaseDate, movie });
  for (const book of Object.values(books)) if (!book.finishedAt && !book.droppedAt && book.releaseDate && book.releaseDate >= from) out.push({ kind: 'book', date: book.releaseDate, book });
  for (const game of Object.values(games)) if (!game.finishedAt && !game.droppedAt && game.releaseDate && game.releaseDate >= from) out.push({ kind: 'game', date: game.releaseDate, game });
  for (const r of related) if (r.date >= from) out.push({ kind: 'related', date: r.date, related: r });
  return out.sort((a, b) => a.date - b.date);
}

let refreshing = false;

/** Refresh stale entries. `force` refreshes everything (pull to refresh). */
export async function refreshLibrary(force = false) {
  if (refreshing) return;
  refreshing = true;
  try {
    const { shows, movies, books, games, settings } = useLibrary.getState();
    const now = Date.now();
    const lang = i18n.language;
    // Books and games are refreshed while their date is unknown or near: dates move before release.
    const awaited = (x: { releaseDate?: number; finishedAt?: number; syncedAt: number }) =>
      force || (!x.finishedAt && (!x.releaseDate || x.releaseDate > now - 30 * 86_400_000) && now - x.syncedAt > MOVIE_EVERY);
    const staleBooks = Object.values(books).filter(awaited);
    const staleGames = Object.values(games).filter(awaited);
    const staleShows = Object.values(shows).filter((s) => force || now - s.syncedAt > (s.status === 'Ended' ? ENDED_EVERY : SHOW_EVERY));
    const staleMovies = Object.values(movies).filter((m) => force || (!m.watchedAt && (!m.releaseDate || m.releaseDate > now - 30 * 86_400_000) && now - m.syncedAt > MOVIE_EVERY));
    /** `size` at a time: each source has its own rate limit (TVmaze about 20 calls per 10 s). */
    const inBatches = async <T,>(list: T[], size: number, run: (x: T) => Promise<void>) => {
      for (let i = 0; i < list.length; i += size) await Promise.all(list.slice(i, i + size).map((x) => run(x).catch(() => undefined)));
    };
    // Different hosts: shows, films, books and games refresh side by side. Failures (offline,
    // rate limited) keep what we have until next time.
    await Promise.all([
      inBatches(staleShows, 4, async (s) => {
        const { show } = await fetchShow(s.tvmazeId, settings.tmdbKey || undefined);
        useLibrary.getState().updateShow(show);
      }),
      inBatches(staleMovies, 8, async (m) => {
        const { movie } = await fetchMovie(m.id, { tmdbKey: settings.tmdbKey || undefined, lang });
        useLibrary.getState().updateMovie({ ...movie, poster: movie.poster ?? m.poster });
      }),
      inBatches(staleBooks, 4, async (b) => {
        const { book, redirect } = await fetchBook(b.id, lang);
        if (!redirect) useLibrary.getState().updateBook({ ...book, cover: book.cover ?? b.cover });
      }),
      inBatches(staleGames, 4, async (g) => {
        const { game, redirect } = await fetchGame(g.id, lang);
        if (!redirect) useLibrary.getState().updateGame({ ...game, cover: game.cover ?? g.cover });
      }),
    ]);
  } finally {
    refreshing = false;
  }
}

// ------------------------------------------------------------------ Notifications
export async function notificationPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (Platform.OS === 'web') return 'denied';
  try {
    return (await Notifications.getPermissionsAsync()).status as 'granted' | 'denied' | 'undetermined';
  } catch {
    return 'denied';
  }
}

export async function requestNotifications() {
  if (Platform.OS === 'web') return false;
  try {
    return (await Notifications.requestPermissionsAsync()).status === 'granted';
  } catch {
    return false;
  }
}

/** Films are announced on the morning of their release day, local time. */
const morningOf = (date: number) => {
  const d = new Date(date);
  d.setHours(9, 0, 0, 0);
  return d.getTime();
};

function notificationFor(u: UpcomingEntry) {
  switch (u.kind) {
    case 'movie':
      return { title: i18n.t('notify.movieTitle'), body: u.movie.title, data: { url: `/movie/${u.movie.id}` } };
    case 'book':
      return { title: i18n.t('notify.bookTitle'), body: [u.book.title, u.book.authors[0]].filter(Boolean).join(' · '), data: { url: `/book/${u.book.id}` } };
    case 'game':
      return { title: i18n.t('notify.gameTitle'), body: u.game.title, data: { url: `/game/${u.game.id}` } };
    case 'related': {
      const r = u.related;
      const url = r.href ?? (r.kind === 'movie' ? `/movie/imdb-${r.imdbId}` : `/show/name:${encodeURIComponent(r.title)}`);
      return { title: i18n.t(r.relation === 'sequel' ? 'notify.sequelTitle' : 'notify.relatedTitle'), body: `${r.title} · ${relationLabel(r)}`, data: { url } };
    }
    default:
      return { title: u.show.title, body: i18n.t('notify.episode', { code: episodeCode(u.episode), name: u.episode.name }), data: { url: `/show/${u.show.tvmazeId}` } };
  }
}

/** Rebuild every scheduled notification from the library (idempotent). */
export async function scheduleNotifications() {
  if (Platform.OS === 'web') return;
  const { shows, movies, books, games, settings } = useLibrary.getState();
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!settings.notifications || (await notificationPermission()) !== 'granted') return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, { name: i18n.t('calendar.channel'), importance: Notifications.AndroidImportance.DEFAULT });
    }
    const now = Date.now();
    const related = settings.related ? visibleRelated(useConnections.getState().related.entries) : [];
    const entries = getUpcoming(shows, movies, now, related, books, games)
      .map((u) => ({ u, at: u.kind === 'episode' ? u.date : morningOf(u.date) }))
      .filter(({ at }) => at > now + 60_000)
      .slice(0, MAX_SCHEDULED);
    for (const { u, at } of entries) {
      await Notifications.scheduleNotificationAsync({
        content: notificationFor(u),
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at), channelId: CHANNEL },
      });
    }
  } catch {
    // Best effort: the calendar still shows everything.
  }
}

/** Refresh on launch and on every return to the foreground; reschedule when the library changes. */
export function startSync() {
  if (Platform.OS !== 'web') {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
  }
  // One pass at a time: coming back to the app while a pass runs doesn't start a second one.
  let pass: Promise<void> | undefined;
  const run = () =>
    (pass ??= (async () => {
      if (!useConnections.persist.hasHydrated()) await new Promise<void>((resolve) => useConnections.persist.onFinishHydration(() => resolve()));
      await autoSnapshot();
      await refreshLibrary();
      // Notifications don't wait on connected accounts; related releases do (a sync can add seeds).
      // Film series (for the library's collections) come after: films a sync adds are looked up too.
      await Promise.all([scheduleNotifications(), autoSyncAccounts().catch(() => undefined).then(() => Promise.all([refreshRelated(), refreshMovieSeries()]))]);
    })().finally(() => {
      pass = undefined;
    }));
  // Wait for the persisted library before the first refresh.
  if (useLibrary.persist.hasHydrated()) run();
  const unhydrate = useLibrary.persist.onFinishHydration(run);
  const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsub = useLibrary.subscribe((s, prev) => {
    if (s.shows === prev.shows && s.movies === prev.movies && s.books === prev.books && s.games === prev.games && s.settings === prev.settings) return;
    clearTimeout(timer);
    timer = setTimeout(scheduleNotifications, 2000);
  });
  const unsubRelated = useConnections.subscribe((s, prev) => {
    if (s.related === prev.related) return;
    clearTimeout(timer);
    timer = setTimeout(scheduleNotifications, 2000);
  });
  return () => {
    unsubRelated();
    unhydrate();
    sub.remove();
    unsub();
    clearTimeout(timer);
  };
}
