/**
 * Materials shared by every piece of decor, created once from config/decor. They live as
 * long as the app, so pieces never dispose them.
 */
import { Color, DoubleSide, MeshBasicMaterial, MeshStandardMaterial } from 'three';

import { DECOR_COLORS as C } from '@/config/decor';
import { withSurface } from '@/lib/materialPatches';

let cache: ReturnType<typeof build> | null = null;

function build() {
  const std = (color: string, roughness: number, extra: ConstructorParameters<typeof MeshStandardMaterial>[0] = {}) =>
    new MeshStandardMaterial({ color, roughness, ...extra });
  return {
    oak: withSurface(std(C.oak, 0.5), 'wood'),
    oakY: withSurface(std(C.oak, 0.5), 'wood', { axis: 'y' }),
    lacquer: withSurface(std(C.lacquer, 0.32, { envMapIntensity: 1.1 }), 'plaster', { strength: 0.6 }),
    brass: std(C.brass, 0.3, { metalness: 0.9 }),
    boucle: withSurface(std(C.boucle, 1), 'boucle'),
    painted: std('#FFFFFF', 0.75, { vertexColors: true }),
    linenShade: withSurface(std(C.linen, 0.9, { side: DoubleSide, emissive: C.lampGlow, emissiveIntensity: 0.55 }), 'linen'),
    curtain: withSurface(
      std(C.curtain, 1, { side: DoubleSide, transparent: true, opacity: 0.9, emissive: '#FFE3BF', emissiveIntensity: 0.12, depthWrite: false }),
      'linen',
    ),
    skirting: withSurface(std(C.oak, 0.55, { side: DoubleSide }), 'wood', { axis: 'y', strength: 0.5 }),
    ceramic: std(C.ceramic, 0.35),
    driedStem: std(C.driedStem, 0.8),
    pampas: withSurface(std(C.pampas, 1), 'boucle', { strength: 0.6 }),
    paper: withSurface(std(C.paper, 0.9, { emissive: C.lanternGlow, emissiveIntensity: 0.9 }), 'paper'),
    cord: std(C.cord, 0.8),
    frame: withSurface(std(C.frame, 0.5), 'wood', { axis: 'y' }),
    pot: withSurface(std(C.pot, 0.6), 'plaster'),
    leaf: std(C.leaf, 0.55, { side: DoubleSide }),
    stem: std(C.stem, 0.7),
    charcoal: std(C.charcoal, 0.4),
    grill: withSurface(std(C.charcoal, 0.95), 'linen', { strength: 1.4 }),
    silver: std(C.silver, 0.35, { metalness: 0.55 }),
    bulb: new MeshBasicMaterial({ color: new Color(C.bulb).multiplyScalar(2.2), toneMapped: false }),
    display: new MeshBasicMaterial({ color: new Color(C.display).multiplyScalar(1.3), toneMapped: false }),
  };
}

export function decorMaterials() {
  cache ??= build();
  return cache;
}
