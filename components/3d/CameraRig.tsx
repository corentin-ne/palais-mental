import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, PerspectiveCamera, Vector3 } from 'three';

import type { RoomDimsRef } from './MentalPalace';
import { CameraFocus } from '@/lib/types';
import {
  NICHE_BASE_Y,
  RoomDims,
  WINDOW,
  WINDOW_CENTER_Y,
  WINDOW_TOP,
  getRoomDims,
  ShelfLayout,
  getNicheLayout,
  getZoneTransform,
  nicheOuterWidth,
  zoneToWorld,
} from '@/lib/palaceLayout';
import { clamp01, cubicBezier, easeInOutCubic, safeDelta } from '@/lib/easing';
import { sceneSignals, wakeAmbient } from '@/lib/sceneSignals';
import { selectRoomLevel, usePalaceStore } from '@/store/usePalaceStore';

/**
 * Perspective rule: the camera NEVER leaves the room and never looks down on it.
 * It stands at human eye height and only turns its head (yaw), nods (pitch) and
 * walks (bezier dolly). No top-down, bird's-eye or isometric shot exists.
 */
const EYE_HEIGHT = 1.5;
const MIN_EYE = 1.2;
const MAX_EYE = 1.75;
const WINDOW_FOV = 55;
const FOCUS_FOV = 50;
const WALL_MARGIN = 0.9;

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
  yaw0: number;
  yawDelta: number;
  pitch0: number;
  pitch1: number;
  look0: Vector3;
  look1: Vector3;
  fov0: number;
  fov1: number;
  t: number;
  duration: number;
}

/** Distance at which a (w × h) rectangle fills the frame, honoring portrait aspect ratios. */
function fitDistance(fov: number, aspect: number, w: number, h: number) {
  const tanV = Math.tan((fov * Math.PI) / 360);
  const tanH = tanV * aspect;
  return Math.max(w / (2 * tanH), h / (2 * tanV));
}

/** Yaw/pitch for a camera at `from` looking at `to` (Euler order YXZ, yaw 0 = facing -z). */
function lookAngles(from: Vector3, to: Vector3) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

function computeShot(focus: CameraFocus, dims: RoomDims, layout: ShelfLayout | null, aspect: number): Shot {
  const R = dims.radius;
  if (focus === 'window') {
    // Home: standing in the room, gazing slightly up at the arch and the sky beyond.
    const dist = fitDistance(WINDOW_FOV, aspect, WINDOW.halfWidth * 2 * 1.5, (WINDOW_TOP - WINDOW.sill) * 1.4);
    const z = MathUtils.clamp(-R + dist, -R + 2.6, R - WALL_MARGIN);
    return {
      position: new Vector3(0, EYE_HEIGHT, z),
      target: new Vector3(0, WINDOW_CENTER_Y + 0.05, -R),
      fov: WINDOW_FOV,
    };
  }

  // Direct, front-facing, eye-level view of the category's niche and the ledge of objects below it.
  if (!layout) throw new Error('niche layout required');
  const zone = getZoneTransform(focus, dims, nicheOuterWidth(layout));
  const centerY = NICHE_BASE_Y + layout.innerHeight / 2;
  // Aim a little low so the niche sits in the upper frame, clear of the dock.
  const target = new Vector3(...zoneToWorld(zone, [0, centerY - 0.3, layout.depth / 2]));
  const normal = new Vector3(...zone.normal);
  const dist = MathUtils.clamp(
    fitDistance(FOCUS_FOV, aspect, Math.max(1.1, nicheOuterWidth(layout) * 1.3), layout.innerHeight + 1.1),
    1.15,
    R * 2 - WALL_MARGIN * 2,
  );
  const position = clampInside(target.clone().addScaledVector(normal, dist), dims);
  position.y = MathUtils.clamp(centerY + 0.12, MIN_EYE, MAX_EYE);
  return { position, target, fov: FOCUS_FOV };
}

/** Keep the camera (and bezier control points) inside the round room. */
function clampInside(v: Vector3, dims: RoomDims) {
  const max = dims.radius - WALL_MARGIN;
  const r = Math.hypot(v.x, v.z);
  if (r > max) {
    v.x *= max / r;
    v.z *= max / r;
  }
  v.y = MathUtils.clamp(v.y, MIN_EYE, MAX_EYE);
  return v;
}

/**
 * Cinematic, inside-out camera. Position follows a cubic bezier (dolly), while the
 * head turn is interpolated in yaw/pitch space — never by lerping look-at points,
 * which would swing through the camera itself on a 180° turn to the back wall.
 * A slight bank into the turn sells the sweep. Frames are requested only in flight.
 */
export default function CameraRig({ dimsRef }: { dimsRef: RoomDimsRef }) {
  const focus = usePalaceStore((s) => s.focus);
  const level = usePalaceStore(selectRoomLevel);
  // Re-frame only when the focused shelf's footprint actually changes.
  const shelfKey = usePalaceStore((s) => {
    if (s.focus === 'window') return '';
    const l = getNicheLayout(s.focus, s.order[s.focus], s.items);
    return `${l.tiers}:${l.slotsPerTier}`;
  });

  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);

  const flight = useRef<Flight | null>(null);
  const yaw = useRef(0);
  const pitch = useRef(0);
  const look = useRef(new Vector3(0, WINDOW_CENTER_Y, -4));
  const initialized = useRef(false);

  useEffect(() => {
    camera.rotation.order = 'YXZ';
    const aspect = size.width / Math.max(1, size.height);
    const s = usePalaceStore.getState();
    const layout = focus === 'window' ? null : getNicheLayout(focus, s.order[focus], s.items);
    // Frame against the room size we are growing TO, not the damped in-between.
    const dims = getRoomDims(level);
    const shot = computeShot(focus, dims, layout, aspect);
    const angles = lookAngles(shot.position, shot.target);

    if (!initialized.current) {
      // First mount: place the camera at the window view, no flight.
      initialized.current = true;
      camera.position.copy(shot.position);
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
      yaw.current = angles.yaw;
      pitch.current = angles.pitch;
      camera.rotation.set(angles.pitch, angles.yaw, 0);
      look.current.copy(shot.target);
      sceneSignals.focusPoint.copy(shot.target);
      invalidate();
      return;
    }

    const p0 = camera.position.clone();
    const p3 = shot.position;
    const travel = p0.distanceTo(p3);
    let yawDelta = wrapAngle(angles.yaw - yaw.current);
    // A half-turn is ambiguous: turn toward the side the destination is on.
    if (Math.abs(Math.abs(yawDelta) - Math.PI) < 0.08) {
      const toTarget = new Vector3().subVectors(shot.target, p0);
      const right = new Vector3(Math.cos(yaw.current), 0, -Math.sin(yaw.current));
      yawDelta = Math.PI * (toTarget.dot(right) >= 0 ? -1 : 1);
    }
    const fwd0 = new Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const fwd1 = new Vector3(-Math.sin(angles.yaw), 0, -Math.cos(angles.yaw));

    flight.current = {
      p0,
      // Push off gently in the direction we were looking...
      p1: clampInside(p0.clone().addScaledVector(fwd0, travel * 0.18), dimsRef.current),
      // ...and arrive walking forward onto the subject, head-on.
      p2: clampInside(p3.clone().addScaledVector(fwd1, -travel * 0.32).setY(p3.y + 0.06), dimsRef.current),
      p3,
      yaw0: yaw.current,
      yawDelta,
      pitch0: pitch.current,
      pitch1: angles.pitch,
      look0: look.current.clone(),
      look1: shot.target,
      fov0: camera.fov,
      fov1: shot.fov,
      t: 0,
      duration: MathUtils.clamp(1.0 + travel * 0.12 + Math.abs(yawDelta) * 0.3, 1.1, 2.4),
    };
    sceneSignals.cameraTransitioning = true;
    wakeAmbient(flight.current.duration + 3);
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, level, shelfKey, size.width, size.height, camera, invalidate]);

  useFrame((_, rawDelta) => {
    const f = flight.current;
    if (!f) return;
    f.t = clamp01(f.t + safeDelta(rawDelta) / f.duration);
    const e = easeInOutCubic(f.t);
    // The head leads the body slightly: we look where we are about to go.
    const eHead = easeInOutCubic(clamp01(f.t * 1.12));

    cubicBezier(camera.position, f.p0, f.p1, f.p2, f.p3, e);
    yaw.current = f.yaw0 + f.yawDelta * eHead;
    pitch.current = f.pitch0 + (f.pitch1 - f.pitch0) * eHead;
    const bank = -f.yawDelta * 0.035 * Math.sin(Math.PI * f.t);
    camera.rotation.set(pitch.current, yaw.current, bank);

    look.current.lerpVectors(f.look0, f.look1, eHead);
    sceneSignals.focusPoint.copy(look.current);

    if (f.fov0 !== f.fov1) {
      camera.fov = f.fov0 + (f.fov1 - f.fov0) * e;
      camera.updateProjectionMatrix();
    }

    if (f.t < 1) {
      invalidate();
    } else {
      flight.current = null;
      yaw.current = wrapAngle(yaw.current);
      camera.rotation.set(pitch.current, yaw.current, 0);
      sceneSignals.cameraTransitioning = false;
    }
  });

  return null;
}
