/**
 * The six collections: object sizes and variants, palettes, finishes and how densely
 * their furniture packs them. Everything visual about an object starts here.
 */
import type { CategoryId } from '@/lib/types';
import type { FinishKind } from './finishes';

export interface CategorySpec {
  /** Box size [thickness(x), height(y), depth(z)] — spine faces +z on the shelf. */
  size: [number, number, number];
  /** Horizontal distance between slot centers. */
  pitch: number;
  /** Tallest variant, relative to `size` (sizes the shelf tiers). */
  maxHeightScale: number;
  /** Largest depth any variant reaches (sizes the furniture depth). Keep in step with `variants`. */
  maxDepthScale: number;
  /** Dusty pastels for the objects themselves. */
  palette: string[];
  /** Deeper signature hue: UI chips, furniture light lines, hero glow. */
  accent: string;
  /** Pale wash of the accent: furniture back panels and UI tiles. */
  tint: string;
  /** Finish of the object's body and of its trims (see config/finishes). */
  finish: FinishKind;
  detailFinish: FinishKind;
  /**
   * Shape variants [thickness, height, depth] relative to `size`, picked per object.
   * One entry = every object is the same size. (Books and series have their own rules
   * in lib/itemVisuals: books vary continuously, series thicken with each season.)
   */
  variants: [number, number, number][];
  /** More slots per shelf for small objects (CDs), fewer for big ones. */
  slotScale: number;
}

export const CATEGORY_SPECS: Record<CategoryId, CategorySpec> = {
  movies: {
    size: [0.017, 0.19, 0.135],
    pitch: 0.029,
    maxHeightScale: 1,
    maxDepthScale: 1,
    palette: ['#C8553D', '#2E4057', '#F2C57C', '#7B9E89', '#1F1F24', '#E8DCC8', '#8E6C8A'],
    accent: '#D9725F',
    tint: '#F8E2DB',
    finish: 'glossy',
    detailFinish: 'satin',
    variants: [
      [1, 1, 1], // DVD
      [0.78, 0.9, 0.93], // Blu-ray
      [1.12, 0.96, 0.98], // steelbook
    ],
    slotScale: 1,
  },
  series: {
    size: [0.042, 0.19, 0.135],
    pitch: 0.054,
    maxHeightScale: 1,
    maxDepthScale: 1,
    palette: ['#5B4E8C', '#2F6F73', '#D98C5F', '#B8394D', '#E9E3D5', '#23272F'],
    accent: '#8C74CF',
    tint: '#EAE3F6',
    finish: 'glossy',
    detailFinish: 'satin',
    variants: [[1, 1, 1]],
    slotScale: 1,
  },
  music: {
    // CD jewel case: 14.2 × 12.5 cm, 1 cm thick.
    size: [0.0104, 0.125, 0.142],
    pitch: 0.0128,
    maxHeightScale: 1,
    maxDepthScale: 1,
    palette: ['#F2B134', '#E4572E', '#17BEBB', '#2E282A', '#EDE6DB', '#76B041', '#FFC9B9'],
    accent: '#D9913A',
    tint: '#F9EAD5',
    finish: 'glossy',
    detailFinish: 'glass',
    variants: [
      [1, 1, 1], // jewel case
      [1, 1, 1],
      [1, 1, 1],
      [2.2, 1, 1], // double-disc fatbox
    ],
    slotScale: 2.2,
  },
  books: {
    size: [0.042, 0.24, 0.165],
    pitch: 0.05,
    maxHeightScale: 1.12,
    maxDepthScale: 1.05,
    palette: ['#1F3A5F', '#7A2E3A', '#2F5D50', '#C9A227', '#EDE3D1', '#B5523B', '#4A4453', '#8FA9B8'],
    accent: '#B8744B',
    tint: '#F3E4D6',
    finish: 'clay',
    detailFinish: 'satin',
    variants: [[1, 1, 1]],
    slotScale: 1,
  },
  boardgames: {
    size: [0.075, 0.3, 0.3],
    pitch: 0.085,
    maxHeightScale: 1,
    maxDepthScale: 1,
    palette: ['#2A9D8F', '#E76F51', '#264653', '#E9C46A', '#F4F1DE', '#9C6644'],
    accent: '#3FA38E',
    tint: '#DDF1EC',
    finish: 'satin',
    detailFinish: 'satin',
    variants: [[1, 1, 1]],
    slotScale: 1,
  },
  videogames: {
    size: [0.014, 0.17, 0.135],
    pitch: 0.025,
    maxHeightScale: 1,
    maxDepthScale: 1,
    palette: ['#E63946', '#1D3557', '#2B2D42', '#F1FAEE', '#43AA8B', '#6A4C93'],
    accent: '#D9658F',
    tint: '#F8E0E8',
    finish: 'glossy',
    detailFinish: 'satin',
    variants: [
      [1, 1, 1], // standard case
      [0.7, 1, 1], // slim case
      [0.78, 0.62, 0.78], // handheld case
    ],
    slotScale: 1,
  },
};

