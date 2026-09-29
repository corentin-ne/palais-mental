import { useEffect, useMemo } from 'react';
import { CapsuleGeometry, PlaneGeometry, ShaderMaterial, SphereGeometry } from 'three';

import { cyl, disposeAll, merge, paint, put } from './build';
import { decorMaterials } from './materials';
import Glow from '../light/Glow';
import { LIGHTING } from '@/config/lighting';

import { softBox } from '@/lib/itemGeometry';
import { screenFragment, screenVertex } from '@/shaders/screen';

const LEG = 0.12;
const BODY_H = 0.42;
const DEPTH = 0.42;

/**
 * Low lacquered media console with fluted doors and an oak top, a slim TV on a small
 * stand, a soundbar, and a games console with its controller. The collections of films,
 * series and games stand around it. Local +z faces the room; the back is at z = 0.
 */
export default function TvConsole({ width }: { width: number }) {
  const mats = decorMaterials();
  const top = LEG + BODY_H + 0.03;
  const res = useMemo(() => {
    const reeds = Math.floor((width - 0.1) / 0.034);
    const tvW = Math.min(1.15, width * 0.76);
    const tvH = tvW * 0.5625;
    const tvY = top + 0.075 + tvH / 2;
    return {
      tvW,
      tvH,
      tvY,
      body: put(softBox(width, BODY_H, DEPTH, 0.12, 4), [0, LEG + BODY_H / 2, DEPTH / 2]),
      reeds: merge(
        Array.from({ length: reeds }, (_, i) =>
          put(new CapsuleGeometry(0.012, BODY_H - 0.1, 3, 8), [-width / 2 + 0.05 + (i + 0.5) * ((width - 0.1) / reeds), LEG + BODY_H / 2, DEPTH + 0.004]),
        ),
      ),
      slab: put(softBox(width + 0.04, 0.03, DEPTH + 0.02, 0.4, 3), [0, top - 0.015, DEPTH / 2]),
      legs: merge(
        [
          [-1, 0],
          [1, 0],
          [-1, 1],
          [1, 1],
        ].map(([sx, sz]) => put(cyl(0.018, 0.012, LEG, 12), [sx * (width / 2 - 0.08), LEG / 2, sz ? DEPTH - 0.07 : 0.07])),
      ),
      tvBody: put(softBox(tvW, tvH, 0.035, 0.3, 3), [0, tvY, DEPTH * 0.42]),
      tvFoot: merge([
        put(softBox(0.34, 0.012, 0.2, 0.5, 2), [0, top + 0.006, DEPTH * 0.45]),
        put(softBox(0.06, 0.07, 0.03, 0.4, 2), [0, top + 0.045, DEPTH * 0.4]),
      ]),
      screen: put(new PlaneGeometry(tvW - 0.03, tvH - 0.03), [0, tvY, DEPTH * 0.42 + 0.0185]),
      screenMat: new ShaderMaterial({ vertexShader: screenVertex, fragmentShader: screenFragment }),
      soundbar: put(softBox(Math.min(0.72, width * 0.5), 0.06, 0.09, 0.5, 3), [0, top + 0.03, DEPTH * 0.82]),
      console: merge([
        paint(put(softBox(0.2, 0.045, 0.16, 0.4, 3), [width / 2 - 0.2, top + 0.0225, DEPTH * 0.55]), '#F4F2EE'),
        paint(put(softBox(0.2, 0.004, 0.004, 0.5, 1), [width / 2 - 0.2, top + 0.03, DEPTH * 0.55 + 0.081]), '#2A2B30'),
        paint(put(new CapsuleGeometry(0.022, 0.07, 4, 10), [width / 2 - 0.2, top + 0.024, DEPTH * 0.86], [0, 0, Math.PI / 2]), '#EDEAE4'),
        paint(put(new SphereGeometry(0.03, 16, 10), [width / 2 - 0.25, top + 0.02, DEPTH * 0.86], [0, 0, 0], [1, 0.6, 1.1]), '#EDEAE4'),
        paint(put(new SphereGeometry(0.03, 16, 10), [width / 2 - 0.15, top + 0.02, DEPTH * 0.86], [0, 0, 0], [1, 0.6, 1.1]), '#EDEAE4'),
      ]),
    };
  }, [width, top]);
  useEffect(() => () => {
    disposeAll(res);
    res.screenMat.dispose();
  }, [res]);
  return (
    <>
      <mesh geometry={res.body} material={mats.lacquer} />
      <mesh geometry={res.reeds} material={mats.lacquer} />
      <mesh geometry={res.slab} material={mats.oak} />
      <mesh geometry={res.legs} material={mats.oakY} />
      <mesh geometry={res.tvBody} material={mats.charcoal} />
      <mesh geometry={res.tvFoot} material={mats.charcoal} />
      <mesh geometry={res.screen} material={res.screenMat} />
      <mesh geometry={res.soundbar} material={mats.grill} />
      <mesh geometry={res.console} material={mats.painted} />
      {/* Bias light: the screen's glow spilling onto the wall behind the TV. */}
      {LIGHTING.decor.tvBias.enabled && (
        <Glow
          kind="pool"
          color={LIGHTING.decor.tvBias.color}
          intensity={LIGHTING.decor.tvBias.intensity}
          size={[res.tvW * 2.2, res.tvH * 2.6]}
          position={[0, res.tvY, DEPTH * 0.42 - 0.03]}
        />
      )}
    </>
  );
}
