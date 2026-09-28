import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Path,
  ShaderMaterial,
  ShapeGeometry,
  Shape,
  Vector4,
} from 'three';

import type { RoomDimsRef } from '../MentalPalace';
import { patchFragment, patchVertex, shaftFragment, shaftVertex } from '@/shaders/lightShaft';
import { windowOutline } from '@/lib/itemGeometry';
import { SUN_LIGHT_DIR, WINDOW, WINDOW_CENTER_Y, WINDOW_TOP, windowPlaneZ } from '@/lib/palaceLayout';
import { sceneSignals } from '@/lib/sceneSignals';

const [LX, LY, LZ] = SUN_LIGHT_DIR;
/** Long enough for the arch's top ray to reach the floor. */
const SHAFT_LENGTH = (WINDOW_TOP / -LY) * 1.02;
const WIN_UNIFORM = new Vector4(WINDOW.halfWidth, WINDOW.sill, WINDOW.springLine, 0);

/** The window outline, scaled about its center, swept along the light into an open prism. */
function buildShaftGeometry(scale: number): BufferGeometry {
  const pts = windowOutline(new Path(), -0.03).getSpacedPoints(72);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  pts.forEach((p, i) => {
    const x = p.x * scale;
    const y = WINDOW_CENTER_Y + (p.y - WINDOW_CENTER_Y) * scale;
    const u = i / (pts.length - 1);
    pos.push(x, y, 0, x + LX * SHAFT_LENGTH, y + LY * SHAFT_LENGTH, LZ * SHAFT_LENGTH);
    uv.push(u, 0, u, 1);
    if (i < pts.length - 1) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** The window projected along the light onto the floor (y = 0); uv keeps window coords. */
function buildPatchGeometry(): ShapeGeometry {
  const geo = new ShapeGeometry(windowOutline(new Shape(), 0.14), 24);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const s = y / -LY; // distance along the ray from window height y down to the floor
    p.setXYZ(i, x + LX * s, 0.004, LZ * s);
  }
  p.needsUpdate = true;
  geo.computeBoundingSphere();
  return geo;
}

const additive = { transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false } as const;

/**
 * Soft volumetric light streaming through the window: two nested additive shaft
 * prisms (outer haze + brighter core) and a sun patch on the floor with mullion
 * shadows. ~3 draw calls, no render targets, no raymarching.
 */
export default function SunShafts({ dimsRef }: { dimsRef: RoomDimsRef }) {
  const group = useRef<Group>(null);

  const res = useMemo(() => {
    const color = new Color('#FFD8A8');
    const shaft = (intensity: number) =>
      new ShaderMaterial({
        vertexShader: shaftVertex,
        fragmentShader: shaftFragment,
        side: DoubleSide,
        ...additive,
        uniforms: { uColor: { value: color }, uIntensity: { value: intensity }, uTime: { value: 0 } },
      });
    return {
      outerGeo: buildShaftGeometry(1),
      coreGeo: buildShaftGeometry(0.62),
      patchGeo: buildPatchGeometry(),
      outerMat: shaft(0.055),
      coreMat: shaft(0.045),
      patchMat: new ShaderMaterial({
        vertexShader: patchVertex,
        fragmentShader: patchFragment,
        ...additive,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        uniforms: { uColor: { value: new Color('#FFD2A0') }, uIntensity: { value: 0.85 }, uWin: { value: WIN_UNIFORM } },
      }),
    };
  }, []);

  useEffect(() => () => Object.values(res).forEach((r) => r.dispose()), [res]);

  useFrame(() => {
    group.current?.position.set(0, 0, windowPlaneZ(dimsRef.current) + 0.02);
    const t = sceneSignals.ambientTime;
    res.outerMat.uniforms.uTime.value = t;
    res.coreMat.uniforms.uTime.value = t * 1.3 + 4;
  });

  return (
    <group ref={group}>
      <mesh geometry={res.outerGeo} material={res.outerMat} renderOrder={2} frustumCulled={false} />
      <mesh geometry={res.coreGeo} material={res.coreMat} renderOrder={2} frustumCulled={false} />
      <mesh geometry={res.patchGeo} material={res.patchMat} renderOrder={1} />
    </group>
  );
}
