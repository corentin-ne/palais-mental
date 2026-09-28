import { useRef } from 'react';

let counter = 0;

/**
 * Stable, document-unique id for SVG gradients. On web every `url(#id)` resolves
 * against the whole document, so two components sharing an id (e.g. the same cover
 * drawn in a hidden tab) would make one of them lose its gradient.
 */
export function useSvgId(prefix: string) {
  const ref = useRef<string | null>(null);
  if (ref.current === null) ref.current = `${prefix}${++counter}`;
  return ref.current;
}
