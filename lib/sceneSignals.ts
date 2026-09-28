import { Vector3 } from 'three';

/**
 * Frame-rate signals shared between R3F components. Deliberately NOT in zustand:
 * these change every frame and must never trigger React renders.
 */
export const sceneSignals = {
  /** True while CameraRig is flying; the hero waits for the camera to land. */
  cameraTransitioning: false,
  /** World point the depth-of-field keeps sharp (window, shelf, or the live hero). */
  focusPoint: new Vector3(0, 2, -4),
  /**
   * Ambient life (dust drift, cloud drift, shaft shimmer) only advances inside a
   * short "breathing" window after an interaction. Outside of it the loop sleeps
   * and every ambient shader freezes on its last frame.
   */
  ambientUntil: 0,
  ambientTime: 0,
  /** Extra yaw (radians) the viewer adds to an inspected object by dragging it. */
  inspectSpin: 0,
  /** Set by the Canvas on creation so non-R3F code can wake the loop. */
  requestFrame: null as null | (() => void),
};

/** Keep ambient VFX alive for at least `seconds` from now and wake the render loop. */
export function wakeAmbient(seconds = 6) {
  sceneSignals.ambientUntil = Math.max(sceneSignals.ambientUntil, Date.now() + seconds * 1000);
  sceneSignals.requestFrame?.();
}
