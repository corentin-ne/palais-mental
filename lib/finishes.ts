/**
 * Builds materials from the finishes in config/finishes. Clear and tinted finishes take
 * their tint as the absorption colour, so a jelly block is coloured through its whole
 * volume instead of on its surface.
 */
import { Platform } from 'react-native';
import { Color, ColorRepresentation, MeshPhysicalMaterial, MeshPhysicalMaterialParameters } from 'three';

import { FINISHES, FINISH_OPTIONS, FinishKind } from '@/config/finishes';
import { CATEGORY_SPECS } from '@/config/collections';
import type { CategoryId } from './types';

export const transmissionEnabled = Platform.OS === 'web' || FINISH_OPTIONS.nativeTransmission;

export function finish(kind: FinishKind, color: ColorRepresentation, extra: MeshPhysicalMaterialParameters = {}): MeshPhysicalMaterial {
  const f = FINISHES[kind];
  const tint = new Color(color);
  const clear = (f.transmission ?? 0) > 0;
  const params: MeshPhysicalMaterialParameters = {
    color: clear ? new Color('#FFFFFF').lerp(tint, 0.35) : tint,
    roughness: f.roughness,
    metalness: f.metalness ?? 0,
    clearcoat: f.clearcoat ?? 0,
    clearcoatRoughness: f.clearcoatRoughness ?? 0,
    sheen: f.sheen ?? 0,
    sheenRoughness: f.sheenRoughness ?? 1,
    sheenColor: new Color('#FFFFFF').lerp(tint, 0.5),
    envMapIntensity: f.envMapIntensity ?? 1,
  };
  if (clear) {
    if (transmissionEnabled) {
      Object.assign(params, {
        transmission: f.transmission,
        thickness: f.thickness ?? 0.05,
        ior: f.ior ?? 1.45,
        attenuationColor: tint,
        attenuationDistance: f.attenuationDistance ?? Infinity,
        iridescence: f.iridescence ?? 0,
        iridescenceIOR: 1.3,
      });
    } else {
      Object.assign(params, { color: tint, transparent: true, opacity: f.fallbackOpacity ?? 0.6, depthWrite: false });
    }
  }
  return new MeshPhysicalMaterial({ ...params, ...extra });
}

/** Body and trim materials for a collection's objects (tinted per object by instance colour or `color`). */
export function itemMaterials(category: CategoryId, color: ColorRepresentation = '#FFFFFF') {
  const spec = CATEGORY_SPECS[category];
  return {
    body: finish(spec.finish, color),
    detail: finish(spec.detailFinish, '#FFFFFF', { vertexColors: true }),
  };
}
