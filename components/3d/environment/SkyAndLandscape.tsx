import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, Color, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Quaternion, ShaderMaterial, Vector3 } from 'three';

import { skyFragment, skyVertex } from '@/shaders/sky';
import { SUN_VISUAL_DIR } from '@/lib/palaceLayout';
import { sceneSignals } from '@/lib/sceneSignals';
import { useSceneLook } from '@/lib/sceneLook';

/** Deterministic PRNG so the sky composition is identical on every launch. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cloud banks framed by the arch: [x, y, z, size]. */
const CLOUDS: [number, number, number, number][] = [
  [-4.8, 4.2, -34, 2.2],
  [3.6, 6.8, -38, 2.6],
  [2.6, 11.8, -40, 1.8],
  [6.4, 3.0, -30, 1.6],
  [-7.5, 8.4, -42, 2.4],
  [1.8, 2.2, -44, 1.4],
];

/**
 * Everything outside the window: gradient sky dome with an HDR sun, fluffy
 * stylized clouds (one instanced draw call) and soft pastel hills.
 */
export default function SkyAndLandscape() {
  const look = useSceneLook();
  const skyMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uZenith: { value: new Color('#4D9EDD') },
          uHorizon: { value: new Color('#C6E3F4') },
          uGround: { value: new Color('#F6E3CF') },
          uSunColor: { value: new Color('#FFE6BD') },
          uSunDir: { value: new Vector3(...SUN_VISUAL_DIR) },
        },
      }),
    [],
  );

  const puffs = useMemo(() => {
    const rand = mulberry32(7);
    const out: { p: Vector3; s: Vector3 }[] = [];
    for (const [cx, cy, cz, size] of CLOUDS) {
      const n = 6 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) {
        const u = (i / (n - 1)) * 2 - 1; // spread along the bank
        const r = size * (0.55 + rand() * 0.45) * (1 - Math.abs(u) * 0.35);
        out.push({
          p: new Vector3(cx + u * size * 1.6, cy + r * 0.25 + rand() * size * 0.25, cz + (rand() - 0.5) * size),
          s: new Vector3(r, r * 0.82, r),
        });
      }
    }
    return out;
  }, []);

  const cloudGeo = useMemo(() => new IcosahedronGeometry(1, 3), []);
  const clouds = useRef<InstancedMesh>(null);
  const cloudGroup = useRef<Group>(null);

  useLayoutEffect(() => {
    const mesh = clouds.current;
    if (!mesh) return;
    const m = new Matrix4();
    const q = new Quaternion();
    puffs.forEach(({ p, s }, i) => mesh.setMatrixAt(i, m.compose(p, q, s)));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [puffs]);

  // Clouds only drift while the ambient clock runs (it freezes when the loop sleeps).
  useFrame(() => {
    (skyMat.uniforms.uZenith.value as Color).set(look.zenith);
    (skyMat.uniforms.uHorizon.value as Color).set(look.horizon);
    if (cloudGroup.current) cloudGroup.current.position.x = Math.sin(sceneSignals.ambientTime * 0.03) * 1.2;
  });

  return (
    <group>
      <mesh material={skyMat} renderOrder={-1} frustumCulled={false}>
        <sphereGeometry args={[80, 32, 16]} />
      </mesh>

      <group ref={cloudGroup}>
        <instancedMesh ref={clouds} args={[cloudGeo, undefined, puffs.length]} frustumCulled={false}>
          <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.85} roughness={1} envMapIntensity={0.2} />
        </instancedMesh>
      </group>

      {/* Rolling hills on the horizon, hazed by the scene fog. */}
      <mesh position={[-9, -7.2, -46]} scale={[22, 8, 10]}>
        <sphereGeometry args={[1, 40, 20]} />
        <meshStandardMaterial color="#B5CFA8" emissive="#D6E6CC" emissiveIntensity={0.2} roughness={1} />
      </mesh>
      <mesh position={[11, -8.2, -52]} scale={[26, 9, 12]}>
        <sphereGeometry args={[1, 40, 20]} />
        <meshStandardMaterial color="#A3C4AE" emissive="#D0E3D6" emissiveIntensity={0.2} roughness={1} />
      </mesh>
      <mesh position={[0, -9.5, -38]} scale={[20, 9, 8]}>
        <sphereGeometry args={[1, 40, 20]} />
        <meshStandardMaterial color="#C4D9AE" emissive="#E0EBD2" emissiveIntensity={0.18} roughness={1} />
      </mesh>
    </group>
  );
}
