/**
 * Keeps artwork on every object. Anything without a cover (added by hand, or from a
 * source without images) is looked up across the catalog in the background, one object
 * at a time, and every cover gives its object a colour. Misses are remembered for a few
 * days so an offline or obscure title is not searched on every launch.
 */
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import i18n from '@/locales/i18n';
import { findCover } from './catalog';
import { extractCoverColor } from './coverColor';
import { usePalaceStore } from '@/store/usePalaceStore';

const MISSES_KEY = 'palais-mental/cover-misses';
const RETRY_AFTER = 3 * 86_400_000;

let running = false;
/** Covers whose colour could not be read this session (no CORS, broken image). */
const colourMisses = new Set<string>();

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
    // Colour every object from its artwork (web only; see lib/coverColor).
    const uncoloured = Object.values(usePalaceStore.getState().items).filter((i) => i.coverUrl && !i.coverColor && !colourMisses.has(i.coverUrl));
    for (const item of uncoloured) {
      const color = await extractCoverColor(item.coverUrl!);
      if (!color) {
        colourMisses.add(item.coverUrl!);
        continue;
      }
      usePalaceStore.setState((s) =>
        s.items[item.id]?.coverUrl === item.coverUrl ? { items: { ...s.items, [item.id]: { ...s.items[item.id], coverColor: color } } } : s,
      );
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
    if (s.items === prev.items) return;
    // Only additions and new artwork need a pass; ordinary edits don't.
    const added = Object.keys(s.items).length > Object.keys(prev.items).length;
    const recolour = Object.values(s.items).some((i) => i.coverUrl && !i.coverColor && prev.items[i.id]?.coverUrl !== i.coverUrl);
    if (!added && !recolour) return;
    clearTimeout(timer);
    timer = setTimeout(fillMissingCovers, 2500);
  });
  return () => {
    sub.remove();
    unsub();
    clearTimeout(timer);
  };
}
