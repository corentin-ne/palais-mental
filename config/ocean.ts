/**
 * The open sea that replaces the room: sun, water, islands, drops and the animals
 * that come by. Every tunable of the ocean lives here.
 */
import type { CategoryId } from '@/lib/types';

export const OCEAN = {
  /** Camera eye height above the water (m) and how far it looks down (rad). */
  eyeHeight: 1.55,
  pitch: -0.1,
  /** Vertical field of view: landscape, portrait. */
  fov: [52, 66] as [number, number],
  /** Head turn between collections: spring stiffness and damping (critically damped ≈ 2·√k). */
  turnStiffness: 16,
  turnDamping: 7.4,
  /** Sun direction (toward the sun), elevation above the horizon. */
  sun: { azimuth: 0.35, elevation: 0.3 },

  water: {
    /** Colour seen straight down into deep water, and the turquoise scattered back toward the sun. */
    deep: [0.003, 0.024, 0.07] as [number, number, number],
    scatter: [0.008, 0.085, 0.12] as [number, number, number],
    /** Swell: slope amplitude and speed. */
    swell: 1,
    speed: 0.55,
  },

  sky: {
    zenith: [0.03, 0.2, 0.62] as [number, number, number],
    horizon: [0.42, 0.64, 0.88] as [number, number, number],
    clouds: 0.85,
  },

  /** Ripple simulation around the viewer: grid size and half-extent (m). */
  ripples: { size: 320, extent: 8 },

  /** Where each collection's island sits on the horizon (azimuth, rad; 0 = straight ahead). */
  islands: {
    series: -0.3,
    movies: -0.95,
    videogames: -1.7,
    music: 0.32,
    boardgames: 1.0,
    books: 1.75,
  } as Record<CategoryId, number>,
  /** Island size grows with the collection: angular width and height at 0 and at `fullAt` objects. */
  islandGrowth: { width: [0.08, 0.24], height: [0.02, 0.085], fullAt: 80 },

  drop: {
    radius: 0.13,
    episodeRadius: 0.055,
    /** Distance in front of the camera where drops land (m), and the height they form at. */
    distance: 3.1,
    formHeight: 1.35,
    formDuration: 0.55,
    gravity: 7.2,
  },

  creatures: {
    /** Seconds between two visits: dolphins, a leaping fish shoal, gulls overhead. */
    dolphins: [14, 26] as [number, number],
    fish: [7, 14] as [number, number],
    gulls: 3,
  },
};
