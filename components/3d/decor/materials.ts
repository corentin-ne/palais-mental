/**
 * Materials shared by every piece of decor, created once from config/decor. They live as
 * long as the app, so pieces never dispose them.
 */
import { Color, DoubleSide, MeshBasicMaterial, MeshStandardMaterial } from 'three';

import { DECOR_COLORS as C } from '@/config/decor';
import { finish } from '@/lib/finishes';
import { withSurface } from '@/lib/materialPatches';

let cache: ReturnType<typeof build> | null = null;

function build() {
  const glow = (hex: string, k: number) => new MeshBasicMaterial({ color: new Color(hex).multiplyScalar(k), toneMapped: false });
  return {
    oak: withSurface(finish('clay', C.oak), 'wood'),
    oakY: withSurface(finish('clay', C.oak), 'wood', { axis: 'y' }),
    lacquer: withSurface(finish('satin', C.lacquer), 'plaster', { strength: 0.5 }),
    brass: finish('metal', C.brass),
    boucle: withSurface(finish('clay', C.boucle), 'boucle'),
    painted: finish('satin', '#FFFFFF', { vertexColors: true }),
    glossyPainted: finish('glossy', '#FFFFFF', { vertexColors: true }),
    // Lamp shade and lantern: frosted, lit from inside.
    linenShade: withSurface(finish('frosted', C.linen, { side: DoubleSide, emissive: C.lampGlow, emissiveIntensity: 0.7 }), 'linen'),
    curtain: withSurface(
      new MeshStandardMaterial({ color: C.curtain, roughness: 1, side: DoubleSide, transparent: true, opacity: 0.86, emissive: '#FFE3BF', emissiveIntensity: 0.14, depthWrite: false }),
      'linen',
    ),
    skirting: withSurface(finish('clay', C.oak, { side: DoubleSide }), 'wood', { axis: 'y', strength: 0.5 }),
    ceramic: finish('glossy', C.ceramic),
    glass: finish('glass', C.glass),
    glassTable: finish('frosted', C.glass),
    driedStem: finish('clay', C.driedStem),
    pampas: withSurface(finish('clay', C.pampas), 'boucle', { strength: 0.6 }),
    paper: withSurface(finish('frosted', C.paper, { emissive: C.lanternGlow, emissiveIntensity: 1.1 }), 'paper'),
    cord: finish('clay', C.cord),
    frame: withSurface(finish('clay', C.frame), 'wood', { axis: 'y' }),
    pot: finish('glossy', C.pot),
    leaf: finish('satin', C.leaf, { side: DoubleSide }),
    stem: finish('satin', C.stem),
    charcoal: finish('glossy', C.charcoal),
    grill: withSurface(finish('clay', C.charcoal), 'linen', { strength: 1.4 }),
    silver: finish('metal', C.silver, { roughness: 0.32, metalness: 0.6 }),
    wax: finish('clay', '#FBF6EE'),
    flame: glow('#FFD9A0', 1),
    bulb: glow(C.bulb, 2.2),
    display: glow(C.display, 1.3),
  };
}

export function decorMaterials() {
  cache ??= build();
  return cache;
}
