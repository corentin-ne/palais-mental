import { useWindowDimensions } from 'react-native';

/** Responsive metrics shared by every screen: a centred column on wide screens, poster grids that fill it. */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const wide = width >= 768;
  const gutter = wide ? 32 : 20;
  const content = Math.min(width, 1120);
  const inner = content - gutter * 2;
  const gap = wide ? 18 : 12;
  const minPoster = wide ? 150 : 100;
  const columns = Math.max(3, Math.min(8, Math.floor((inner + gap) / (minPoster + gap))));
  const poster = Math.floor((inner - gap * (columns - 1)) / columns);
  return { width, height, wide, gutter, content, inner, gap, columns, poster, railPoster: wide ? 150 : 112 };
}
