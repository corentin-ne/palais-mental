/**
 * A cache that outlives the app: answers that change slowly (Wikidata queries, ratings, other
 * books by an author) are kept on the device. A fresh copy is served at once; an expired one is
 * served too, while a new one loads for next time, and stands in when the source is down.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'palais-mental/http/';
const INDEX = 'palais-mental/http-index';
/** Entries kept on the device; the oldest go first. */
const MAX = 200;
/** Bigger answers stay in memory only: Android's storage is small and shared with the library. */
const MAX_BYTES = 48_000;

interface Entry<T> {
  at: number;
  value: T;
}

const memory = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
let index: Record<string, number> | undefined;
let indexTimer: ReturnType<typeof setTimeout> | undefined;

/** Short, stable key for long URLs and queries (cyrb53). */
export function hashKey(s: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

async function loadIndex() {
  if (index) return index;
  try {
    index = JSON.parse((await AsyncStorage.getItem(INDEX)) ?? '{}') ?? {};
  } catch {
    index = {};
  }
  return index!;
}

/** Index writes are batched; the oldest entries are dropped past MAX. */
function touch(key: string, at: number) {
  if (!index) return;
  index[key] = at;
  clearTimeout(indexTimer);
  indexTimer = setTimeout(() => {
    const keys = Object.keys(index!);
    if (keys.length > MAX) {
      const old = keys.sort((a, b) => index![a] - index![b]).slice(0, keys.length - MAX);
      for (const k of old) delete index![k];
      AsyncStorage.multiRemove(old.map((k) => PREFIX + k)).catch(() => undefined);
    }
    AsyncStorage.setItem(INDEX, JSON.stringify(index)).catch(() => undefined);
  }, 1500);
}

async function read<T>(key: string): Promise<Entry<T> | undefined> {
  const mem = memory.get(key) as Entry<T> | undefined;
  if (mem) return mem;
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return undefined;
    const entry = JSON.parse(raw) as Entry<T>;
    memory.set(key, entry);
    return entry;
  } catch {
    return undefined;
  }
}

function load<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const p = fetcher()
    .then(async (value) => {
      const entry = { at: Date.now(), value };
      memory.set(key, entry);
      if (memory.size > MAX * 2) memory.delete(memory.keys().next().value!);
      const raw = JSON.stringify(entry);
      if (raw.length <= MAX_BYTES) {
        await loadIndex();
        touch(key, entry.at);
        AsyncStorage.setItem(PREFIX + key, raw).catch(() => undefined);
      }
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/**
 * `fetcher`'s answer, kept `ttl` ms on the device. Past that it is still returned at once while
 * a fresh one loads in the background. Empty answers (`isEmpty`) are not kept long: a source
 * that was briefly down gets asked again next time.
 */
export async function persisted<T>(key: string, ttl: number, fetcher: () => Promise<T>, isEmpty?: (v: T) => boolean): Promise<T> {
  const k = hashKey(key);
  const hit = await read<T>(k);
  if (hit) {
    const life = isEmpty?.(hit.value) ? Math.min(ttl, 10 * 60_000) : ttl;
    if (Date.now() - hit.at < life) return hit.value;
    load(k, fetcher).catch(() => undefined);
    return hit.value;
  }
  return load(k, fetcher);
}
