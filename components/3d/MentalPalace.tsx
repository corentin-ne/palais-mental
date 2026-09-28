import { MutableRefObject, useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { useFrame, useThree } from '@react-three/fiber';
import { NeutralToneMapping } from 'three';

import { Canvas } from './Canvas';
import CameraRig from './CameraRig';
import CategoryShelf from './CategoryShelf';
import Effects from './Effects';
import HeroItemSpawner from './HeroItemSpawner';
import InspectItem from './InspectItem';
import DustMotes from './environment/DustMotes';
import RoomShell from './environment/RoomShell';
import SkyAndLandscape from './environment/SkyAndLandscape';
import SunShafts from './environment/SunShafts';
import { CATEGORIES } from '@/lib/types';
import { RoomDims, SUN_LIGHT_DIR, getRoomDims } from '@/lib/palaceLayout';
import { bakePalaceEnvironment } from '@/lib/envMap';
import { safeDelta } from '@/lib/easing';
import { sceneSignals, wakeAmbient } from '@/lib/sceneSignals';
import { selectRoomLevel, usePalaceStore } from '@/store/usePalaceStore';

export const PALACE_BG = '#F6EEE4';

export type RoomDimsRef = MutableRefObject<RoomDims>;

/**
 * The 3D room is the app's main menu. Rendering is on-demand: nothing is drawn
 * while the scene is static, so an idle palace costs ~0 GPU/battery. Touching the
 * screen opens a short "breathing" window in which dust and clouds drift.
 */
export default function MentalPalace() {
  const level = usePalaceStore(selectRoomLevel);
  const ambient = usePalaceStore((s) => s.settings.ambient);
  // Animated (damped) room dimensions, shared by the shell and every niche.
  const dimsRef = useRef<RoomDims>(getRoomDims(level));

  return (
    <Canvas
      style={StyleSheet.absoluteFill}
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ fov: 55, near: 0.05, far: 200, position: [0, 1.5, 1] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl, invalidate }) => {
        gl.localClippingEnabled = true; // Hero materialization scan
        gl.toneMapping = NeutralToneMapping; // web: superseded by the composer's ToneMapping pass
        sceneSignals.requestFrame = () => invalidate();
        wakeAmbient(8); // let the room come alive on first open
      }}
    >
      <color attach="background" args={[PALACE_BG]} />
      <fog attach="fog" args={['#F8E9D6', 30, 110]} />
      <PalaceEnvironment />
      <Lighting />
      <SkyAndLandscape />
      <RoomShell dimsRef={dimsRef} />
      <SunShafts dimsRef={dimsRef} />
      {ambient && <DustMotes dimsRef={dimsRef} />}
      {CATEGORIES.map((category) => (
        <CategoryShelf key={category} category={category} dimsRef={dimsRef} />
      ))}
      <HeroItemSpawner />
      <InspectItem />
      <CameraRig dimsRef={dimsRef} />
      <AmbientClock enabled={ambient} />
      <Effects />
    </Canvas>
  );
}

/** Bakes the image-based lighting once; every material picks it up via scene.environment. */
function PalaceEnvironment() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const tex = bakePalaceEnvironment(gl);
    if (!tex) return;
    scene.environment = tex;
    scene.environmentIntensity = 0.65;
    invalidate();
    return () => {
      scene.environment = null;
      tex.dispose();
    };
  }, [gl, scene, invalidate]);
  return null;
}

/** Advances the shared ambient time only inside the breathing window, then lets the loop sleep. */
function AmbientClock({ enabled }: { enabled: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  useFrame((_, rawDelta) => {
    if (enabled && Date.now() < sceneSignals.ambientUntil) {
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
      <hemisphereLight args={['#FBF8F4', '#EADDCE', 1.0]} />
      {/* Sun: enters through the window, same direction as the god rays. */}
      <directionalLight position={[-lx * 10, -ly * 10, -lz * 10]} intensity={1.5} color="#FFEBD2" />
      {/* Soft bounce from the room, so faces turned away from the window stay luminous. */}
      <directionalLight position={[1.5, 3, 5]} intensity={0.4} color="#F4F1FF" />
    </>
  );
}
