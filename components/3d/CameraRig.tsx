import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';

import { CameraFocus } from '@/lib/types';
import { SHELF_BASE_Y, getRoomDims, getShelfLayout, getZoneTransform, zoneToWorld } from '@/lib/palaceLayout';
import { clamp01, cubicBezier, easeInOutCubic, safeDelta } from '@/lib/easing';
import { sceneSignals } from '@/lib/sceneSignals';
import { selectRoomLevel, usePalaceStore } from '@/store/usePalaceStore';

interface Shot {
  position: Vector3;
  target: Vector3;
  fov: number;
}

interface Flight {
  p0: Vector3;
  p1: Vector3;
  p2: Vector3;
  p3: Vector3;
  look0: Vector3;
  look1: Vector3;
  fov0: number;
  fov1: number;
  t: number;
  duration: number;
}

const UP = new Vector3(0, 1, 0);
/** Wider lens for the diorama overview, tighter "portrait" lens for zone close-ups. */
const OVERVIEW_FOV = 62;
const FOCUS_FOV = 50;

/** Distance at which a (w × h) rectangle fills the frame, honoring portrait aspect ratios. */
function fitDistance(fov: number, aspect: number, w: number, h: number) {
  const tanV = Math.tan((fov * Math.PI) / 360);
  const tanH = tanV * aspect;
  return Math.max(w / (2 * tanH), h / (2 * tanV));
}

function computeShot(focus: CameraFocus, level: number, count: number, aspect: number): Shot {
  const dims = getRoomDims(level);
  if (focus === 'overview') {
    // High "diorama" establishing shot from the open fourth wall: every zone reads at once,
    // pulled back further on narrow (portrait) screens.
    const pullBack = fitDistance(OVERVIEW_FOV, aspect, dims.width * 0.8, dims.depth);
    return {
      position: new Vector3(0, dims.height * 1.2 + pullBack * 0.55, dims.depth / 2 + pullBack * 0.55),
      target: new Vector3(0, 0.4, -dims.depth * 0.08),
      fov: OVERVIEW_FOV,
    };
  }

  // Direct, front-facing view of the category zone, framed to its current shelf size.
  const zone = getZoneTransform(focus, dims);
  const layout = getShelfLayout(focus, count);
  // Look slightly below the shelf's center so it sits in the upper frame, clear of the bottom UI.
  const centerY = (SHELF_BASE_Y + layout.height) / 2 - 0.22;
  const target = new Vector3(...zoneToWorld(zone, [0, centerY, layout.depth / 2]));
  const dist = Math.max(1.4, fitDistance(FOCUS_FOV, aspect, Math.max(1.5, layout.length * 1.2), layout.height - SHELF_BASE_Y + 1.3));
  const position = target.clone().addScaledVector(new Vector3(...zone.normal), dist);
  position.y += 0.15; // a hair above eye level feels less clinical
  return { position, target, fov: FOCUS_FOV };
}

/**
 * Cinematic camera: every focus change flies along a cubic bezier whose second
 * control point sits on the destination's normal, so the camera always arrives
 * head-on. Frames are only requested while in flight.
 */
export default function CameraRig() {
  const focus = usePalaceStore((s) => s.focus);
  const level = usePalaceStore(selectRoomLevel);
  // Re-frame only when the focused shelf's footprint actually changes.
  const shelfKey = usePalaceStore((s) => {
    if (s.focus === 'overview') return '';
    const l = getShelfLayout(s.focus, s.order[s.focus].length);
    return `${l.tiers}:${l.slotsPerTier}`;
  });
  const count = usePalaceStore((s) => (s.focus === 'overview' ? 0 : s.order[s.focus].length));

  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);

  const flight = useRef<Flight | null>(null);
  const look = useRef(new Vector3(0, 1, 0));
  const initialized = useRef(false);

  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const shot = computeShot(focus, level, count, aspect);

    if (!initialized.current) {
      // First mount: place the camera, no flight.
      initialized.current = true;
      camera.position.copy(shot.position);
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
      look.current.copy(shot.target);
      camera.lookAt(look.current);
      invalidate();
      return;
    }

    const p0 = camera.position.clone();
    const p3 = shot.position;
    const travel = p0.distanceTo(p3);
    const arrival = p3.clone().sub(shot.target).normalize();
    flight.current = {
      p0,
      // Lift off: rise and drift toward the destination.
      p1: p0.clone().lerp(p3, 0.3).addScaledVector(UP, Math.min(1.6, travel * 0.18)),
      // Approach: come in along the zone normal for a front-facing landing.
      p2: p3.clone().addScaledVector(arrival, travel * 0.35).addScaledVector(UP, 0.25),
      p3,
      look0: look.current.clone(),
      look1: shot.target,
      fov0: camera.fov,
      fov1: shot.fov,
      t: 0,
      duration: Math.min(2.1, Math.max(1.0, 0.85 + travel * 0.09)),
    };
    sceneSignals.cameraTransitioning = true;
    invalidate();
    // `count` is intentionally excluded: shelfKey captures the changes that matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, level, shelfKey, size.width, size.height, camera, invalidate]);

  useFrame((_, rawDelta) => {
    const f = flight.current;
    if (!f) return;
    f.t = clamp01(f.t + safeDelta(rawDelta) / f.duration);
    const e = easeInOutCubic(f.t);
    cubicBezier(camera.position, f.p0, f.p1, f.p2, f.p3, e);
    look.current.lerpVectors(f.look0, f.look1, easeInOutCubic(clamp01(f.t * 1.15)));
    camera.lookAt(look.current);
    if (f.fov0 !== f.fov1) {
      camera.fov = f.fov0 + (f.fov1 - f.fov0) * e;
      camera.updateProjectionMatrix();
    }

    if (f.t < 1) {
      invalidate();
    } else {
      flight.current = null;
      sceneSignals.cameraTransitioning = false;
    }
  });

  return null;
}
