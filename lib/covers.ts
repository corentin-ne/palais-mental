/**
 * Keeps artwork on every object. Anything without a cover (added by hand, or from a
 * source without images) is looked up across the catalog in the background, one object
 * at a time. Misses are remembered for a few days so an offline or obscure title is not
 * searched on every launch.
 */
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import i18n from '@/locales/i18n';
import { findCover } from './catalog';
import { usePalaceStore } from '@/store/usePalaceStore';

const MISSES_KEY = 'palais-mental/cover-misses';
const RETRY_AFTER = 3 * 86_400_000;

let running = false;

async function loadMisses(): Promise<Record<string, number>> {
  try {
    return JSON.parse((await AsyncStorage.getItem(MISSES_KEY)) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

/** Find artwork for every object that has none. Safe to call often: runs one pass at a time. */
export async function fillMissingCovers() {
  if (running) return;
  running = true;
  try {
    const misses = await loadMisses();
    const now = Date.now();
    const pending = Object.values(usePalaceStore.getState().items).filter(
      (i) => !i.coverUrl && i.title && !(misses[i.id] && now - misses[i.id] < RETRY_AFTER),
    );
    for (const item of pending) {
      const cover = await findCover(item.category, item.title, item.creator, { lang: i18n.language ?? 'en' });
      if (cover) {
        // Written directly: finding artwork is not an edit and must not reorder "recently touched".
        usePalaceStore.setState((s) =>
          s.items[item.id] && !s.items[item.id].coverUrl ? { items: { ...s.items, [item.id]: { ...s.items[item.id], coverUrl: cover } } } : s,
        );
        delete misses[item.id];
      } else {
        misses[item.id] = now;
      }
    }
    const live = usePalaceStore.getState().items;
    for (const id of Object.keys(misses)) if (!live[id]) delete misses[id];
    await AsyncStorage.setItem(MISSES_KEY, JSON.stringify(misses)).catch(() => undefined);
  } finally {
    running = false;
  }
}

/** Run on launch, when the app returns to the foreground, and shortly after objects are added. */
export function startCoverSync() {
  fillMissingCovers();
  const sub = AppState.addEventListener('change', (s) => s === 'active' && fillMissingCovers());
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsub = usePalaceStore.subscribe((s, prev) => {
    if (s.items === prev.items || Object.keys(s.items).length <= Object.keys(prev.items).length) return;
    clearTimeout(timer);
    timer = setTimeout(fillMissingCovers, 2500);
  });
  return () => {
    sub.remove();
    unsub();
    clearTimeout(timer);
  };
}
