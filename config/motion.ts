/**
 * Timing and feel of everything that moves: the camera, the arrival of a new object,
 * and the springs behind the furniture.
 */

export const CAMERA = {
  /** Standing eye height, and the band the camera may move within (m). */
  eyeHeight: 1.5,
  minEye: 1.2,
  maxEye: 1.75,
  /** Lens at the window and in front of a collection (degrees). */
  windowFov: 55,
  focusFov: 50,
  /** Narrowest view in front of a collection (m): wider shows its neighbours and the room. */
  focusMinWidth: 1.2,
  /** Closest the camera comes to the wall (m). */
  wallMargin: 0.9,
  /** Flight duration = base + perMeter × distance + perRadian × head turn, clamped (s). */
  flight: { base: 0.62, perMeter: 0.07, perRadian: 0.17, min: 0.7, max: 1.4 },
} as const;

/** Durations of each phase of a new object's arrival (s). */
export const ARRIVAL = {
  /** Distance in front of the camera where the object is born (m). */
  distance: 1.25,
  /** The arrival starts once the camera flight is this far along (0–1). */
  startAtCameraProgress: 0.72,
  sparkles: 140,
  sunlight: '#FFE2B0',
  item: { gather: 0.5, burst: 0.52, hold: 0.7, fly: 0.62 },
  episode: { gather: 0.38, burst: 0.42, open: 0.28, slice: 0.45, hold: 0.16, close: 0.22, fly: 0.62 },
  season: { gather: 0.38, burst: 0.42, open: 0.28, slice: 0.45, insert: 0.38, close: 0.18, hold: 0.35, fly: 0.62 },
  /** Opening angle of a series box lid (radians, ~112°). */
  lidAngle: 1.95,
  /** Speed-up while other arrivals are waiting in line. */
  backlogSpeed: 1.7,
} as const;
