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
    palette: ['#1E3A8A', '#0F172A', '#7F1D1D', '#134E4A', '#312E81'],
    accent: '#60A5FA',
  },
  series: {
    size: [0.04, 0.19, 0.135],
    pitch: 0.052,
    minHeightScale: 1,
    maxHeightScale: 1,
    palette: ['#4C1D95', '#1F2937', '#9D174D', '#064E3B', '#78350F'],
    accent: '#C084FC',
  },
  music: {
    size: [0.012, 0.31, 0.31],
    pitch: 0.026,
    minHeightScale: 1,
    maxHeightScale: 1,
    palette: ['#111827', '#B45309', '#BE123C', '#0E7490', '#E5E7EB'],
    accent: '#FBBF24',
  },
  books: {
    size: [0.045, 0.24, 0.16],
    pitch: 0.054,
    minHeightScale: 0.78,
    maxHeightScale: 1.12,
    palette: ['#7C2D12', '#1E3A8A', '#14532D', '#44403C', '#F5F5F4', '#9F1239'],
    accent: '#F59E0B',
  },
  boardgames: {
    size: [0.075, 0.3, 0.3],
    pitch: 0.088,
    minHeightScale: 1,
    maxHeightScale: 1,
    palette: ['#0369A1', '#B91C1C', '#15803D', '#A16207', '#6D28D9'],
    accent: '#34D399',
  },
  videogames: {
    size: [0.014, 0.17, 0.135],
    pitch: 0.026,
    minHeightScale: 1,
    maxHeightScale: 1,
    palette: ['#1D4ED8', '#16A34A', '#DC2626', '#111827', '#F3F4F6'],
    accent: '#F472B6',
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
