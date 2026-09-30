import { Color, Vector3, Vector4 } from 'three';

import { OCEAN } from '@/config/ocean';
import { ISLAND_COUNT } from '@/shaders/ocean';
import { CATEGORIES, CategoryId } from '@/lib/types';

const { azimuth, elevation } = OCEAN.sun;

/** Uniforms shared by every ocean material: one object, so a single write reaches all of them. */
export const shared = {
  uSun: { value: new Vector3(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), -Math.cos(azimuth) * Math.cos(elevation)) },
  uTime: { value: 0 },
  uZenith: { value: new Vector3(...OCEAN.sky.zenith) },
  uHorizon: { value: new Vector3(...OCEAN.sky.horizon) },
  uClouds: { value: OCEAN.sky.clouds },
  uIsland: { value: Array.from({ length: ISLAND_COUNT }, () => new Vector4()) },
};

/** Island size follows the collection: sqrt growth, full size at `fullAt` objects. */
export function updateIslands(counts: Record<CategoryId, number>) {
  const { width, height, fullAt } = OCEAN.islandGrowth;
  CATEGORIES.forEach((c, i) => {
    const k = Math.sqrt(Math.min(counts[c], fullAt) / fullAt);
    shared.uIsland.value[i].set(OCEAN.islands[c], width[0] + (width[1] - width[0]) * k, height[0] + (height[1] - height[0]) * k, 0.13 + i * 0.29);
  });
}

export function linearRgb(hex: string): [number, number, number] {
  const c = new Color(hex); // three converts sRGB hex to linear working space
  return [c.r, c.g, c.b];
}
