/**
 * Dominant colour of a cover, so each object on the shelf wears its artwork's colour.
 * The image is drawn tiny onto a canvas and its pixels are averaged, weighted toward
 * saturated pixels (a poster's white border should not win over its red title). The
 * result is kept within a lightness band so objects stay readable against the room.
 *
 * Needs a DOM canvas and a CORS-enabled image; elsewhere (native, or a server without
 * CORS headers) it resolves to undefined and the collection palette is used instead.
 */
const SIZE = 24;

export function averageColor(data: ArrayLike<number>): string | undefined {
  let r = 0;
  let g = 0;
  let b = 0;
  let wsum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    if (a < 0.5) continue;
    const pr = data[i] / 255;
    const pg = data[i + 1] / 255;
    const pb = data[i + 2] / 255;
    const max = Math.max(pr, pg, pb);
    const min = Math.min(pr, pg, pb);
    const sat = max === 0 ? 0 : (max - min) / max;
    const w = 0.15 + sat * sat;
    r += pr * w;
    g += pg * w;
    b += pb * w;
    wsum += w;
  }
  if (!wsum) return undefined;
  return clampLightness(r / wsum, g / wsum, b / wsum);
}

/** Keep lightness in [0.22, 0.72] (HSL) without changing hue or saturation. */
function clampLightness(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const target = Math.min(0.72, Math.max(0.22, l));
  const k = l > 0 ? target / l : 1;
  const mix = (c: number) => Math.min(1, l > target ? c * k : c + (target - l) * (1 - c) / Math.max(1e-3, 1 - l));
  const hex = (c: number) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0');
  return `#${hex(mix(r))}${hex(mix(g))}${hex(mix(b))}`;
}

export function extractCoverColor(url: string): Promise<string | undefined> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(undefined);
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        resolve(averageColor(ctx.getImageData(0, 0, SIZE, SIZE).data));
      } catch {
        resolve(undefined); // tainted canvas: the server sent no CORS headers
      }
    };
    img.onerror = () => resolve(undefined);
    img.src = url;
  });
}
