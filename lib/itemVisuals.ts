import { CategoryId, PalaceItem } from './types';

export interface CategorySpec {
  /** Box size [thickness(x), height(y), depth(z)] — spine faces +z on the shelf. */
  size: [number, number, number];
  /** Horizontal distance between slot centers. */
  pitch: number;
  /** Per-item height variance (books are not all the same size). */
  minHeightScale: number;
  maxHeightScale: number;
  palette: string[];
  accent: string;
}

export const CATEGORY_SPECS: Record<CategoryId, CategorySpec> = {
  movies: {
    size: [0.016, 0.19, 0.135],
    pitch: 0.03,
    minHeightScale: 1,
    maxHeightScale: 1,
    palette: ['#F4A6A0', '#F7C59F', '#A8D5E2', '#C3B1E1', '#F2D388'],
    accent: '#F28C82',
  },
  series: {
    size: [0.04, 0.19, 0.135],
    pitch: 0.052,
    minHeightScale: 1,
    maxHeightScale: 1,
    palette: ['#C3B1E1', '#9FD8CB', '#F6B8C8', '#A8C5F0', '#F7D59C'],
    accent: '#A78BDA',
  },
  music: {
    size: [0.012, 0.31, 0.31],
    pitch: 0.026,
    minHeightScale: 1,
    maxHeightScale: 1,
    palette: ['#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', '#FFC6FF'],
    accent: '#F5B44A',
  },
  books: {
    size: [0.045, 0.24, 0.16],
    pitch: 0.054,
    minHeightScale: 0.78,
    maxHeightScale: 1.12,
    palette: ['#E8A87C', '#95B8D1', '#B5D99C', '#F3E1C7', '#E3A6B8', '#C9B6E4'],
    accent: '#E39A5C',
  },
  boardgames: {
    size: [0.075, 0.3, 0.3],
    pitch: 0.088,
    minHeightScale: 1,
    maxHeightScale: 1,
    palette: ['#8FD3C8', '#F7A8A8', '#B7E4A1', '#F9D77E', '#B9A7F0'],
    accent: '#5CC7A8',
  },
  videogames: {
    size: [0.014, 0.17, 0.135],
    pitch: 0.026,
    minHeightScale: 1,
    maxHeightScale: 1,
    palette: ['#9CC7F5', '#A7E3B0', '#F5A3B8', '#FFE08A', '#D6C8FF'],
    accent: '#EE8FB6',
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
