import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CATEGORIES,
  CameraFocus,
  CategoryId,
  HeroEvent,
  ItemDetails,
  ItemSource,
  PalaceItem,
  PalaceSettings,
  SeriesItem,
} from '@/lib/types';
import { getRoomLevel } from '@/lib/palaceLayout';
import type { LanguagePreference } from '@/locales/i18n';

export const DEFAULT_EPISODES = 10;
export const MAX_EPISODES = 64;

type CategoryOrder = Record<CategoryId, string[]>;

export interface AddOptions {
  source?: ItemSource;
  releaseDate?: number;
  tvmazeId?: number;
  /** Series: season number to start from (1-based) and its episode count. */
  season?: number;
  episodeCount?: number;
  /** Series: that season is already watched. */
  seasonComplete?: boolean;
  /** Play the center-screen hero in the palace (only when the palace is on screen). */
  animate?: boolean;
}

export interface PalaceState {
  /** Normalized item table: the collection. */
  items: Record<string, PalaceItem>;
  /** Per-category slot order: index in this array === shelf slot index. */
  order: CategoryOrder;
  language: LanguagePreference;
  settings: PalaceSettings;
  /** Last few catalog searches, most recent first. */
  recentSearches: string[];

  // ---- transient (not persisted)
  focus: CameraFocus;
  /** FIFO of center-screen rewards. heroQueue[0] is the live Hero Object. */
  heroQueue: HeroEvent[];
  /** Item whose detail sheet is open. */
  selectedId: string | null;
  /**
   * Item currently lifted off its furniture by the 3D inspector. Outlives `selectedId`
   * while the object glides back to its slot, then the inspector clears it.
   */
  inspectId: string | null;
  /** Last removed item, kept briefly so removal can be undone instead of confirmed. */
  lastRemoved: { item: PalaceItem; index: number } | null;

  findExisting: (category: CategoryId, title: string, source?: ItemSource) => PalaceItem | undefined;
  addItem: (category: CategoryId, details: ItemDetails, opts?: AddOptions) => { id: string; existed: boolean };
  updateItem: (id: string, patch: Partial<ItemDetails>) => void;
  setNextEpisode: (id: string, next: PalaceItem['nextEpisode'] | undefined) => void;
  deleteItem: (id: string) => void;
  undoDelete: () => void;
  logEpisode: (seriesId: string, opts?: { animate?: boolean }) => HeroEvent | null;
  addSeason: (seriesId: string, episodeCount: number) => void;
  /** Hero Swap commit: the hero unmounts and the item joins its shelf InstancedMesh. */
  completeHero: (eventId: string) => void;
  setFocus: (focus: CameraFocus) => void;
  selectItem: (id: string | null, opts?: { inspect?: boolean }) => void;
  endInspect: (id: string) => void;
  rememberSearch: (query: string) => void;
  setLanguage: (language: LanguagePreference) => void;
  setSetting: <K extends keyof PalaceSettings>(key: K, value: PalaceSettings[K]) => void;
  resetPalace: () => void;
}

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
export const clampEpisodes = (n: number) => Math.max(1, Math.min(MAX_EPISODES, Math.round(n) || DEFAULT_EPISODES));
const normTitle = (s: string) => s.trim().toLocaleLowerCase().replace(/\s+/g, ' ');

const emptyOrder = (): CategoryOrder =>
  Object.fromEntries(CATEGORIES.map((c) => [c, [] as string[]])) as unknown as CategoryOrder;

/** Trim strings, drop empties, clamp numbers: the store never holds malformed metadata. */
function cleanDetails(patch: Partial<ItemDetails>): Partial<ItemDetails> {
  const out: Partial<ItemDetails> = {};
  if (patch.title !== undefined) out.title = patch.title.trim();
  if (patch.creator !== undefined) out.creator = patch.creator?.trim() || undefined;
  if (patch.note !== undefined) out.note = patch.note?.trim() || undefined;
  if (patch.coverUrl !== undefined) out.coverUrl = patch.coverUrl || undefined;
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
  /** Human season number (accounts for series added from a later season). */
  seasonNumber: number;
  watched: number;
  total: number;
  /** watched / total, 0..1 — the disc's pie fraction. */
  fraction: number;
  allComplete: boolean;
}

export const seasonNumber = (item: SeriesItem, index: number) => (item.seasonOffset ?? 0) + index + 1;

export function getSeriesProgress(item: SeriesItem): SeriesProgress {
  const idx = item.seasons.findIndex((s) => s.watched < s.episodeCount);
  const seasonIndex = idx === -1 ? item.seasons.length - 1 : idx;
  const season = item.seasons[seasonIndex];
  return {
    seasonIndex,
    seasonNumber: seasonNumber(item, seasonIndex),
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
      settings: { ambient: true, haptics: true, notifications: true },
      recentSearches: [],
      focus: 'window',
      heroQueue: [],
      selectedId: null,
      inspectId: null,
      lastRemoved: null,

      findExisting: (category, title, source) => {
        const items = Object.values(get().items);
        if (source && source.provider !== 'manual') {
          const hit = items.find((i) => i.source?.provider === source.provider && i.source.id === source.id);
          if (hit) return hit;
        }
        const t = normTitle(title);
        return items.find((i) => i.category === category && normTitle(i.title) === t);
      },

      addItem: (category, details, opts = {}) => {
        const existing = get().findExisting(category, details.title, opts.source);
        if (existing) return { id: existing.id, existed: true };
        const id = uid();
        const now = Date.now();
        const clean = cleanDetails(details);
        const animate = !!opts.animate;
        const base = {
          ...clean,
          id,
          title: clean.title || '—',
          source: opts.source,
          releaseDate: opts.releaseDate,
          tvmazeId: opts.tvmazeId,
          createdAt: now,
          updatedAt: now,
          settled: !animate,
        };
        let item: PalaceItem;
        if (category === 'series') {
          const episodeCount = clampEpisodes(opts.episodeCount ?? DEFAULT_EPISODES);
          const season = Math.max(1, Math.round(opts.season ?? 1));
          item = {
            ...base,
            category,
            seasonOffset: season - 1,
            seasons: [{ episodeCount, watched: opts.seasonComplete ? episodeCount : 0 }],
          };
        } else {
          item = { ...base, category };
        }

        set((s) => ({
          items: { ...s.items, [id]: item },
          // Slot is reserved immediately so the hero knows where to fly.
          order: { ...s.order, [category]: [...s.order[category], id] },
          heroQueue: animate ? [...s.heroQueue, { id: uid(), kind: 'item', itemId: id }] : s.heroQueue,
        }));
        return { id, existed: false };
      },

      updateItem: (id, patch) => {
        const item = get().items[id];
        if (!item) return;
        const clean = cleanDetails(patch);
        if (clean.title !== undefined && !clean.title) delete clean.title; // never blank a title
        set((s) => ({ items: { ...s.items, [id]: { ...item, ...clean, updatedAt: Date.now() } as PalaceItem } }));
      },

      setNextEpisode: (id, next) => {
        const item = get().items[id];
        if (!item) return;
        const same =
          item.nextEpisode?.date === next?.date && item.nextEpisode?.number === next?.number && item.nextEpisode?.season === next?.season;
        if (same) return;
        set((s) => ({ items: { ...s.items, [id]: { ...item, nextEpisode: next } } }));
      },

      deleteItem: (id) => {
        const item = get().items[id];
        if (!item) return;
        const index = get().order[item.category].indexOf(id);
        set((s) => {
          const items = { ...s.items };
          delete items[id];
          return {
            items,
            order: { ...s.order, [item.category]: s.order[item.category].filter((x) => x !== id) },
            heroQueue: s.heroQueue.filter((e) => e.itemId !== id || e === s.heroQueue[0]),
            selectedId: s.selectedId === id ? null : s.selectedId,
            inspectId: s.inspectId === id ? null : s.inspectId,
            lastRemoved: { item: { ...item, settled: true }, index },
          };
        });
      },

      undoDelete: () => {
        const removed = get().lastRemoved;
        if (!removed) return;
        const { item, index } = removed;
        set((s) => {
          const list = [...s.order[item.category]];
          list.splice(Math.min(index, list.length), 0, item.id);
          return { items: { ...s.items, [item.id]: item }, order: { ...s.order, [item.category]: list }, lastRemoved: null };
        });
      },

      logEpisode: (seriesId, opts = {}) => {
        const item = get().items[seriesId];
        if (!item || item.category !== 'series') return null;
        const progress = getSeriesProgress(item);
        if (progress.allComplete) return null;

        const seasons = item.seasons.map((s, i) => (i === progress.seasonIndex ? { ...s, watched: s.watched + 1 } : s));
        const hero: HeroEvent = {
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
          heroQueue: opts.animate ? [...s.heroQueue, hero] : s.heroQueue,
          // The hero takes the box off the furniture itself.
          selectedId: opts.animate && s.selectedId === seriesId ? null : s.selectedId,
        }));
        return hero;
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
      selectItem: (id, opts) =>
        set((s) => ({ selectedId: id, inspectId: id && opts?.inspect ? id : id ? null : s.inspectId })),
      endInspect: (id) => set((s) => (s.inspectId === id && s.selectedId !== id ? { inspectId: null } : s)),
      rememberSearch: (query) => {
        const q = query.trim();
        if (q.length < 2) return;
        set((s) => ({ recentSearches: [q, ...s.recentSearches.filter((x) => x.toLocaleLowerCase() !== q.toLocaleLowerCase())].slice(0, 8) }));
      },
      setLanguage: (language) => set({ language }),
      setSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
      resetPalace: () =>
        set({ items: {}, order: emptyOrder(), heroQueue: [], focus: 'window', selectedId: null, inspectId: null, lastRemoved: null }),
    }),
    {
      name: 'palais-mental/v1',
      version: 4,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        items: s.items,
        order: s.order,
        language: s.language,
        settings: s.settings,
        recentSearches: s.recentSearches,
      }),
      // v4 drops the journal; extra fields in older saves are ignored.
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Partial<PalaceState> & { events?: unknown };
        delete p.events;
        return p;
      },
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
          recentSearches: p.recentSearches ?? [],
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
