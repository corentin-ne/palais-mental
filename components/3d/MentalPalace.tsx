import { MutableRefObject, useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { useFrame, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, Group, MathUtils, Mesh } from 'three';

import { Canvas } from './Canvas';
import CameraRig from './CameraRig';
import CategoryShelf from './CategoryShelf';
import HeroItemSpawner from './HeroItemSpawner';
import { CATEGORIES } from '@/lib/types';
import { RoomDims, getRoomDims } from '@/lib/palaceLayout';
import { safeDelta } from '@/lib/easing';
import { selectRoomLevel, usePalaceStore } from '@/store/usePalaceStore';

export const PALACE_BG = '#07080B';

export type RoomDimsRef = MutableRefObject<RoomDims>;

/**
 * The 3D room is the app's main menu. Rendering is on-demand: nothing is drawn
 * while the scene is static, so an idle palace costs ~0 GPU/battery.
 */
export default function MentalPalace() {
  const level = usePalaceStore(selectRoomLevel);
  // Animated (damped) room dimensions, shared by the room shell and every shelf zone.
  const dimsRef = useRef<RoomDims>(getRoomDims(level));

  return (
    <Canvas
      style={StyleSheet.absoluteFill}
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ fov: 62, near: 0.05, far: 120, position: [0, 12, 16] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true; // Hero materialization scan
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <color attach="background" args={[PALACE_BG]} />
      <fog attach="fog" args={[PALACE_BG, 24, 60]} />
      <Lighting />
      <Room dimsRef={dimsRef} />
      {CATEGORIES.map((category) => (
        <CategoryShelf key={category} category={category} dimsRef={dimsRef} />
      ))}
      <HeroItemSpawner />
      <CameraRig />
    </Canvas>
  );
}

function Lighting() {
  // Fixed light count: adding/removing lights at runtime forces shader recompiles (frame hitches).
  return (
    <>
      <hemisphereLight args={['#DDE3FF', '#16161C', 1.35]} />
      <directionalLight position={[3, 7, 6]} intensity={2.6} color="#FFF1E0" />
      <directionalLight position={[-6, 4, -1]} intensity={0.8} color="#9DB8FF" />
    </>
  );
}

function Room({ dimsRef }: { dimsRef: RoomDimsRef }) {
  const level = usePalaceStore(selectRoomLevel);
  const invalidate = useThree((s) => s.invalidate);
  const target = getRoomDims(level);

  const floor = useRef<Mesh>(null);
  const back = useRef<Mesh>(null);
  const left = useRef<Mesh>(null);
  const right = useRef<Mesh>(null);
  const trim = useRef<Group>(null);

  // A level-up only needs to wake the loop; useFrame keeps it awake until converged.
  useEffect(() => invalidate(), [level, invalidate]);

  useFrame((_, rawDelta) => {
    const d = dimsRef.current;
    const dt = safeDelta(rawDelta);
    d.width = MathUtils.damp(d.width, target.width, 3, dt);
    d.depth = MathUtils.damp(d.depth, target.depth, 3, dt);
    d.height = MathUtils.damp(d.height, target.height, 3, dt);

    const { width: w, depth: dp, height: h } = d;
    floor.current?.scale.set(w, dp, 1);
    back.current?.position.set(0, h / 2, -dp / 2);
    back.current?.scale.set(w, h, 1);
    left.current?.position.set(-w / 2, h / 2, 0);
    left.current?.scale.set(dp, h, 1);
    right.current?.position.set(w / 2, h / 2, 0);
    right.current?.scale.set(dp, h, 1);
    trim.current?.scale.set(w, 1, dp);

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
        <meshStandardMaterial color="#1C1D23" roughness={0.8} metalness={0.05} />
      </mesh>
      <mesh ref={back}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color="#2A2B33" roughness={0.95} />
      </mesh>
      <mesh ref={left} rotation-y={Math.PI / 2}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color="#25262E" roughness={0.95} />
      </mesh>
      <mesh ref={right} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color="#25262E" roughness={0.95} />
      </mesh>
      {/* Soft center inlay: scales with the room so expansion reads at a glance. */}
      <group ref={trim}>
        <mesh rotation-x={-Math.PI / 2} position-y={0.002}>
          <ringGeometry args={[0.18, 0.182, 96]} />
          <meshBasicMaterial color="#3A3E4F" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
