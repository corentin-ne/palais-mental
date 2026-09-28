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
  /** Dusty pastels for the objects themselves. */
  palette: string[];
  /** Deeper signature hue: UI chips, niche lighting, hero glow. */
  accent: string;
  /** Pale wash of the accent: niche lining and UI tiles. */
  tint: string;
}

export const CATEGORY_SPECS: Record<CategoryId, CategorySpec> = {
  movies: {
    size: [0.017, 0.19, 0.135],
    pitch: 0.029,
    peek: 0,
    minHeightScale: 1,
    maxHeightScale: 1,
    palette: ['#E8A598', '#F2C9A0', '#9CC3D5', '#B7A6D6', '#E6CF8B', '#8FB9A8'],
    accent: '#D9725F',
    tint: '#F8E2DB',
  },
  series: {
    size: [0.042, 0.19, 0.135],
    pitch: 0.054,
    peek: 0,
    minHeightScale: 1,
    maxHeightScale: 1,
    palette: ['#B7A6D6', '#95C8BC', '#EBB1C0', '#9DB7E6', '#EDCC96'],
    accent: '#8C74CF',
    tint: '#EAE3F6',
  },
  music: {
    size: [0.012, 0.31, 0.31],
    pitch: 0.027,
    peek: 0.05,
    minHeightScale: 1,
    maxHeightScale: 1,
    palette: ['#F0BE8A', '#E9DE8E', '#A9D5A5', '#8FCFD8', '#E4B3DC', '#F2A999'],
    accent: '#D9913A',
    tint: '#F9EAD5',
  },
  books: {
    size: [0.042, 0.24, 0.165],
    pitch: 0.05,
    peek: 0,
    minHeightScale: 0.8,
    maxHeightScale: 1.1,
    palette: ['#C98E6A', '#7FA3BF', '#9DBF86', '#E4CFB0', '#D195A8', '#A895CF', '#6F8F7E'],
    accent: '#B8744B',
    tint: '#F3E4D6',
  },
  boardgames: {
    size: [0.075, 0.3, 0.3],
    pitch: 0.085,
    peek: 0,
    minHeightScale: 1,
    maxHeightScale: 1,
    palette: ['#7EC6B8', '#EE9E9E', '#A7D48F', '#F0CB6E', '#A897E6'],
    accent: '#3FA38E',
    tint: '#DDF1EC',
  },
  videogames: {
    size: [0.014, 0.17, 0.135],
    pitch: 0.025,
    peek: 0,
    minHeightScale: 1,
    maxHeightScale: 1,
    palette: ['#8DB8EE', '#97D6A2', '#EE97AE', '#F5D77A', '#C6B6F5'],
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

export function getItemColor(item: Pick<PalaceItem, 'id' | 'category'>): string {
  const { palette } = CATEGORY_SPECS[item.category];
  return palette[hashString(item.id) % palette.length];
}

export function getItemHeightScale(item: Pick<PalaceItem, 'id' | 'category'>): number {
  const spec = CATEGORY_SPECS[item.category];
  if (spec.minHeightScale === spec.maxHeightScale) return spec.minHeightScale;
  const t = (hashString(item.id + ':h') % 1000) / 1000;
  return spec.minHeightScale + (spec.maxHeightScale - spec.minHeightScale) * t;
}
