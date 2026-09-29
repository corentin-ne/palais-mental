import { useEffect, useMemo } from 'react';
import { CylinderGeometry, TorusGeometry } from 'three';

import { disposeAll, merge, paint, put } from './build';
import { decorMaterials } from './materials';
import { softBox } from '@/lib/itemGeometry';

const BENCH_H = 0.34;
const UNIT = { w: 0.25, h: 0.27, d: 0.28 };
const SPEAKER = { w: 0.17, h: 0.28, d: 0.22 };

/**
 * A 2000s mini hi-fi on a low oak bench: brushed-silver main unit with a CD tray, a
 * glowing display and a big volume dial, two speakers with fabric grilles, and a few CD
 * cases. Local +z faces the room.
 */
export default function HiFi() {
  const mats = decorMaterials();
  const geo = useMemo(() => {
    const y0 = BENCH_H;
    const front = 0.02 + UNIT.d;
    const spkX = UNIT.w / 2 + SPEAKER.w / 2 + 0.05;
    return {
      bench: merge([
        put(softBox(0.9, 0.035, 0.34, 0.4, 3), [0, BENCH_H - 0.0175, 0.17]),
        ...[-1, 1].map((sx) => put(softBox(0.035, BENCH_H - 0.035, 0.3, 0.4, 3), [sx * 0.41, (BENCH_H - 0.035) / 2, 0.17])),
      ]),
      silver: merge([
        put(softBox(UNIT.w, UNIT.h, UNIT.d, 0.18, 4), [0, y0 + UNIT.h / 2, 0.02 + UNIT.d / 2]),
        ...[-1, 1].map((sx) => put(softBox(SPEAKER.w, SPEAKER.h, SPEAKER.d, 0.18, 4), [sx * spkX, y0 + SPEAKER.h / 2, 0.03 + SPEAKER.d / 2])),
        put(new CylinderGeometry(0.038, 0.04, 0.02, 40).rotateX(Math.PI / 2), [0.065, y0 + UNIT.h * 0.38, front + 0.01]),
      ]),
      dark: merge([
        // CD tray slot, display bezel, buttons.
        paint(put(softBox(UNIT.w * 0.78, 0.012, 0.004, 0.5, 1), [0, y0 + UNIT.h * 0.8, front + 0.001]), '#1C1C20'),
        paint(put(softBox(0.14, 0.05, 0.004, 0.3, 1), [-0.03, y0 + UNIT.h * 0.58, front + 0.001]), '#16181C'),
        ...[0, 1, 2, 3].map((i) =>
          paint(put(softBox(0.016, 0.008, 0.006, 0.5, 1), [-0.08 + i * 0.024, y0 + UNIT.h * 0.3, front + 0.002]), '#6B6E75'),
        ),
        // Speaker grilles, woofers and tweeters.
        ...[-1, 1].flatMap((sx) => {
          const f = 0.03 + SPEAKER.d + 0.001;
          return [
            paint(put(softBox(SPEAKER.w - 0.024, SPEAKER.h - 0.03, 0.004, 0.2, 1), [sx * spkX, y0 + SPEAKER.h / 2, f]), '#2A2B30'),
            paint(put(new TorusGeometry(0.052, 0.006, 8, 40), [sx * spkX, y0 + SPEAKER.h * 0.38, f + 0.003]), '#3A3B40'),
            paint(put(new TorusGeometry(0.018, 0.004, 8, 24), [sx * spkX, y0 + SPEAKER.h * 0.78, f + 0.003]), '#3A3B40'),
          ];
        }),
      ]),
      display: put(softBox(0.12, 0.03, 0.002, 0.2, 1), [-0.03, y0 + UNIT.h * 0.58, front + 0.0035]),
      cds: merge(
        [0, 1, 2].map((i) =>
          paint(put(softBox(0.142, 0.0104, 0.125, 0.15, 1), [0.33, BENCH_H + 0.0052 + i * 0.0106, 0.2], [0, 0.12 * (i - 1), 0]), ['#E4572E', '#17BEBB', '#F2B134'][i]),
        ),
      ),
    };
  }, []);
  useEffect(() => () => disposeAll(geo), [geo]);
  return (
    <>
      <mesh geometry={geo.bench} material={mats.oak} />
      <mesh geometry={geo.silver} material={mats.silver} />
      <mesh geometry={geo.dark} material={mats.painted} />
      <mesh geometry={geo.display} material={mats.display} />
      <mesh geometry={geo.cds} material={mats.painted} />
    </>
  );
}
