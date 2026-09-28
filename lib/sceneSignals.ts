/**
 * Frame-rate signals shared between R3F components. Deliberately NOT in zustand:
 * these change every frame and must never trigger React renders.
 */
export const sceneSignals = {
  /** True while CameraRig is flying; the hero waits for the camera to land. */
  cameraTransitioning: false,
};
