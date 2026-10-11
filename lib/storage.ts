/**
 * Persisted stores write lazily: a burst of changes (ticking episodes, stepping pages) becomes
 * one write once things settle, serialised then rather than on every tap. Pending writes are
 * flushed as soon as the app leaves the foreground. A write that fails is kept for the next
 * attempt and reported (`onStorageError`), never dropped in silence.
 */
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

import { WrittenLists, episodesKey, joinLibrary, splitLibrary } from './libraryParts';

const DELAY = 400;
/** A steady stream of changes still lands at least this often. */
const MAX_WAIT = 2000;
/** A storage that stays full is reported again after this long, not on every write. */
const REPORT_EVERY = 60_000;

const pending = new Map<string, unknown>();
/** Stores kept in parts (see libraryParts), each with the episode lists already on the device. */
const parts = new Map<string, WrittenLists>();
let timer: ReturnType<typeof setTimeout> | undefined;
let firstPending = 0;
let listener: (() => void) | undefined;
let reportedAt = 0;

/** Called when a write fails (storage full or unavailable). Returns how to stop listening. */
export function onStorageError(fn: () => void) {
  listener = fn;
  return () => {
    if (listener === fn) listener = undefined;
  };
}

export async function flushStorage() {
  clearTimeout(timer);
  timer = undefined;
  firstPending = 0;
  if (!pending.size) return;
  const batch = [...pending];
  pending.clear();
  const pairs: [string, string][] = [];
  const removed: string[] = [];
  const commit: (() => void)[] = [];
  for (const [name, value] of batch) {
    const written = parts.get(name);
    if (!written) {
      pairs.push([name, JSON.stringify(value)]);
      continue;
    }
    const split = splitLibrary(value as object, written);
    pairs.push([name, JSON.stringify(split.main)]);
    for (const [id, list] of split.lists) pairs.push([episodesKey(name, id), JSON.stringify(list)]);
    removed.push(...split.removed.map((id) => episodesKey(name, id)));
    commit.push(() => {
      for (const [id, list] of split.lists) written.set(id, list);
      for (const id of split.removed) written.delete(id);
    });
  }
  try {
    await AsyncStorage.multiSet(pairs);
    commit.forEach((done) => done());
    if (removed.length) await AsyncStorage.multiRemove(removed).catch(() => undefined);
  } catch {
    // Kept for the next write (unless something newer is already waiting).
    for (const [name, value] of batch) if (!pending.has(name)) pending.set(name, value);
    if (Date.now() - reportedAt > REPORT_EVERY) {
      reportedAt = Date.now();
      listener?.();
    }
  }
}

function schedule() {
  const now = Date.now();
  firstPending ||= now;
  clearTimeout(timer);
  timer = setTimeout(flushStorage, Math.max(0, Math.min(DELAY, firstPending + MAX_WAIT - now)));
}

AppState.addEventListener('change', (s) => {
  if (s !== 'active') flushStorage();
});

/** `episodesApart`: the store is a library, its episode lists are kept under one key per show. */
export function lazyStorage<S>(opts: { episodesApart?: boolean } = {}): PersistStorage<S> {
  return {
    getItem: async (name) => {
      if (opts.episodesApart && !parts.has(name)) parts.set(name, new Map());
      if (pending.has(name)) return pending.get(name) as StorageValue<S>;
      const raw = await AsyncStorage.getItem(name);
      if (!raw) return null;
      const value = JSON.parse(raw) as StorageValue<S>;
      const written = parts.get(name);
      if (!written) return value;
      const ids = Object.keys((value as { state?: { shows?: object } }).state?.shows ?? {});
      const rows = ids.length ? await AsyncStorage.multiGet(ids.map((id) => episodesKey(name, id))) : [];
      const lists: Record<string, []> = {};
      rows.forEach(([, list], i) => {
        try {
          if (list) lists[ids[i]] = JSON.parse(list);
        } catch {
          // Unreadable: fetched again on the next refresh.
        }
      });
      written.clear();
      return joinLibrary(value as object, lists, written) as StorageValue<S>;
    },
    setItem: (name, value) => {
      if (opts.episodesApart && !parts.has(name)) parts.set(name, new Map());
      pending.set(name, value);
      schedule();
    },
    removeItem: async (name) => {
      pending.delete(name);
      const written = parts.get(name);
      const lists = written ? [...written.keys()].map((id) => episodesKey(name, id)) : [];
      written?.clear();
      await AsyncStorage.multiRemove([name, ...lists]);
    },
  };
}
