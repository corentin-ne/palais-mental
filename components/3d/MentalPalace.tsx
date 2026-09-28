import { MutableRefObject, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFrame, useThree } from '@react-three/fiber';
import {
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  NeutralToneMapping,
  Path,
  Shape,
  ShapeGeometry,
} from 'three';

import { Canvas } from './Canvas';
import CameraRig from './CameraRig';
import CategoryShelf from './CategoryShelf';
import Effects from './Effects';
import HeroItemSpawner from './HeroItemSpawner';
import DustMotes from './environment/DustMotes';
import SkyAndLandscape from './environment/SkyAndLandscape';
import SunShafts from './environment/SunShafts';
import { CATEGORIES } from '@/lib/types';
import { RoomDims, SUN_LIGHT_DIR, WINDOW, WINDOW_TOP, getRoomDims } from '@/lib/palaceLayout';
import { softBox, windowOutline } from '@/lib/itemGeometry';
import { safeDelta } from '@/lib/easing';
import { sceneSignals, wakeAmbient } from '@/lib/sceneSignals';
import { selectRoomLevel, usePalaceStore } from '@/store/usePalaceStore';

export const PALACE_BG = '#FBEEDD';

export type RoomDimsRef = MutableRefObject<RoomDims>;

const PALETTE = {
  wall: '#F4E6D5',
  ceiling: '#FCF6EE',
  floor: '#EBD2AE',
  frame: '#FFFAF3',
  rug: '#F4C7AE',
  rugBorder: '#FBE3D2',
};

/**
 * The 3D room is the app's main menu. Rendering is on-demand: nothing is drawn
 * while the scene is static, so an idle palace costs ~0 GPU/battery. Touching the
 * screen opens a short "breathing" window in which dust and clouds drift.
 */
export default function MentalPalace() {
  const level = usePalaceStore(selectRoomLevel);
  // Animated (damped) room dimensions, shared by the room shell and every shelf zone.
  const dimsRef = useRef<RoomDims>(getRoomDims(level));

  return (
    <View style={StyleSheet.absoluteFill} onTouchStart={() => wakeAmbient(5)}>
      <Canvas
        style={StyleSheet.absoluteFill}
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ fov: 55, near: 0.05, far: 200, position: [0, 1.45, 2] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl, invalidate }) => {
          gl.localClippingEnabled = true; // Hero materialization scan
          gl.toneMapping = NeutralToneMapping; // web: superseded by the composer's ToneMapping pass
          gl.toneMappingExposure = 1.0;
          sceneSignals.requestFrame = () => invalidate();
          wakeAmbient(8); // let the room come alive on first open
        }}
      >
        <color attach="background" args={[PALACE_BG]} />
        <fog attach="fog" args={['#F8E9D6', 30, 110]} />
        <Lighting />
        <SkyAndLandscape />
        <Room dimsRef={dimsRef} />
        <SunShafts dimsRef={dimsRef} />
        <DustMotes dimsRef={dimsRef} />
        {CATEGORIES.map((category) => (
          <CategoryShelf key={category} category={category} dimsRef={dimsRef} />
        ))}
        <HeroItemSpawner />
        <CameraRig dimsRef={dimsRef} />
        <AmbientClock />
        <Effects />
      </Canvas>
    </View>
  );
}

/** Advances the shared ambient time only inside the breathing window, then lets the loop sleep. */
function AmbientClock() {
  const invalidate = useThree((s) => s.invalidate);
  useFrame((_, rawDelta) => {
    if (Date.now() < sceneSignals.ambientUntil) {
      sceneSignals.ambientTime += safeDelta(rawDelta);
      invalidate();
    }
  });
  return null;
}

function Lighting() {
  // Fixed light count: adding/removing lights at runtime forces shader recompiles (frame hitches).
  const [lx, ly, lz] = SUN_LIGHT_DIR;
  return (
    <>
      <hemisphereLight args={['#FFF8EE', '#F8E2CA', 1.5]} />
      {/* Sun: enters through the window, same direction as the god rays. */}
      <directionalLight position={[-lx * 10, -ly * 10, -lz * 10]} intensity={2.1} color="#FFE1B3" />
      {/* Soft bounce from the room, so faces turned away from the window stay luminous. */}
      <directionalLight position={[2, 3, 6]} intensity={0.7} color="#FFEFF3" />
    </>
  );
}

// ------------------------------------------------------------------ Room shell
const COVE_R = 0.35;

type CoveAxis = 'y' | 'x' | 'z';
interface Cove {
  axis: CoveAxis;
  thetaStart: number;
  place: (m: Mesh, d: RoomDims) => void;
}

/**
 * Concave quarter-cylinder fillets on every wall/floor/ceiling seam: the room has
 * no hard corners. thetaStart picks the quadrant facing the seam (see README).
 */
const COVES: Cove[] = [
  // Vertical corners [sx, sz]
  ...([
    [-1, -1, Math.PI],
    [1, -1, Math.PI / 2],
    [1, 1, 0],
    [-1, 1, Math.PI * 1.5],
  ] as const).map(([sx, sz, thetaStart]) => ({
    axis: 'y' as const,
    thetaStart,
    place: (m: Mesh, d: RoomDims) => {
      m.position.set(sx * (d.width / 2 - COVE_R), d.height / 2, sz * (d.depth / 2 - COVE_R));
      m.scale.y = d.height;
    },
  })),
  // Back / front seams, running along x
  ...([
    [-1, false, Math.PI],
    [-1, true, Math.PI / 2],
    [1, false, Math.PI * 1.5],
    [1, true, 0],
  ] as const).map(([sz, top, thetaStart]) => ({
    axis: 'x' as const,
    thetaStart,
    place: (m: Mesh, d: RoomDims) => {
      m.position.set(0, top ? d.height - COVE_R : COVE_R, sz * (d.depth / 2 - COVE_R));
      m.scale.y = d.width;
    },
  })),
  // Left / right seams, running along z
  ...([
    [-1, false, Math.PI * 1.5],
    [-1, true, Math.PI],
    [1, false, 0],
    [1, true, Math.PI / 2],
  ] as const).map(([sx, top, thetaStart]) => ({
    axis: 'z' as const,
    thetaStart,
    place: (m: Mesh, d: RoomDims) => {
      m.position.set(sx * (d.width / 2 - COVE_R), top ? d.height - COVE_R : COVE_R, 0);
      m.scale.y = d.depth;
    },
  })),
];

const COVE_ROTATION: Record<CoveAxis, [number, number, number]> = {
  y: [0, 0, 0],
  x: [0, 0, Math.PI / 2],
  z: [Math.PI / 2, 0, 0],
};

function Room({ dimsRef }: { dimsRef: RoomDimsRef }) {
  const level = usePalaceStore(selectRoomLevel);
  const invalidate = useThree((s) => s.invalidate);
  const target = getRoomDims(level);

  const floor = useRef<Mesh>(null);
  const ceiling = useRef<Mesh>(null);
  const left = useRef<Mesh>(null);
  const right = useRef<Mesh>(null);
  const front = useRef<Mesh>(null);
  const backL = useRef<Mesh>(null);
  const backR = useRef<Mesh>(null);
  const backTop = useRef<Mesh>(null);
  const windowGroup = useRef<Group>(null);
  const rug = useRef<Group>(null);
  const coves = useRef<(Mesh | null)[]>([]);

  const res = useMemo(() => {
    const wall = new MeshStandardMaterial({ color: PALETTE.wall, emissive: PALETTE.wall, emissiveIntensity: 0.3, roughness: 0.95 });
    // Coves face down/sideways, away from the sky light: a touch of glow keeps seams from reading as dark lines.
    const cove = new MeshStandardMaterial({ color: PALETTE.wall, emissive: PALETTE.wall, emissiveIntensity: 0.32, roughness: 0.95, side: DoubleSide });
    const coveGeos = new Map<number, CylinderGeometry>();
    COVES.forEach(({ thetaStart }) => {
      if (!coveGeos.has(thetaStart)) {
        coveGeos.set(thetaStart, new CylinderGeometry(COVE_R, COVE_R, 1, 12, 1, true, thetaStart, Math.PI / 2));
      }
    });

    // Fixed-size wall panel with the arched hole; plain strips around it stretch with the room.
    const panelShape = new Shape();
    const { panelWidth: pw, panelHeight: ph } = WINDOW;
    panelShape.moveTo(-pw / 2, 0).lineTo(pw / 2, 0).lineTo(pw / 2, ph).lineTo(-pw / 2, ph).lineTo(-pw / 2, 0);
    panelShape.holes.push(windowOutline(new Path(), 0));
    const panelGeo = new ShapeGeometry(panelShape, 32);

    // Deep, generously bevelled frame: the "soft" silhouette of the whole scene.
    const frameShape = windowOutline(new Shape(), WINDOW.frame);
    frameShape.holes.push(windowOutline(new Path(), 0));
    const frameGeo = new ExtrudeGeometry(frameShape, {
      depth: 0.2,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.03,
      bevelSegments: 4,
      curveSegments: 40,
    });
    const mullionV = softBox(0.055, WINDOW_TOP - WINDOW.sill, 0.055, 0.45);
    const mullionH = softBox(WINDOW.halfWidth * 2, 0.055, 0.055, 0.45);
    const sill = softBox(WINDOW.halfWidth * 2 + 0.55, 0.08, 0.36, 0.45);
    return { wall, cove, coveGeos, panelGeo, frameGeo, mullionV, mullionH, sill };
  }, []);

  useEffect(
    () => () => {
      res.wall.dispose();
      res.cove.dispose();
      res.coveGeos.forEach((g) => g.dispose());
      [res.panelGeo, res.frameGeo, res.mullionV, res.mullionH, res.sill].forEach((g) => g.dispose());
    },
    [res],
  );

  // A level-up only needs to wake the loop; useFrame keeps it awake until converged.
  useEffect(() => invalidate(), [level, invalidate]);

  useFrame((_, rawDelta) => {
    const d = dimsRef.current;
    const dt = safeDelta(rawDelta);
    d.width = MathUtils.damp(d.width, target.width, 3, dt);
    d.depth = MathUtils.damp(d.depth, target.depth, 3, dt);
    d.height = MathUtils.damp(d.height, target.height, 3, dt);

    const { width: w, depth: dp, height: h } = d;
    const hw = w / 2;
    const hd = dp / 2;
    floor.current?.scale.set(w, dp, 1);
    ceiling.current?.position.set(0, h, 0);
    ceiling.current?.scale.set(w, dp, 1);
    left.current?.position.set(-hw, h / 2, 0);
    left.current?.scale.set(dp, h, 1);
    right.current?.position.set(hw, h / 2, 0);
    right.current?.scale.set(dp, h, 1);
    front.current?.position.set(0, h / 2, hd);
    front.current?.scale.set(w, h, 1);

    const { panelWidth: pw, panelHeight: ph } = WINDOW;
    const side = (w - pw) / 2;
    backL.current?.position.set(-(pw / 2 + side / 2), h / 2, -hd);
    backL.current?.scale.set(side, h, 1);
    backR.current?.position.set(pw / 2 + side / 2, h / 2, -hd);
    backR.current?.scale.set(side, h, 1);
    backTop.current?.position.set(0, ph + (h - ph) / 2, -hd);
    backTop.current?.scale.set(pw, h - ph, 1);
    windowGroup.current?.position.set(0, 0, -hd);
    rug.current?.position.set(0, 0.006, -hd + 3.1);

    COVES.forEach((c, i) => {
      const m = coves.current[i];
      if (m) c.place(m, d);
    });

    const moving =
      Math.abs(d.width - target.width) > 1e-3 ||
      Math.abs(d.depth - target.depth) > 1e-3 ||
      Math.abs(d.height - target.height) > 1e-3;
    if (moving) invalidate();
  });

  return (
    <group>
      <mesh ref={floor} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color={PALETTE.floor} roughness={0.75} />
      </mesh>
      <mesh ref={ceiling} rotation-x={Math.PI / 2}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color={PALETTE.ceiling} emissive={PALETTE.ceiling} emissiveIntensity={0.3} roughness={1} />
      </mesh>
      <mesh ref={left} rotation-y={Math.PI / 2} material={res.wall}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh ref={right} rotation-y={-Math.PI / 2} material={res.wall}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh ref={front} rotation-y={Math.PI} material={res.wall}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh ref={backL} material={res.wall}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh ref={backR} material={res.wall}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh ref={backTop} material={res.wall}>
        <planeGeometry args={[1, 1]} />
      </mesh>

      {COVES.map((c, i) => (
        <mesh
          key={i}
          ref={(m) => {
            coves.current[i] = m;
          }}
          geometry={res.coveGeos.get(c.thetaStart)}
          material={res.cove}
          rotation={COVE_ROTATION[c.axis]}
        />
      ))}

      {/* ---- The window: the home view and the light source of the whole palace */}
      <group ref={windowGroup}>
        <mesh geometry={res.panelGeo} material={res.wall} />
        <mesh geometry={res.frameGeo} position-z={-0.14}>
          <meshStandardMaterial color={PALETTE.frame} roughness={0.55} />
        </mesh>
        <mesh geometry={res.mullionV} position={[0, (WINDOW.sill + WINDOW_TOP) / 2, -0.03]}>
          <meshStandardMaterial color={PALETTE.frame} roughness={0.55} />
        </mesh>
        <mesh geometry={res.mullionH} position={[0, WINDOW.springLine, -0.03]}>
          <meshStandardMaterial color={PALETTE.frame} roughness={0.55} />
        </mesh>
        <mesh geometry={res.sill} position={[0, WINDOW.sill - 0.05, 0.12]}>
          <meshStandardMaterial color={PALETTE.frame} roughness={0.5} />
        </mesh>
        <Plant position={[0.78, WINDOW.sill - 0.01, 0.14]} />
      </group>

      {/* Soft oval rug catching the sun patch */}
      <group ref={rug} rotation-x={-Math.PI / 2}>
        <mesh scale={[1.75, 1.2, 1]}>
          <circleGeometry args={[1, 64]} />
          <meshStandardMaterial color={PALETTE.rugBorder} roughness={1} />
        </mesh>
        <mesh scale={[1.6, 1.07, 1]} position-z={0.002}>
          <circleGeometry args={[1, 64]} />
          <meshStandardMaterial color={PALETTE.rug} roughness={1} />
        </mesh>
      </group>
    </group>
  );
}

/** A small potted plant on the sill: pebble pot, three plump leaves. */
function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position-y={0.06}>
        <cylinderGeometry args={[0.07, 0.055, 0.12, 24]} />
        <meshStandardMaterial color="#EBAA8D" roughness={0.8} />
      </mesh>
      {(
        [
          [0, 0.17, 0, 0.075, 0.1],
          [-0.05, 0.15, 0.02, 0.055, 0.075],
          [0.05, 0.14, -0.02, 0.05, 0.07],
        ] as const
      ).map(([x, y, z, r, ry], i) => (
        <mesh key={i} position={[x, y, z]} scale={[r, ry, r]}>
          <sphereGeometry args={[1, 20, 14]} />
          <meshStandardMaterial color="#9CCB8C" emissive="#CFE8C2" emissiveIntensity={0.15} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}
