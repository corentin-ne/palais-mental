import { useEffect, useMemo } from 'react';
import { PlaneGeometry, SphereGeometry } from 'three';

import { cyl, disposeAll, merge, put } from './build';
import { decorMaterials } from './materials';
import { DECOR } from '@/config/decor';
import { WINDOW, WINDOW_TOP } from '@/lib/palaceLayout';

/** A sheer panel with soft vertical pleats, hanging from y = top down to the floor. */
function buildPanel(width: number, top: number, pleats: number) {
  const h = top - 0.03;
  const geo = new PlaneGeometry(width, h, 64, 8);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = (p.getX(i) / width + 0.5) * pleats * Math.PI * 2;
    // Pleats are deeper at the bottom, where the fabric falls freely.
    p.setZ(i, Math.sin(u) * (0.018 + 0.02 * (0.5 - p.getY(i) / h)));
  }
  geo.translate(0, h / 2 + 0.03, 0);
  geo.computeVertexNormals();
  return geo;
}

/** Sheer linen curtains on a brass rod, drawn to either side of the window (window-plane space). */
export default function Curtains() {
  const mats = decorMaterials();
  const { panelWidth, pleats } = DECOR.curtains;
  const rodY = WINDOW_TOP + 0.22;
  const reach = WINDOW.halfWidth + 0.75;
  const geo = useMemo(
    () => ({
      panel: buildPanel(panelWidth, rodY - 0.02, pleats),
      rod: put(cyl(0.012, 0.012, reach * 2, 12), [0, rodY, 0], [0, 0, Math.PI / 2]),
      finials: merge([-1, 1].map((sx) => put(new SphereGeometry(0.026, 16, 12), [sx * (reach + 0.01), rodY, 0]))),
    }),
    [panelWidth, pleats, rodY, reach],
  );
  useEffect(() => () => disposeAll(geo), [geo]);
  return (
    <>
      <mesh geometry={geo.rod} material={mats.brass} />
      <mesh geometry={geo.finials} material={mats.brass} />
      {[-1, 1].map((sx) => (
        <mesh key={sx} geometry={geo.panel} material={mats.curtain} position-x={sx * (WINDOW.halfWidth + 0.42)} renderOrder={3} />
      ))}
    </>
  );
}
