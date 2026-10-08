/**
 * Persisted stores write lazily: a burst of changes (ticking episodes, stepping pages) becomes
 * one write once things settle, serialised then rather than on every tap. Pending writes are
 * flushed as soon as the app leaves the foreground.
 */
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

const DELAY = 400;
/** A steady stream of changes still lands at least this often. */
const MAX_WAIT = 2000;

const pending = new Map<string, unknown>();
let timer: ReturnType<typeof setTimeout> | undefined;
let firstPending = 0;

export async function flushStorage() {
  clearTimeout(timer);
  timer = undefined;
  firstPending = 0;
  if (!pending.size) return;
  const pairs: [string, string][] = [];
  for (const [name, value] of pending) pairs.push([name, JSON.stringify(value)]);
  pending.clear();
  await AsyncStorage.multiSet(pairs).catch(() => undefined);
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

export function lazyStorage<S>(): PersistStorage<S> {
  return {
    getItem: async (name) => {
      if (pending.has(name)) return pending.get(name) as StorageValue<S>;
      const raw = await AsyncStorage.getItem(name);
      return raw ? (JSON.parse(raw) as StorageValue<S>) : null;
    },
    setItem: (name, value) => {
      pending.set(name, value);
      schedule();
    },
    removeItem: async (name) => {
      pending.delete(name);
      await AsyncStorage.removeItem(name);
    },
  };
}
