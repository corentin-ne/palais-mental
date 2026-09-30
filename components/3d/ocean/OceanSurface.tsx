import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  HalfFloatType,
  LinearFilter,
  Matrix4,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
} from 'three';

import { OCEAN } from '@/config/ocean';
import { safeDelta } from '@/lib/easing';
import { oceanSignals } from '@/lib/oceanSignals';
import {
  FULLSCREEN_VERTEX,
  MAX_IMPACTS,
  RIPPLE_DROP_FRAGMENT,
  RIPPLE_STEP_FRAGMENT,
  RIPPLE_VERTEX,
  WATER_FRAGMENT,
} from '@/shaders/ocean';
import { shared } from './uniforms';

const { size: N, extent: EXT } = OCEAN.ripples;
const STEP = 1 / 110;

/**
 * The water, drawn as one full-screen pass behind everything else, plus a small wave-equation
 * simulation around the centre that drops, animals and taps disturb.
 */
export default function OceanSurface() {
  const gl = useThree((s) => s.gl);

  // Half-float render targets are optional on some phones: without them the sea keeps its
  // swell, drops still splash, and only the local ripples are skipped.
  const canRipple = useMemo(
    () => !!(gl.extensions.get('EXT_color_buffer_half_float') || gl.extensions.get('EXT_color_buffer_float')),
    [gl],
  );

  const sim = useMemo(() => {
    const opts = { type: HalfFloatType, format: RGBAFormat, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false, stencilBuffer: false };
    const targets = [new WebGLRenderTarget(N, N, opts), new WebGLRenderTarget(N, N, opts)];
    const scene = new Scene();
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new Mesh(new PlaneGeometry(2, 2));
    quad.frustumCulled = false;
    scene.add(quad);
    const step = new ShaderMaterial({
      vertexShader: RIPPLE_VERTEX,
      fragmentShader: RIPPLE_STEP_FRAGMENT,
      uniforms: { uTex: { value: null }, uDelta: { value: new Vector2(1 / N, 1 / N) }, uShift: { value: new Vector2() } },
    });
    const drop = new ShaderMaterial({
      vertexShader: RIPPLE_VERTEX,
      fragmentShader: RIPPLE_DROP_FRAGMENT,
      uniforms: { uTex: { value: null }, uCenter: { value: new Vector2() }, uRadius: { value: 0.02 }, uStrength: { value: 0 } },
    });
    return { targets, scene, camera, quad, step, drop, acc: 0, cleared: false };
  }, []);

  const water = useMemo(() => {
    const material = new ShaderMaterial({
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: WATER_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        ...shared,
        uInvViewProj: { value: new Matrix4() },
        uCam: { value: new Vector3() },
        uRipples: { value: null },
        uRippleOn: { value: canRipple ? 1 : 0 },
        uRippleExtent: { value: EXT },
        uRippleSize: { value: N },
        uImpact: { value: Array.from({ length: MAX_IMPACTS }, () => new Vector4()) },
        uImpactColor: { value: Array.from({ length: MAX_IMPACTS }, () => new Vector4()) },
      },
    });
    const mesh = new Mesh(new PlaneGeometry(2, 2), material);
    mesh.frustumCulled = false;
    mesh.renderOrder = -100;
    return { mesh, material, slot: 0 };
  }, [canRipple]);

  useEffect(
    () => () => {
      sim.targets.forEach((t) => t.dispose());
      sim.step.dispose();
      sim.drop.dispose();
      sim.quad.geometry.dispose();
      water.material.dispose();
      water.mesh.geometry.dispose();
    },
    [sim, water],
  );

  const pass = (material: ShaderMaterial) => {
    const [a, b] = sim.targets;
    material.uniforms.uTex.value = a.texture;
    sim.quad.material = material;
    gl.setRenderTarget(b);
    gl.render(sim.scene, sim.camera);
    sim.targets.reverse();
  };

  useFrame(({ camera, clock }, rawDelta) => {
    const dt = safeDelta(rawDelta);
    const u = water.material.uniforms;
    const vp = u.uInvViewProj.value as Matrix4;
    camera.updateMatrixWorld();
    vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).invert();
    (u.uCam.value as Vector3).copy(camera.position);

    // Taps become ripples where the finger meets the sea.
    for (const tap of oceanSignals.taps.splice(0)) {
      const p = new Vector4(tap.x, tap.y, 1, 1).applyMatrix4(vp);
      const dir = new Vector3(p.x / p.w, p.y / p.w, p.z / p.w).sub(camera.position).normalize();
      if (dir.y < -0.01) {
        const t = -camera.position.y / dir.y;
        oceanSignals.ripples.push({ x: camera.position.x + dir.x * t, z: camera.position.z + dir.z * t, radius: 0.14, strength: -0.02 });
      }
    }

    for (const im of oceanSignals.impacts.splice(0)) {
      (u.uImpact.value as Vector4[])[water.slot].set(im.x, im.z, clock.elapsedTime, im.strength);
      (u.uImpactColor.value as Vector4[])[water.slot].set(im.color[0], im.color[1], im.color[2], im.foam);
      water.slot = (water.slot + 1) % MAX_IMPACTS;
    }

    if (!canRipple) {
      oceanSignals.ripples.length = 0;
      return;
    }
    if (!sim.cleared) {
      for (const t of sim.targets) {
        gl.setRenderTarget(t);
        gl.setClearColor(0x000000, 0);
        gl.clear();
      }
      sim.cleared = true;
    }
    for (const r of oceanSignals.ripples.splice(0)) {
      const cx = r.x / (2 * EXT) + 0.5;
      const cy = r.z / (2 * EXT) + 0.5;
      if (cx < 0 || cx > 1 || cy < 0 || cy > 1) continue;
      sim.drop.uniforms.uCenter.value.set(cx, cy);
      sim.drop.uniforms.uRadius.value = r.radius / (2 * EXT);
      sim.drop.uniforms.uStrength.value = r.strength;
      pass(sim.drop);
    }
    sim.acc += dt;
    let steps = 0;
    while (sim.acc >= STEP && steps < 3) {
      pass(sim.step);
      sim.acc -= STEP;
      steps++;
    }
    if (steps === 3) sim.acc = 0;
    gl.setRenderTarget(null);
    u.uRipples.value = sim.targets[0].texture;
  });

  return <primitive object={water.mesh} />;
}
