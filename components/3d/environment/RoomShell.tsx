import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  MathUtils,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Path,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Shape,
  SphereGeometry,
  Vector2,
  Vector3,
  Vector4,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { RoomDimsRef } from '../MentalPalace';
import { WINDOW_SDF } from '@/shaders/common';
import { COVE_RADIUS, RoomDims, WINDOW, getRoomDims } from '@/lib/palaceLayout';
import { softBox, windowOutline } from '@/lib/itemGeometry';
import { safeDelta } from '@/lib/easing';
import { finish } from '@/lib/finishes';
import { withSurface } from '@/lib/materialPatches';
import { LIGHTING } from '@/config/lighting';
import { sceneSignals } from '@/lib/sceneSignals';
import { useSceneLook } from '@/lib/sceneLook';
import { selectRoomLevel, usePalaceStore } from '@/store/usePalaceStore';

const BASE = getRoomDims(0);
const WIN_UNIFORM = new Vector4(WINDOW.halfWidth, WINDOW.sill, WINDOW.springLine, 0);

const DEFAULT_COLORS = {
  floorCenter: new Color('#ECE3D8'),
  floorEdge: new Color('#E6DCD0'),
  wall: new Color('#F8F6F2'),
  dome: new Color('#FBFAF8'),
};

/**
 * The palace shell: ONE lathe surface. A flat floor rolls through a wide cove into
 * a cylindrical wall and closes in a soft dome — there is no corner anywhere. A
 * gentle vertex-colour gradient (sandy floor → cream wall → luminous dome) does the
 * work of ambient occlusion without an extra pass.
 */
function buildShellGeometry(d: RoomDims, COLORS: typeof DEFAULT_COLORS = DEFAULT_COLORS): LatheGeometry {
  const R = d.radius;
  const c = COVE_RADIUS;
  const H = d.wallHeight;
  const D = d.domeHeight;
  const pts: Vector2[] = [];
  [0.001, R * 0.3, R * 0.6, R - c].forEach((r) => pts.push(new Vector2(r, 0)));
  for (let i = 1; i <= 12; i++) {
    const a = -Math.PI / 2 + (i / 12) * (Math.PI / 2);
    pts.push(new Vector2(R - c + c * Math.cos(a), c + c * Math.sin(a)));
  }
  for (let i = 1; i <= 6; i++) pts.push(new Vector2(R, c + ((H - c) * i) / 6));
  for (let i = 1; i <= 18; i++) {
    const a = (i / 18) * (Math.PI / 2);
    pts.push(new Vector2(Math.max(0.001, R * Math.cos(a)), H + D * Math.sin(a)));
  }
  const geo = new LatheGeometry(pts, 144);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const col = new Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const r = Math.hypot(pos.getX(i), pos.getZ(i));
    if (y < 0.002) {
      col.copy(COLORS.floorCenter).lerp(COLORS.floorEdge, MathUtils.smoothstep(r, 0, R - c));
    } else if (y < c) {
      col.copy(COLORS.floorEdge).lerp(COLORS.wall, MathUtils.smoothstep(y, 0, c));
    } else {
      col.copy(COLORS.wall).lerp(COLORS.dome, MathUtils.smoothstep(y, H * 0.6, H + D));
    }
    colors.set([col.r, col.g, col.b], i * 3);
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geo;
}

/**
 * Light oak planks running toward the window, in world space so they stay the same size
 * as the room grows. Each plank gets its own tone and a stretched grain; seams are
 * darkened. Returns a linear colour and writes a 0..1 grain value for the roughness.
 */
const PARQUET_GLSL = /* glsl */ `
  uniform float uFloorRadius;
  float pqHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float plHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float plNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(plHash(i), plHash(i + vec3(1, 0, 0)), f.x), mix(plHash(i + vec3(0, 1, 0)), plHash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(plHash(i + vec3(0, 0, 1)), plHash(i + vec3(1, 0, 1)), f.x), mix(plHash(i + vec3(0, 1, 1)), plHash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  vec3 parquet(vec2 p, out float grain) {
    const float W = 0.17;
    const float L = 1.3;
    float col = floor(p.x / W);
    float off = pqHash(vec2(col, 7.3)) * L;
    float row = floor((p.y + off) / L);
    vec2 id = vec2(col, row);
    vec2 f = vec2(fract(p.x / W), fract((p.y + off) / L));
    float h = pqHash(id);
    float h2 = pqHash(id + 17.0);
    vec3 pale = vec3(0.94, 0.86, 0.74);
    vec3 honey = vec3(0.86, 0.73, 0.58);
    vec3 c = mix(honey, pale, 0.35 + 0.65 * h);
    // Grain: fine lines along the plank, wobbling slowly, plus a few knots.
    float wob = sin(f.y * L * 2.3 + h * 40.0) * 0.22 + sin(f.y * L * 7.0 + h2 * 30.0) * 0.06;
    float fine = sin((f.x + wob) * (24.0 + 20.0 * h2) + h * 12.0);
    float broad = sin((f.x - wob * 0.5) * 7.0 + h2 * 9.0);
    grain = 0.5 + 0.35 * fine * fine * sign(fine) * 0.6 + 0.15 * broad;
    c *= 0.96 + 0.05 * grain;
    float knot = smoothstep(0.06, 0.0, length((f - vec2(0.3 + 0.4 * h2, 0.2 + 0.6 * h)) * vec2(W, L) * vec2(6.0, 2.0)));
    c *= 1.0 - 0.18 * knot * step(0.7, h2);
    float seam = smoothstep(0.0, 0.02, f.x) * smoothstep(1.0, 0.98, f.x) * smoothstep(0.0, 0.005, f.y) * smoothstep(1.0, 0.995, f.y);
    c *= mix(0.84, 1.0, seam);
    return pow(c, vec3(2.2));
  }
`;

/** Shell material: parquet on the flat floor, plaster everywhere else, and the arched window cut out of the wall. */
function buildShellMaterial(): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: DoubleSide, envMapIntensity: 0.45 });
  const floorRadius = { value: BASE.radius - COVE_RADIUS };
  const time = { value: 0 };
  mat.userData.floorRadius = floorRadius;
  mat.userData.time = time;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWin = { value: WIN_UNIFORM };
    shader.uniforms.uFloorRadius = floorRadius;
    shader.uniforms.uTime = time;
    shader.uniforms.uDapple = { value: new Color(LIGHTING.dapple.color).multiplyScalar(LIGHTING.dapple.enabled ? LIGHTING.dapple.intensity : 0) };
    shader.uniforms.uDappleScale = { value: LIGHTING.dapple.scale };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vShellPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvShellPos = (modelMatrix * vec4(position, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vShellPos;\nuniform float uTime;\nuniform vec3 uDapple;\nuniform float uDappleScale;\n${WINDOW_SDF}\n${PARQUET_GLSL}`)
      .replace(
        'void main() {',
        `void main() {
  if (vShellPos.z < -1.0 && windowSdf(vShellPos.xy) < 0.0) discard;
  float pqGrain = 0.5;
  float pqR = length(vShellPos.xz);
  // Wood on the flat floor, up to the skirting where the cove starts to rise.
  float pqMask = (1.0 - smoothstep(uFloorRadius + 0.02, uFloorRadius + 0.06, pqR)) * step(vShellPos.y, 0.01);`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  // Lime plaster on the walls and dome: broad clouds and a fine trowel grain.
  float plaster = 1.0 + (plNoise(vShellPos * 1.6) - 0.5) * 0.045 + (plNoise(vShellPos * 38.0) - 0.5) * 0.025;
  diffuseColor.rgb *= mix(plaster, 1.0, pqMask);
  if (pqMask > 0.0) {
    vec3 wood = parquet(vShellPos.xz, pqGrain);
    // Soft darkening toward the walls keeps the room's ambient-occlusion gradient.
    wood *= mix(1.0, 0.86, smoothstep(0.0, uFloorRadius, pqR));
    diffuseColor.rgb = mix(diffuseColor.rgb, wood, pqMask);
  }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
  // Sunlight broken by leaves outside, drifting slowly over the walls; strongest on the
  // back half of the room, opposite the window.
  if (pqMask < 0.5 && vShellPos.y > 0.5) {
    float around = atan(vShellPos.x, vShellPos.z) * uFloorRadius;
    vec3 q = vec3(around, vShellPos.y, 0.0) * uDappleScale + vec3(uTime * 0.05, uTime * 0.02, uTime * 0.03);
    float leaves = plNoise(q * 1.3) * 0.65 + plNoise(q * 3.1 + 4.0) * 0.35;
    float light = smoothstep(0.52, 0.72, leaves);
    float reach = mix(0.45, 1.0, smoothstep(-0.8, 0.6, vShellPos.z / uFloorRadius)) * smoothstep(0.5, 1.4, vShellPos.y) * (1.0 - smoothstep(3.2, 4.6, vShellPos.y));
    totalEmissiveRadiance += uDapple * light * reach;
  }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, 0.5 + 0.12 * pqGrain, pqMask);`,
      );
  };
  mat.customProgramCacheKey = () => 'palace-shell-window-parquet';
  return mat;
}

/** Stylized potted plant: rounded lathe pot + a fan of plump leaves merged into one mesh. */
export function buildPlant(leafCount: number, height: number, spread: number, seed: number) {
  const pot = new LatheGeometry(
    [
      [0.001, 0],
      [0.13, 0],
      [0.17, 0.03],
      [0.19, 0.12],
      [0.19, 0.24],
      [0.175, 0.3],
      [0.16, 0.3],
      [0.16, 0.27],
      [0.001, 0.27],
    ].map(([x, y]) => new Vector2(x, y)),
    48,
  );
  const leaves: BufferGeometry[] = [];
  const stems: BufferGeometry[] = [];
  const m = new Matrix4();
  const q = new Quaternion();
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < leafCount; i++) {
    const yaw = (i / leafCount) * Math.PI * 2 + rand() * 0.6;
    const tilt = 0.35 + rand() * 0.5;
    const len = height * (0.55 + rand() * 0.45);
    const dir = new Vector3(Math.sin(yaw) * Math.sin(tilt), Math.cos(tilt), Math.cos(yaw) * Math.sin(tilt));
    const tip = dir.clone().multiplyScalar(len).add(new Vector3(0, 0.28, 0));
    // Stem
    const stem = new CylinderGeometry(0.006, 0.009, len, 6);
    q.setFromUnitVectors(new Vector3(0, 1, 0), dir);
    m.compose(dir.clone().multiplyScalar(len / 2).add(new Vector3(0, 0.28, 0)), q, new Vector3(1, 1, 1));
    stems.push(stem.applyMatrix4(m));
    // Leaf: a flattened, pointed ellipsoid hanging from the stem tip.
    const leaf = new SphereGeometry(1, 18, 12);
    const outward = new Vector3(Math.sin(yaw), -0.25 - rand() * 0.3, Math.cos(yaw)).normalize();
    q.setFromUnitVectors(new Vector3(0, 0, 1), outward);
    const size = spread * (0.8 + rand() * 0.4);
    m.compose(tip.clone().addScaledVector(outward, size * 1.1), q, new Vector3(size * 0.55, 0.012 + size * 0.05, size * 1.2));
    leaves.push(leaf.applyMatrix4(m));
  }
  return { pot, leaves: mergeGeometries(leaves)!, stems: mergeGeometries(stems)! };
}

const shadowMaterial = () =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uStrength: { value: 0.22 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uStrength;
      varying vec2 vUv;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float a = pow(1.0 - smoothstep(0.0, 1.0, r), 2.0) * uStrength;
        gl_FragColor = vec4(0.35, 0.24, 0.17, a);
      }`,
  });

export default function RoomShell({ dimsRef }: { dimsRef: RoomDimsRef }) {
  const level = usePalaceStore(selectRoomLevel);
  const invalidate = useThree((s) => s.invalidate);
  const target = getRoomDims(level);

  const shell = useRef<Mesh>(null);
  const windowGroup = useRef<Group>(null);
  const plantL = useRef<Group>(null);
  const plantR = useRef<Group>(null);

  const res = useMemo(() => {
    const frameShape = windowOutline(new Shape(), WINDOW.frame);
    frameShape.holes.push(windowOutline(new Path(), 0));
    const plantA = buildPlant(9, 0.55, 0.16, 11);
    const plantB = buildPlant(13, 0.95, 0.13, 29);
    return {
      shellMat: buildShellMaterial(),
      frameGeo: new ExtrudeGeometry(frameShape, {
        depth: 0.36,
        bevelEnabled: true,
        bevelThickness: 0.06,
        bevelSize: 0.05,
        bevelSegments: 6,
        curveSegments: 56,
      }),
      frameMat: withSurface(finish('satin', '#FFFDF9'), 'plaster', { strength: 0.5 }),
      cushionGeo: softBox(WINDOW.halfWidth * 2 - 0.16, 0.11, 0.46, 0.9, 4),
      pillowGeo: new SphereGeometry(1, 32, 20),
      rugGeo: new CylinderGeometry(1.9, 1.9, 0.016, 128),
      rugInnerGeo: new CylinderGeometry(1.45, 1.45, 0.017, 128),
      shadowGeo: new PlaneGeometry(1, 1),
      shadowMat: shadowMaterial(),
      plantA,
      plantB,
      potMat: finish('glossy', '#E7BCA6'),
      leafMat: finish('satin', '#8FBC8B', { side: DoubleSide }),
      stemMat: finish('satin', '#7FA36E'),
    };
  }, []);

  const look = useSceneLook();
  // Soft furnishings: linen weave on the cushion and pillows, a looser weave on the rug.
  const textiles = useMemo(
    () => ({
      cushion: withSurface(finish('clay', look.cushion), 'linen'),
      pillowA: withSurface(finish('clay', look.pillows[0]), 'boucle', { strength: 0.6 }),
      pillowB: withSurface(finish('clay', look.pillows[1]), 'linen'),
      rugOuter: withSurface(finish('clay', look.rug[0]), 'boucle', { strength: 0.7 }),
      rugInner: withSurface(finish('clay', look.rug[1]), 'linen', { strength: 1.4 }),
    }),
    [look],
  );
  useEffect(() => () => Object.values(textiles).forEach((m) => m.dispose()), [textiles]);
  const shellGeo = useMemo(
    () =>
      buildShellGeometry(BASE, {
        floorCenter: new Color(look.floorCenter),
        floorEdge: new Color(look.floorEdge),
        wall: new Color(look.wall),
        dome: new Color(look.dome),
      }),
    [look],
  );
  useEffect(() => () => shellGeo.dispose(), [shellGeo]);
  useEffect(() => {
    res.frameMat.color.set(look.frame);
    invalidate();
  }, [look, res, invalidate]);

  useEffect(
    () => () =>
      Object.values(res).forEach((r) => {
        if ('dispose' in r && typeof r.dispose === 'function') r.dispose();
        else Object.values(r as object).forEach((g) => (g as BufferGeometry).dispose?.());
      }),
    [res],
  );

  // A level-up only needs to wake the loop; useFrame keeps it awake until converged.
  useEffect(() => invalidate(), [level, invalidate]);

  useFrame((_, rawDelta) => {
    const d = dimsRef.current;
    const dt = safeDelta(rawDelta);
    d.radius = MathUtils.damp(d.radius, target.radius, 3, dt);
    d.wallHeight = MathUtils.damp(d.wallHeight, target.wallHeight, 3, dt);

    const sXZ = d.radius / BASE.radius;
    const sY = (d.wallHeight + d.domeHeight) / (BASE.wallHeight + BASE.domeHeight);
    shell.current?.scale.set(sXZ, sY, sXZ);
    res.shellMat.userData.floorRadius.value = d.radius - COVE_RADIUS;
    res.shellMat.userData.time.value = sceneSignals.ambientTime;
    windowGroup.current?.position.set(0, 0, -d.radius);
    plantL.current?.position.set(-2.05, 0, -d.radius + 1.55);
    plantR.current?.position.set(2.1, 0, -d.radius + 1.6);

    if (Math.abs(d.radius - target.radius) > 1e-3 || Math.abs(d.wallHeight - target.wallHeight) > 1e-3) invalidate();
  });

  const { halfWidth: hw, sill } = WINDOW;

  return (
    <group>
      <mesh ref={shell} geometry={shellGeo} material={res.shellMat} />

      {/* ---- The window: the home view and the light source of the whole palace */}
      <group ref={windowGroup}>
        <mesh geometry={res.frameGeo} material={res.frameMat} position-z={-0.24} />
        {/* Window seat: a long cushion and two pillows tucked into the deep sill */}
        <mesh geometry={res.cushionGeo} material={textiles.cushion} position={[0, sill + 0.055, 0.02]} />
        <mesh geometry={res.pillowGeo} material={textiles.pillowA} position={[-hw + 0.3, sill + 0.2, -0.02]} rotation={[0.2, 0.35, 0.1]} scale={[0.17, 0.14, 0.07]} />
        <mesh geometry={res.pillowGeo} material={textiles.pillowB} position={[-hw + 0.58, sill + 0.18, 0.02]} rotation={[0.1, -0.2, -0.12]} scale={[0.15, 0.12, 0.065]} />
        {/* A small plant on the seat, the first thing framed at home */}
        <group position={[hw - 0.32, sill + 0.005, -0.04]} scale={0.42}>
          <mesh geometry={res.plantA.pot} material={res.potMat} />
          <mesh geometry={res.plantA.stems} material={res.stemMat} />
          <mesh geometry={res.plantA.leaves} material={res.leafMat} />
        </group>
      </group>

      {/* ---- Round two-tone rug catching the sun patch */}
      <group position={[0, 0, -0.9]}>
        <mesh geometry={res.rugGeo} material={textiles.rugOuter} position-y={0.008} />
        <mesh geometry={res.rugInnerGeo} material={textiles.rugInner} position-y={0.0085} />
      </group>

      {/* ---- Plants flanking the window, each grounded by a soft contact shadow */}
      {(
        [
          [plantL, res.plantA, 1],
          [plantR, res.plantB, 1.15],
        ] as const
      ).map(([ref, plant, scale], i) => (
        <group key={i} ref={ref} scale={scale}>
          <mesh geometry={res.shadowGeo} material={res.shadowMat} rotation-x={-Math.PI / 2} position-y={0.004} scale={0.95} />
          <mesh geometry={plant.pot} material={res.potMat} />
          <mesh geometry={plant.stems} material={res.stemMat} />
          <mesh geometry={plant.leaves} material={res.leafMat} />
        </group>
      ))}
    </group>
  );
}
