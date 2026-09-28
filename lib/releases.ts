/**
 * The only time-aware part of the palace: knowing when something you care about comes
 * out. Series are followed through TVmaze (next episode air time); anything added with
 * a future release date is awaited. Both become quiet local notifications — no server,
 * no account.
 */
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import i18n from '@/locales/i18n';
import { fetchNextEpisode, lookupTvmazeId } from './catalog';
import { PalaceItem } from './types';
import { usePalaceStore } from '@/store/usePalaceStore';

const CHECK_KEY = 'palais-mental/releases-checked';
const CHECK_EVERY = 6 * 3_600_000;
const CHANNEL = 'releases';

export interface Upcoming {
  item: PalaceItem;
  date: number;
  kind: 'release' | 'episode';
  season?: number;
  episode?: number;
}

/** Everything still to come, soonest first. A day of grace keeps "out today" visible. */
export function getUpcoming(items: Record<string, PalaceItem>, now = Date.now()): Upcoming[] {
  const out: Upcoming[] = [];
  const cutoff = now - 86_400_000;
  for (const item of Object.values(items)) {
    if (item.releaseDate && item.releaseDate > cutoff) out.push({ item, date: item.releaseDate, kind: 'release' });
    const ep = item.nextEpisode;
    if (ep && ep.date > cutoff) out.push({ item, date: ep.date, kind: 'episode', season: ep.season, episode: ep.number });
  }
  return out.sort((a, b) => a.date - b.date);
}

export function isAwaited(item: PalaceItem, now = Date.now()) {
  return !!item.releaseDate && item.releaseDate > now;
}

/** Ask TVmaze for the next episode of every followed series (at most every few hours). */
export async function refreshEpisodes(force = false) {
  try {
    const last = Number(await AsyncStorage.getItem(CHECK_KEY)) || 0;
    if (!force && Date.now() - last < CHECK_EVERY) return;
    await AsyncStorage.setItem(CHECK_KEY, String(Date.now()));
  } catch {
    // storage unavailable: still refresh
  }
  const state = usePalaceStore.getState();
  const series = Object.values(state.items).filter((i) => i.category === 'series');
  for (const item of series) {
    let id = item.tvmazeId;
    if (!id) {
      id = await lookupTvmazeId(item.title);
      if (!id) continue;
      usePalaceStore.setState((s) => (s.items[item.id] ? { items: { ...s.items, [item.id]: { ...s.items[item.id], tvmazeId: id } } } : s));
    }
    usePalaceStore.getState().setNextEpisode(item.id, await fetchNextEpisode(id));
  }
}

// ------------------------------------------------------------------ Notifications
export async function notificationPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (Platform.OS === 'web') return 'denied';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status as 'granted' | 'denied' | 'undetermined';
  } catch {
    return 'denied';
  }
}

export async function requestNotifications() {
  if (Platform.OS === 'web') return false;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Morning of the release day, local time — never in the middle of the night. */
function releaseMoment(date: number) {
  const d = new Date(date);
  d.setHours(9, 0, 0, 0);
  return d.getTime();
}

/** Rebuild every scheduled notification from the current collection (idempotent). */
export async function scheduleReleaseNotifications() {
  if (Platform.OS === 'web') return;
  const { items, settings } = usePalaceStore.getState();
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!settings.notifications || (await notificationPermission()) !== 'granted') return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: i18n.t('soon.channel'),
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const now = Date.now();
    for (const u of getUpcoming(items, now)) {
      const at = u.kind === 'release' ? releaseMoment(u.date) : u.date;
      if (at <= now + 60_000) continue;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: u.kind === 'release' ? i18n.t('soon.outToday') : i18n.t('soon.newEpisode'),
          body:
            u.kind === 'release'
              ? u.item.title
              : `${u.item.title} · ${i18n.t('soon.episodeCode', { season: u.season, episode: u.episode })}`,
          data: { itemId: u.item.id },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at), channelId: CHANNEL },
      });
    }
  } catch {
    // Scheduling is best-effort; the Soon tab still shows everything.
  }
}

/** Keep releases fresh: on launch, whenever the app returns to the foreground, and when the collection changes. */
export function startReleaseSync() {
  if (Platform.OS !== 'web') {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
  }
  const run = (force = false) => refreshEpisodes(force).then(scheduleReleaseNotifications);
  run();
  const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsub = usePalaceStore.subscribe((s, prev) => {
    if (s.items === prev.items && s.settings === prev.settings) return;
    clearTimeout(timer);
    timer = setTimeout(scheduleReleaseNotifications, 1500);
  });
  return () => {
    sub.remove();
    unsub();
    clearTimeout(timer);
  };
}
