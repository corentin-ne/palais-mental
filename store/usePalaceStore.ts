import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CATEGORIES, CameraFocus, CategoryId, HeroEvent, PalaceItem, SeriesItem } from '@/lib/types';
import { getRoomLevel } from '@/lib/palaceLayout';
import type { LanguagePreference } from '@/locales/i18n';

const DEFAULT_EPISODES = 10;
const MAX_EPISODES = 64;

type CategoryOrder = Record<CategoryId, string[]>;

export interface PalaceState {
  /** Normalized item table. */
  items: Record<string, PalaceItem>;
  /** Per-category slot order: index in this array === shelf slot index. */
  order: CategoryOrder;
  language: LanguagePreference;

  // ---- transient (not persisted)
  focus: CameraFocus;
  /** FIFO of center-screen rewards. heroQueue[0] is the live Hero Object. */
  heroQueue: HeroEvent[];

  logItem: (category: CategoryId, title: string, opts?: { episodeCount?: number }) => string;
  logEpisode: (seriesId: string) => HeroEvent | null;
  addSeason: (seriesId: string, episodeCount: number) => void;
  /** Hero Swap commit: the hero unmounts and the item joins its shelf InstancedMesh. */
  completeHero: (eventId: string) => void;
  setFocus: (focus: CameraFocus) => void;
  setLanguage: (language: LanguagePreference) => void;
  resetPalace: () => void;
}

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const clampEpisodes = (n: number) => Math.max(1, Math.min(MAX_EPISODES, Math.round(n) || DEFAULT_EPISODES));

const emptyOrder = (): CategoryOrder =>
  Object.fromEntries(CATEGORIES.map((c) => [c, [] as string[]])) as unknown as CategoryOrder;

// ------------------------------------------------------------------ Series math
export interface SeriesProgress {
  /** Season currently being watched (first incomplete), or last season if all done. */
  seasonIndex: number;
  watched: number;
  total: number;
  /** watched / total, 0..1 — the disc's pie fraction. */
  fraction: number;
  allComplete: boolean;
}

export function getSeriesProgress(item: SeriesItem): SeriesProgress {
  const idx = item.seasons.findIndex((s) => s.watched < s.episodeCount);
  const seasonIndex = idx === -1 ? item.seasons.length - 1 : idx;
  const season = item.seasons[seasonIndex];
  return {
    seasonIndex,
    watched: season.watched,
    total: season.episodeCount,
    fraction: season.watched / season.episodeCount,
    allComplete: idx === -1,
  };
}

/** Slice i of n spans [2π·i/n, 2π·(i+1)/n). */
export function getSliceAngles(episodeIndex: number, episodeCount: number) {
  const length = (Math.PI * 2) / episodeCount;
  return { start: episodeIndex * length, length };
}

// ------------------------------------------------------------------ Store
export const usePalaceStore = create<PalaceState>()(
  persist(
    (set, get) => ({
      items: {},
      order: emptyOrder(),
      language: 'system',
      focus: 'overview',
      heroQueue: [],

      logItem: (category, title, opts) => {
        const id = uid();
        const base = { id, title: title.trim(), createdAt: Date.now(), settled: false };
        const item: PalaceItem =
          category === 'series'
            ? { ...base, category, seasons: [{ episodeCount: clampEpisodes(opts?.episodeCount ?? DEFAULT_EPISODES), watched: 0 }] }
            : { ...base, category };

        set((s) => ({
          items: { ...s.items, [id]: item },
          // Slot is reserved immediately so the hero knows where to fly.
          order: { ...s.order, [category]: [...s.order[category], id] },
          heroQueue: [...s.heroQueue, { id: uid(), kind: 'item', itemId: id }],
        }));
        return id;
      },

      logEpisode: (seriesId) => {
        const item = get().items[seriesId];
        if (!item || item.category !== 'series') return null;
        const progress = getSeriesProgress(item);
        if (progress.allComplete) return null;

        const seasons = item.seasons.map((s, i) => (i === progress.seasonIndex ? { ...s, watched: s.watched + 1 } : s));
        const event: HeroEvent = {
          id: uid(),
          kind: 'episode',
          itemId: seriesId,
          seasonIndex: progress.seasonIndex,
          episodeIndex: progress.watched,
          episodeCount: progress.total,
          completesSeason: progress.watched + 1 === progress.total,
        };
        // Progress is committed (and persisted) right away; the hero is purely presentational.
        set((s) => ({
          items: { ...s.items, [seriesId]: { ...item, seasons } },
          heroQueue: [...s.heroQueue, event],
        }));
        return event;
      },

      addSeason: (seriesId, episodeCount) => {
        const item = get().items[seriesId];
        if (!item || item.category !== 'series') return;
        set((s) => ({
          items: {
            ...s.items,
            [seriesId]: { ...item, seasons: [...item.seasons, { episodeCount: clampEpisodes(episodeCount), watched: 0 }] },
          },
        }));
      },

      completeHero: (eventId) => {
        const [head, ...rest] = get().heroQueue;
        if (!head || head.id !== eventId) return;
        const item = get().items[head.itemId];
        set((s) => ({
          heroQueue: rest,
          items: item && !item.settled ? { ...s.items, [item.id]: { ...item, settled: true } } : s.items,
        }));
      },

      setFocus: (focus) => set({ focus }),
      setLanguage: (language) => set({ language }),
      resetPalace: () => set({ items: {}, order: emptyOrder(), heroQueue: [], focus: 'overview' }),
    }),
    {
      name: 'palais-mental/v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ items: s.items, order: s.order, language: s.language }),
      // Any hero interrupted by an app kill lands directly on its shelf.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PalaceState>;
        const items = Object.fromEntries(
          Object.entries(p.items ?? {}).map(([id, it]) => [id, { ...it, settled: true }]),
        ) as Record<string, PalaceItem>;
        return { ...current, ...p, items, order: { ...emptyOrder(), ...p.order } };
      },
    },
  ),
);

// ------------------------------------------------------------------ Selectors
export const selectTotalItems = (s: PalaceState) => Object.keys(s.items).length;
export const selectRoomLevel = (s: PalaceState) => getRoomLevel(Object.keys(s.items).length);
export const selectActiveHero = (s: PalaceState): HeroEvent | undefined => s.heroQueue[0];
export const selectCategoryCount = (category: CategoryId) => (s: PalaceState) => s.order[category].length;
