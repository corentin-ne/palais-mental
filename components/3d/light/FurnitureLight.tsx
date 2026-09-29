import { useMemo } from 'react';
import { Color } from 'three';

import Glow from './Glow';
import { LIGHTING } from '@/config/lighting';
import { FurnitureLayout, PLANK_THICKNESS } from '@/lib/palaceLayout';

const mix = (a: string, b: string, t: number) => `#${new Color(a).lerp(new Color(b), t).getHexString()}`;

/**
 * The light around one piece of furniture, in its local space (back at z = 0, front at
 * z = depth): a beam from the dome, a pool on the floor, a halo on the wall behind, and
 * light washing down the back panel under each shelf's light line.
 */
export default function FurnitureLight({ layout, accent }: { layout: FurnitureLayout; accent: string }) {
  const { beam, floorPool, wallWash, shelfWash } = LIGHTING.furniture;
  const { outerWidth: w, top, depth, stage, tiers, tierHeight, baseY, length } = layout;
  const colors = useMemo(
    () => ({
      pool: mix(floorPool.color, accent, floorPool.accentMix),
      wall: mix(wallWash.color, accent, wallWash.accentMix),
      shelf: mix('#FFFFFF', accent, 0.35),
    }),
    [accent, floorPool, wallWash],
  );
  // Round to centimetres so tiny layout changes don't rebuild the light geometry.
  const r = (v: number) => Math.round(v * 100) / 100;
  const washes = stage === 0 ? [] : Array.from({ length: tiers }, (_, i) => baseY + (i + 1) * tierHeight - PLANK_THICKNESS);

  return (
    <>
      {beam.enabled && (
        <Glow
          kind="beam"
          color={beam.color}
          intensity={beam.intensity}
          size={[0.08, r(Math.max(0.35, w * beam.spread)), r(top + beam.height)]}
          position={[0, top + beam.height, depth * 0.35]}
        />
      )}
      {floorPool.enabled && (
        <Glow
          kind="pool"
          color={colors.pool}
          intensity={floorPool.intensity}
          size={[r(w * 1.9 + 0.4), r(1.4)]}
          position={[0, 0.009, depth + 0.45]}
          rotation={[-Math.PI / 2, 0, 0]}
          breathe
        />
      )}
      {wallWash.enabled && (
        <Glow kind="pool" color={colors.wall} intensity={wallWash.intensity} size={[r(w * 2.3 + 0.6), r(top * 1.7 + 0.8)]} position={[0, top * 0.62, -0.06]} />
      )}
      {shelfWash.enabled &&
        washes.map((y, i) => (
          <Glow
            key={i}
            kind="wash"
            color={colors.shelf}
            intensity={shelfWash.intensity}
            size={[r(length * 0.96), r(tierHeight - PLANK_THICKNESS)]}
            position={[0, y - (tierHeight - PLANK_THICKNESS) / 2, 0.026]}
          />
        ))}
    </>
  );
}
