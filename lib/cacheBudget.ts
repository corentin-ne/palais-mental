/** What the on-device cache holds: key → [last written, size]. Entries written before 1.8 hold the time alone. */
export type CacheIndex = Record<string, number | [at: number, bytes: number]>;

/** Size assumed for an entry written before sizes were kept. */
const UNKNOWN = 12_000;
export const writtenAt = (v: CacheIndex[string]) => (typeof v === 'number' ? v : v[0]);
const bytesOf = (v: CacheIndex[string]) => (typeof v === 'number' ? UNKNOWN : v[1]);

/** The keys to drop, oldest first, so that at most `max` entries and `budget` bytes remain. */
export function overflow(index: CacheIndex, max: number, budget: number): string[] {
  const keys = Object.keys(index).sort((a, b) => writtenAt(index[a]) - writtenAt(index[b]));
  let bytes = keys.reduce((sum, k) => sum + bytesOf(index[k]), 0);
  const out: string[] = [];
  for (const k of keys) {
    if (keys.length - out.length <= max && bytes <= budget) break;
    bytes -= bytesOf(index[k]);
    out.push(k);
  }
  return out;
}
