import { Icon as SparkIcon, addIcons } from '@/spark';
import { useTheme } from '@/constants/theme';

/**
 * Icons from the Spark UI kit's set (24×24, 2 px stroke, round caps), under the names the app uses.
 * The few the kit doesn't draw are registered with its own rules (`addIcons`).
 */
addIcons({
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  chart: '<path d="M3 3v18h18M7 16v-5M12 16V8M17 16V5"/>',
  library: '<path d="m16 6 4 14M12 6v14M8 8v12M4 4v16"/>',
});

/** App name → kit glyph. */
const ALIASES = {
  movies: 'film',
  series: 'tv',
  journal: 'book',
  play: 'play',
  pause: 'pause',
  download: 'download',
  upload: 'upload',
  key: 'key',
  globe: 'globe',
  eye: 'eye',
  clock: 'clock',
  home: 'home',
  more: 'more',
  window: 'monitor',
  plus: 'plus',
  close: 'x',
  back: 'chevronLeft',
  settings: 'settings',
  search: 'search',
  library: 'library',
  trash: 'trash',
  check: 'check',
  minus: 'minus',
  sparkle: 'sparkles',
  grid: 'grid',
  chart: 'chart',
  refresh: 'refresh',
  calendar: 'calendar',
  bell: 'bell',
  user: 'user',
  undo: 'undo',
  chevronRight: 'chevronRight',
  star: 'star',
  starFill: 'star',
  link: 'link',
  gamepad: 'gamepad',
  share: 'share',
  palette: 'palette',
  heart: 'heart',
  edit: 'edit',
  info: 'info',
  warning: 'warning',
  sort: 'sort',
  filter: 'filter',
  bookmark: 'bookmark',
  external: 'external',
} as const;

export type IconName = keyof typeof ALIASES;

/** The kit glyph behind an app icon name (for kit components that take a glyph). */
export const glyph = (name: IconName): string => ALIASES[name] ?? name;

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export default function Icon({ name, size = 22, color, strokeWidth = 1.9 }: Props) {
  const { palette } = useTheme();
  return <SparkIcon name={glyph(name)} size={size} color={color ?? palette.ink} strokeWidth={strokeWidth} filled={name === 'starFill'} />;
}
