/**
 * How the library is laid out on the device. Episode lists are most of its weight and can be
 * fetched again, so each show's list lives under its own key: ticking an episode rewrites the small
 * main value only, and no single value grows with the size of the library (Android reads a value
 * of a couple of megabytes at most).
 */
import type { Episode } from './types';

interface StoredShow {
  episodes?: Episode[];
  syncedAt?: number;
}
interface Stored {
  state?: { shows?: Record<string, StoredShow> };
}
/** Show id → the episode list last written under its key (compared by identity). */
export type WrittenLists = Map<string, Episode[]>;

export const episodesKey = (name: string, showId: string) => `${name}/episodes/${showId}`;

/** What to write: the main value without episode lists, the lists that changed since they were last written, and the shows that left. */
export function splitLibrary<T extends Stored>(value: T, written: WrittenLists) {
  const shows = value.state?.shows ?? {};
  const bare: Record<string, StoredShow> = {};
  const lists: [string, Episode[]][] = [];
  for (const [id, show] of Object.entries(shows)) {
    bare[id] = { ...show, episodes: [] };
    const episodes = show.episodes ?? [];
    if (written.get(id) !== episodes) lists.push([id, episodes]);
  }
  const removed = [...written.keys()].filter((id) => !(id in shows));
  return { main: { ...value, state: { ...value.state, shows: bare } } as T, lists, removed };
}

/**
 * The library as the app holds it: each show with its episode list. A library saved before 1.8
 * still carries its lists inside (they move out on the next write); a list that went missing is
 * fetched again on the next refresh.
 */
export function joinLibrary<T extends Stored>(value: T, lists: Record<string, Episode[] | undefined>, written: WrittenLists): T {
  const shows = value?.state?.shows;
  if (!shows) return value;
  for (const [id, show] of Object.entries(shows)) {
    const list = lists[id];
    if (list) {
      show.episodes = list;
      written.set(id, list);
    } else if (!show.episodes?.length) {
      show.episodes = [];
      show.syncedAt = 0;
    }
  }
  return value;
}
