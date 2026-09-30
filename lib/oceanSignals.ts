/**
 * Per-frame messages between the ocean's pieces (drops, animals, taps → the water).
 * Plain mutable queues, never React state: they change every frame.
 */
export interface RippleRequest {
  x: number;
  z: number;
  radius: number;
  strength: number;
}
export interface ImpactRequest {
  x: number;
  z: number;
  color: [number, number, number];
  /** 0 = tinted bloom only, 1 = white foam ring. */
  foam: number;
  strength: number;
}

export const oceanSignals = {
  ripples: [] as RippleRequest[],
  impacts: [] as ImpactRequest[],
  /** Taps on the screen in normalized device coordinates, turned into ripples by the water. */
  taps: [] as { x: number; y: number }[],
  /** Current camera heading, so animals come by where you are looking. */
  yaw: 0,
};

export function ripple(x: number, z: number, radius: number, strength: number) {
  if (oceanSignals.ripples.length < 64) oceanSignals.ripples.push({ x, z, radius, strength });
}

export function impact(x: number, z: number, color: [number, number, number], foam = 0, strength = 1) {
  oceanSignals.impacts.push({ x, z, color, foam, strength });
}

export function tapWater(ndcX: number, ndcY: number) {
  oceanSignals.taps.push({ x: ndcX, y: ndcY });
}
