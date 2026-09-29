import { CategoryId, PalaceItem } from './types';

export interface CategorySpec {
  /** Box size [thickness(x), height(y), depth(z)] — spine faces +z on the shelf. */
  size: [number, number, number];
  /** Horizontal distance between slot centers. */
  pitch: number;
  /** Extra height above the body (a vinyl record peeking out of its sleeve). */
  peek: number;
  /** Per-item height variance (books are not all the same size). */
  minHeightScale: number;
  maxHeightScale: number;
  /** Largest depth any variant reaches (sizes the furniture depth). */
  maxDepthScale: number;
  /** Dusty pastels for the objects themselves. */
  palette: string[];
  /** Deeper signature hue: UI chips, furniture light lines, hero glow. */
  accent: string;
  /** Pale wash of the accent: furniture back panels and UI tiles. */
  tint: string;
}

export const CATEGORY_SPECS: Record<CategoryId, CategorySpec> = {
  movies: {
    size: [0.017, 0.19, 0.135],
    pitch: 0.029,
    peek: 0,
    minHeightScale: 1,
    maxHeightScale: 1,
    maxDepthScale: 1,
    palette: ['#C8553D', '#2E4057', '#F2C57C', '#7B9E89', '#1F1F24', '#E8DCC8', '#8E6C8A'],
    accent: '#D9725F',
    tint: '#F8E2DB',
  },
  series: {
    size: [0.042, 0.19, 0.135],
    pitch: 0.054,
    peek: 0,
    minHeightScale: 1,
    maxHeightScale: 1,
    maxDepthScale: 1,
    palette: ['#5B4E8C', '#2F6F73', '#D98C5F', '#B8394D', '#E9E3D5', '#23272F'],
    accent: '#8C74CF',
    tint: '#EAE3F6',
  },
  music: {
    size: [0.012, 0.31, 0.31],
    pitch: 0.027,
    peek: 0.05,
    minHeightScale: 1,
    maxHeightScale: 1,
    maxDepthScale: 1,
    palette: ['#F2B134', '#E4572E', '#17BEBB', '#2E282A', '#EDE6DB', '#76B041', '#FFC9B9'],
    accent: '#D9913A',
    tint: '#F9EAD5',
  },
  books: {
    size: [0.042, 0.24, 0.165],
    pitch: 0.05,
    peek: 0,
    minHeightScale: 0.8,
    maxHeightScale: 1.12,
    maxDepthScale: 1.05,
    palette: ['#1F3A5F', '#7A2E3A', '#2F5D50', '#C9A227', '#EDE3D1', '#B5523B', '#4A4453', '#8FA9B8'],
    accent: '#B8744B',
    tint: '#F3E4D6',
  },
  boardgames: {
    size: [0.075, 0.3, 0.3],
    pitch: 0.085,
    peek: 0,
    minHeightScale: 1,
    maxHeightScale: 1.05,
    maxDepthScale: 1.25,
    palette: ['#2A9D8F', '#E76F51', '#264653', '#E9C46A', '#F4F1DE', '#9C6644'],
    accent: '#3FA38E',
    tint: '#DDF1EC',
  },
  videogames: {
    size: [0.014, 0.17, 0.135],
    pitch: 0.025,
    peek: 0,
    minHeightScale: 1,
    maxHeightScale: 1.3,
    maxDepthScale: 1.1,
    palette: ['#E63946', '#1D3557', '#2B2D42', '#F1FAEE', '#43AA8B', '#6A4C93'],
    accent: '#D9658F',
    tint: '#F8E0E8',
  },
};

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
 * box, stable per item. Real shelves are never uniform: paperbacks next to fat
 * hardcovers, double LPs, Blu-rays next to DVDs, big-box games, small card games.
 * A series box grows thicker with every season it holds.
 */
export function getItemScale(item: PalaceItem): [number, number, number] {
  const r = (salt: string) => unit(item.id, salt);
  switch (item.category) {
    case 'movies': {
      const v = hashString(item.id) % 3; // DVD · Blu-ray · steelbook
      return v === 0 ? [1, 1, 1] : v === 1 ? [0.78, 0.9, 0.93] : [1.12, 0.96, 0.98];
    }
    case 'series':
      return [0.7 + 0.28 * Math.min(item.seasons.length, 5), 1, 1];
    case 'music':
      return [r(':lp') < 0.28 ? 1.9 : 1, 1, 1]; // gatefold double LPs
    case 'books': {
      const paperback = r(':pb') < 0.45;
      return paperback
        ? [0.55 + r(':t') * 0.6, 0.78 + r(':h') * 0.1, 0.82 + r(':d') * 0.08]
        : [0.9 + r(':t') * 0.9, 0.95 + r(':h') * 0.17, 0.95 + r(':d') * 0.1];
    }
    case 'boardgames': {
      const v = hashString(item.id) % 4; // big square · small square · long · tall
      return v === 0 ? [1, 1, 1] : v === 1 ? [0.75, 0.66, 0.66] : v === 2 ? [0.9, 0.8, 1.25] : [1.3, 1.05, 1.05];
    }
    case 'videogames': {
      const v = hashString(item.id) % 4; // standard case · slim case · handheld case · big box
      return v === 0 ? [1, 1, 1] : v === 1 ? [0.7, 1, 1] : v === 2 ? [0.78, 0.62, 0.78] : [2.4, 1.3, 1.1];
    }
  }
}

/** Height factor only (kept for callers that just need where the object stands). */
export function getItemHeightScale(item: PalaceItem): number {
  return getItemScale(item)[1];
}
