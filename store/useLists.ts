import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { lazyStorage } from '@/lib/storage';
import type { MediaKind } from '@/lib/types';

/** One title on a list: enough to draw it even when it isn't in the library. */
export interface ListItem {
  kind: MediaKind;
  /** The route id (TVmaze id for a show). */
  id: string;
  title: string;
  poster?: string;
  year?: number;
  addedAt: number;
}

export interface UserList {
  id: string;
  name: string;
  emoji: string;
  createdAt: number;
  items: ListItem[];
}

interface ListsState {
  lists: Record<string, UserList>;
  create: (name: string, emoji: string) => string;
  rename: (id: string, name: string, emoji: string) => void;
  remove: (id: string) => UserList | undefined;
  restore: (list: UserList) => void;
  /** On the list → off it, off → on (at the top). Returns whether it is on it now. */
  toggle: (id: string, item: Omit<ListItem, 'addedAt'>) => boolean;
  /** A backup's lists merged in: lists by id, items by title, nothing removed. */
  merge: (lists: Record<string, UserList>) => void;
}

export const itemKey = (i: Pick<ListItem, 'kind' | 'id'>) => `${i.kind}/${i.id}`;

/** Your own lists ("To watch with Léa", "Halloween films"): any title, any kind, in the order you add them. */
export const useLists = create<ListsState>()(
  persist(
    (set, get) => ({
      lists: {},
      create: (name, emoji) => {
        const id = `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        set((s) => ({ lists: { ...s.lists, [id]: { id, name: name.trim(), emoji, createdAt: Date.now(), items: [] } } }));
        return id;
      },
      rename: (id, name, emoji) => set((s) => (s.lists[id] ? { lists: { ...s.lists, [id]: { ...s.lists[id], name: name.trim() || s.lists[id].name, emoji } } } : s)),
      remove: (id) => {
        const list = get().lists[id];
        if (list)
          set((s) => {
            const next = { ...s.lists };
            delete next[id];
            return { lists: next };
          });
        return list;
      },
      restore: (list) => set((s) => ({ lists: { ...s.lists, [list.id]: list } })),
      toggle: (id, item) => {
        const list = get().lists[id];
        if (!list) return false;
        const on = list.items.some((i) => itemKey(i) === itemKey(item));
        const items = on ? list.items.filter((i) => itemKey(i) !== itemKey(item)) : [{ ...item, addedAt: Date.now() }, ...list.items];
        set((s) => ({ lists: { ...s.lists, [id]: { ...list, items } } }));
        return !on;
      },
      merge: (incoming) =>
        set((s) => {
          const lists = { ...s.lists };
          for (const [id, theirs] of Object.entries(incoming ?? {})) {
            const mine = lists[id];
            if (!mine) lists[id] = theirs;
            else {
              const have = new Set(mine.items.map(itemKey));
              lists[id] = { ...mine, items: [...mine.items, ...theirs.items.filter((i) => !have.has(itemKey(i)))] };
            }
          }
          return { lists };
        }),
    }),
    { name: 'palais-mental/lists', version: 1, storage: lazyStorage() },
  ),
);
