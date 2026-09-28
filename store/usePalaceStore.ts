import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CATEGORIES,
  CameraFocus,
  CategoryId,
  HeroEvent,
  ItemDetails,
  PalaceItem,
  PalaceSettings,
  SeriesItem,
} from '@/lib/types';
import { getRoomLevel } from '@/lib/palaceLayout';
import type { LanguagePreference } from '@/locales/i18n';

export const DEFAULT_EPISODES = 10;
export const MAX_EPISODES = 64;

type CategoryOrder = Record<CategoryId, string[]>;

export interface PalaceState {
  /** Normalized item table. */
  items: Record<string, PalaceItem>;
  /** Per-category slot order: index in this array === shelf slot index. */
  order: CategoryOrder;
  language: LanguagePreference;
  settings: PalaceSettings;

  // ---- transient (not persisted)
  focus: CameraFocus;
  /** FIFO of center-screen rewards. heroQueue[0] is the live Hero Object. */
  heroQueue: HeroEvent[];
  /** Item whose detail sheet is open. */
  selectedId: string | null;
  /**
   * Item currently lifted out of its niche by the 3D inspector. Outlives `selectedId`
   * while the object glides back to its slot, then the inspector clears it.
   */
  inspectId: string | null;

  logItem: (category: CategoryId, details: ItemDetails, opts?: { episodeCount?: number }) => string;
  updateItem: (id: string, patch: Partial<ItemDetails>) => void;
  deleteItem: (id: string) => void;
  logEpisode: (seriesId: string) => HeroEvent | null;
  addSeason: (seriesId: string, episodeCount: number) => void;
  /** Hero Swap commit: the hero unmounts and the item joins its shelf InstancedMesh. */
  completeHero: (eventId: string) => void;
  setFocus: (focus: CameraFocus) => void;
  selectItem: (id: string | null) => void;
  endInspect: (id: string) => void;
  setLanguage: (language: LanguagePreference) => void;
  setSetting: <K extends keyof PalaceSettings>(key: K, value: PalaceSettings[K]) => void;
  resetPalace: () => void;
}

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
export const clampEpisodes = (n: number) => Math.max(1, Math.min(MAX_EPISODES, Math.round(n) || DEFAULT_EPISODES));

const emptyOrder = (): CategoryOrder =>
  Object.fromEntries(CATEGORIES.map((c) => [c, [] as string[]])) as unknown as CategoryOrder;

/** Trim strings, drop empties, clamp numbers: the store never holds malformed metadata. */
function cleanDetails(patch: Partial<ItemDetails>): Partial<ItemDetails> {
  const out: Partial<ItemDetails> = {};
  if (patch.title !== undefined) out.title = patch.title.trim();
  if (patch.creator !== undefined) out.creator = patch.creator.trim() || undefined;
  if (patch.note !== undefined) out.note = patch.note.trim() || undefined;
  if (patch.year !== undefined) {
    const y = Math.round(Number(patch.year));
    out.year = Number.isFinite(y) && y > 0 && y < 10000 ? y : undefined;
  }
  if (patch.rating !== undefined) {
    const r = Math.round(Number(patch.rating) * 2) / 2;
    out.rating = Number.isFinite(r) && r > 0 ? Math.min(5, r) : undefined;
  }
  return out;
}

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
      settings: { ambient: true, haptics: true },
      focus: 'window',
      heroQueue: [],
      selectedId: null,
      inspectId: null,

      logItem: (category, details, opts) => {
        const id = uid();
        const now = Date.now();
        const clean = cleanDetails(details);
        const base = { ...clean, id, title: clean.title || '—', createdAt: now, updatedAt: now, settled: false };
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

      updateItem: (id, patch) => {
        const item = get().items[id];
        if (!item) return;
        const clean = cleanDetails(patch);
        if (clean.title !== undefined && !clean.title) delete clean.title; // never blank a title
        set((s) => ({ items: { ...s.items, [id]: { ...item, ...clean, updatedAt: Date.now() } as PalaceItem } }));
      },

      deleteItem: (id) => {
        const item = get().items[id];
        if (!item) return;
        set((s) => {
          const items = { ...s.items };
          delete items[id];
          return {
            items,
            order: { ...s.order, [item.category]: s.order[item.category].filter((x) => x !== id) },
            heroQueue: s.heroQueue.filter((e) => e.itemId !== id || e === s.heroQueue[0]),
            selectedId: s.selectedId === id ? null : s.selectedId,
            inspectId: s.inspectId === id ? null : s.inspectId,
          };
        });
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
          items: { ...s.items, [seriesId]: { ...item, seasons, updatedAt: Date.now() } },
          heroQueue: [...s.heroQueue, event],
          // The hero takes the box out of the niche itself.
          selectedId: s.selectedId === seriesId ? null : s.selectedId,
        }));
        return event;
      },

      addSeason: (seriesId, episodeCount) => {
        const item = get().items[seriesId];
        if (!item || item.category !== 'series') return;
        set((s) => ({
          items: {
            ...s.items,
            [seriesId]: {
              ...item,
              seasons: [...item.seasons, { episodeCount: clampEpisodes(episodeCount), watched: 0 }],
              updatedAt: Date.now(),
            },
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

      setFocus: (focus) => set((s) => (s.focus === focus ? s : { focus, selectedId: null })),
      selectItem: (id) => set((s) => ({ selectedId: id, inspectId: id ?? s.inspectId })),
      endInspect: (id) => set((s) => (s.inspectId === id && s.selectedId !== id ? { inspectId: null } : s)),
      setLanguage: (language) => set({ language }),
      setSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
      resetPalace: () =>
        set({ items: {}, order: emptyOrder(), heroQueue: [], focus: 'window', selectedId: null, inspectId: null }),
    }),
    {
      name: 'palais-mental/v1',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ items: s.items, order: s.order, language: s.language, settings: s.settings }),
      // v1 → v2 only added optional fields; the shape is forward compatible.
      migrate: (persisted) => persisted as Partial<PalaceState>,
      // Any hero interrupted by an app kill lands directly on its shelf.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PalaceState>;
        const items = Object.fromEntries(
          Object.entries(p.items ?? {}).map(([id, it]) => [id, { ...it, settled: true }]),
        ) as Record<string, PalaceItem>;
        return {
          ...current,
          ...p,
          items,
          order: { ...emptyOrder(), ...p.order },
          settings: { ...current.settings, ...p.settings },
        };
      },
    },
  ),
);

// ------------------------------------------------------------------ Selectors
export const selectTotalItems = (s: PalaceState) => Object.keys(s.items).length;
export const selectRoomLevel = (s: PalaceState) => getRoomLevel(Object.keys(s.items).length);
export const selectActiveHero = (s: PalaceState): HeroEvent | undefined => s.heroQueue[0];
export const selectCategoryCount = (category: CategoryId) => (s: PalaceState) => s.order[category].length;
