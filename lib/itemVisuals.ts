import { CategoryId, PalaceItem } from './types';
import { CATEGORY_SPECS } from '@/config/collections';

export { CATEGORY_SPECS };
export type { CategorySpec } from '@/config/collections';

/** FNV-1a — stable per-item visual variation without storing it. */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The object's colour: taken from its artwork when known, otherwise from the collection's palette. */
export function getItemColor(item: Pick<PalaceItem, 'id' | 'category'> & { coverColor?: string }): string {
  if (item.coverColor) return item.coverColor;
  const { palette } = CATEGORY_SPECS[item.category];
  return palette[hashString(item.id) % palette.length];
}

const unit = (id: string, salt: string) => (hashString(id + salt) % 10_000) / 10_000;

/**
 * Per-object proportions [thickness, height, depth] relative to the category's base
 * box, stable per item: a variant from config/collections, except books (paperbacks and
 * hardcovers vary continuously) and series (the box thickens with every season).
 */
export function getItemScale(item: PalaceItem): [number, number, number] {
  const r = (salt: string) => unit(item.id, salt);
  switch (item.category) {
    case 'series':
      return [0.7 + 0.28 * Math.min(item.seasons.length, 5), 1, 1];
    case 'books': {
      const paperback = r(':pb') < 0.45;
      return paperback
        ? [0.55 + r(':t') * 0.6, 0.78 + r(':h') * 0.1, 0.82 + r(':d') * 0.08]
        : [0.9 + r(':t') * 0.9, 0.95 + r(':h') * 0.17, 0.95 + r(':d') * 0.1];
    }
    default: {
      const { variants } = CATEGORY_SPECS[item.category];
      return variants[hashString(item.id) % variants.length];
    }
  }
}

/** Height factor only (kept for callers that just need where the object stands). */
export function getItemHeightScale(item: PalaceItem): number {
  return getItemScale(item)[1];
}
