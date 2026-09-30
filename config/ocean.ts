/**
 * The clear water that replaces the room: camera, sun, sky, islands, drops and the animals
 * that come by. Every tunable of the water lives here.
 */
import type { CategoryId } from '@/lib/types';

export const OCEAN = {
  /**
   * Free look: the camera orbits a point on the water. Drag to turn all the way round and to
   * look further down or up; the view keeps a little momentum when you let go.
   */
  camera: {
    distance: [4.4, 5.0] as [number, number], // landscape, portrait
    fov: [55, 66] as [number, number],
    pitch: 0.26,
    pitchRange: [0.12, 0.8] as [number, number],
    /** Radians per pixel dragged, and how fast the momentum fades (per second). */
    sensitivity: 0.005,
    friction: 4,
  },
  /** Sun direction (toward the sun), elevation above the horizon. */
  sun: { azimuth: 0.245, elevation: 0.387 },

  sky: {
    zenith: [0.035, 0.24, 0.78] as [number, number, number],
    horizon: [0.62, 0.86, 1.0] as [number, number, number],
    clouds: 1,
  },

  /** Ripple simulation around the centre: grid size and half-extent (m). */
  ripples: { size: 320, extent: 5 },

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
    radius: 0.11,
    episodeRadius: 0.06,
    /** Drops land anywhere on the water you can see, within this distance of the centre (m). */
    maxDistance: 4,
    formHeight: 1.75,
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
