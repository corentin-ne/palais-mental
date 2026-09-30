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
  /** Current view heading (0 = looking toward -z), so animals come by where you are looking. */
  yaw: 0,
  /** Pixels dragged since the last frame; the camera consumes them. */
  drag: { dx: 0, dy: 0, active: false },
};

export function dragWater(dx: number, dy: number) {
  oceanSignals.drag.dx += dx;
  oceanSignals.drag.dy += dy;
}

export function setDragging(active: boolean) {
  oceanSignals.drag.active = active;
}

export function ripple(x: number, z: number, radius: number, strength: number) {
  if (oceanSignals.ripples.length < 64) oceanSignals.ripples.push({ x, z, radius, strength });
}

export function impact(x: number, z: number, color: [number, number, number], foam = 0, strength = 1) {
  oceanSignals.impacts.push({ x, z, color, foam, strength });
}

export function tapWater(ndcX: number, ndcY: number) {
  oceanSignals.taps.push({ x: ndcX, y: ndcY });
}
