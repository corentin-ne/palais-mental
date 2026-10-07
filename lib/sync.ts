/**
 * Keeps the library fresh and tells you when things come out: shows still airing are
 * refreshed from TVmaze every few hours, awaited films daily, and every upcoming episode
 * or release becomes a local notification. No server, no account.
 */
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import i18n from '@/locales/i18n';
import { fetchMovie, fetchShow } from './api';
import { episodeCode } from './progress';
import { Episode, Movie, Show } from './types';
import { useLibrary } from '@/store/useLibrary';

const SHOW_EVERY = 6 * 3_600_000;
const ENDED_EVERY = 7 * 86_400_000;
const MOVIE_EVERY = 86_400_000;
const CHANNEL = 'releases';
/** iOS keeps at most 64 pending notifications. */
const MAX_SCHEDULED = 60;

export type UpcomingEntry =
  | { kind: 'episode'; date: number; show: Show; episode: Episode }
  | { kind: 'movie'; date: number; movie: Movie };

/** Everything still to come, soonest first. Anything from today stays visible all day. */
export function getUpcoming(shows: Record<string, Show>, movies: Record<string, Movie>, now = Date.now()): UpcomingEntry[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const from = start.getTime();
  const out: UpcomingEntry[] = [];
  for (const show of Object.values(shows)) {
    if (show.droppedAt) continue;
    for (const episode of show.episodes) if (episode.airstamp && episode.airstamp >= from) out.push({ kind: 'episode', date: episode.airstamp, show, episode });
  }
  for (const movie of Object.values(movies)) if (!movie.watchedAt && movie.releaseDate && movie.releaseDate >= from) out.push({ kind: 'movie', date: movie.releaseDate, movie });
  return out.sort((a, b) => a.date - b.date);
}

let refreshing = false;

/** Refresh stale entries. `force` refreshes everything (pull to refresh). */
export async function refreshLibrary(force = false) {
  if (refreshing) return;
  refreshing = true;
  try {
    const { shows, movies, settings } = useLibrary.getState();
    const now = Date.now();
    const lang = i18n.language;
    const staleShows = Object.values(shows).filter((s) => force || now - s.syncedAt > (s.status === 'Ended' ? ENDED_EVERY : SHOW_EVERY));
    const staleMovies = Object.values(movies).filter((m) => force || (!m.watchedAt && (!m.releaseDate || m.releaseDate > now - 30 * 86_400_000) && now - m.syncedAt > MOVIE_EVERY));
    // A few at a time: TVmaze allows about 20 calls per 10 seconds.
    for (let i = 0; i < staleShows.length; i += 4) {
      await Promise.all(
        staleShows.slice(i, i + 4).map(async (s) => {
          try {
            const { show } = await fetchShow(s.tvmazeId, settings.tmdbKey || undefined);
            useLibrary.getState().updateShow(show);
          } catch {
            // Offline or rate limited: try next time.
          }
        }),
      );
    }
    await Promise.all(
      staleMovies.map(async (m) => {
        try {
          const { movie } = await fetchMovie(m.id, { tmdbKey: settings.tmdbKey || undefined, lang });
          useLibrary.getState().updateMovie({ ...movie, poster: movie.poster ?? m.poster });
        } catch {
          // keep what we have
        }
      }),
    );
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

/** Rebuild every scheduled notification from the library (idempotent). */
export async function scheduleNotifications() {
  if (Platform.OS === 'web') return;
  const { shows, movies, settings } = useLibrary.getState();
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!settings.notifications || (await notificationPermission()) !== 'granted') return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, { name: i18n.t('calendar.channel'), importance: Notifications.AndroidImportance.DEFAULT });
    }
    const now = Date.now();
    const entries = getUpcoming(shows, movies, now)
      .map((u) => ({ u, at: u.kind === 'movie' ? morningOf(u.date) : u.date }))
      .filter(({ at }) => at > now + 60_000)
      .slice(0, MAX_SCHEDULED);
    for (const { u, at } of entries) {
      await Notifications.scheduleNotificationAsync({
        content:
          u.kind === 'movie'
            ? { title: i18n.t('notify.movieTitle'), body: u.movie.title, data: { url: `/movie/${u.movie.id}` } }
            : {
                title: u.show.title,
                body: i18n.t('notify.episode', { code: episodeCode(u.episode), name: u.episode.name }),
                data: { url: `/show/${u.show.tvmazeId}` },
              },
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
  const run = () => refreshLibrary().then(scheduleNotifications);
  // Wait for the persisted library before the first refresh.
  if (useLibrary.persist.hasHydrated()) run();
  const unhydrate = useLibrary.persist.onFinishHydration(run);
  const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsub = useLibrary.subscribe((s, prev) => {
    if (s.shows === prev.shows && s.movies === prev.movies && s.settings === prev.settings) return;
    clearTimeout(timer);
    timer = setTimeout(scheduleNotifications, 2000);
  });
  return () => {
    unhydrate();
    sub.remove();
    unsub();
    clearTimeout(timer);
  };
}
