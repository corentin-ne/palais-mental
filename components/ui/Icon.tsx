import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/constants/theme';

export type IconName =
  | 'movies'
  | 'series'
  | 'play'
  | 'pause'
  | 'download'
  | 'upload'
  | 'key'
  | 'globe'
  | 'eye'
  | 'clock'
  | 'home'
  | 'more'
  | 'window'
  | 'plus'
  | 'close'
  | 'back'
  | 'settings'
  | 'search'
  | 'library'
  | 'trash'
  | 'check'
  | 'minus'
  | 'sparkle'
  | 'journal'
  | 'grid'
  | 'chart'
  | 'refresh'
  | 'calendar'
  | 'bell'
  | 'user'
  | 'undo'
  | 'chevronRight'
  | 'star'
  | 'starFill'
  | 'link';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** Hand-drawn 24px line icons: round caps and joins, one stroke weight. */
export default function Icon({ name, size = 22, color: colorProp, strokeWidth = 1.7 }: Props) {
  const theme = useTheme();
  const color = colorProp ?? theme.palette.ink;
  const s = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {renderIcon(name, s, color)}
    </Svg>
  );
}

function renderIcon(name: IconName, s: object, color: string) {
  switch (name) {
    case 'movies':
      return (
        <>
          <Path {...s} d="M4 10h16v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18z" />
          <Path {...s} d="M4 10l-.6-2.4a2 2 0 0 1 1.4-2.4l11.6-3a2 2 0 0 1 2.4 1.4L19.4 6" />
          <Path {...s} d="M8.6 4.4l1.8 3.4M13.4 3.2l1.8 3.4" />
        </>
      );
    case 'series':
      return (
        <>
          <Rect {...s} x={3} y={6.5} width={18} height={13} rx={3.2} />
          <Path {...s} d="M8.5 3l3.5 3.5L15.5 3" />
          <Path {...s} d="M10.2 10.6v4.8l4-2.4z" />
        </>
      );
    case 'window':
      return (
        <>
          <Path {...s} d="M5.5 20.5V10a6.5 6.5 0 0 1 13 0v10.5z" />
          <Path {...s} d="M12 3.5v17M5.5 12.5h13" />
        </>
      );
    case 'play':
      return <Path {...s} d="M8 5.5v13l10.5-6.5z" />;
    case 'pause':
      return <Path {...s} d="M9 5.5v13M15 5.5v13" />;
    case 'download':
      return <Path {...s} d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" />;
    case 'upload':
      return <Path {...s} d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14" />;
    case 'key':
      return (
        <>
          <Circle {...s} cx={8} cy={15} r={4} />
          <Path {...s} d="M11 12l8.5-8.5M16.5 6.5l2.5 2.5M14.5 8.5l2 2" />
        </>
      );
    case 'globe':
      return (
        <>
          <Circle {...s} cx={12} cy={12} r={8.5} />
          <Path {...s} d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5s1.1-6.1 3.5-8.5z" />
        </>
      );
    case 'eye':
      return (
        <>
          <Path {...s} d="M2.8 12S6.2 5.5 12 5.5 21.2 12 21.2 12 17.8 18.5 12 18.5 2.8 12 2.8 12z" />
          <Circle {...s} cx={12} cy={12} r={2.8} />
        </>
      );
    case 'clock':
      return (
        <>
          <Circle {...s} cx={12} cy={12} r={8.5} />
          <Path {...s} d="M12 7.5V12l3 2" />
        </>
      );
    case 'home':
      return <Path {...s} d="M4.5 10.5L12 4l7.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-3.5v-6h-5v6H6A1.5 1.5 0 0 1 4.5 19z" />;
    case 'more':
      return (
        <>
          <Circle cx={6} cy={12} r={1.5} fill={color} />
          <Circle cx={12} cy={12} r={1.5} fill={color} />
          <Circle cx={18} cy={12} r={1.5} fill={color} />
        </>
      );
    case 'plus':
      return <Path {...s} d="M12 5v14M5 12h14" />;
    case 'minus':
      return <Path {...s} d="M5 12h14" />;
    case 'close':
      return <Path {...s} d="M6.5 6.5l11 11M17.5 6.5l-11 11" />;
    case 'back':
      return <Path {...s} d="M14.5 5.5L8 12l6.5 6.5" />;
    case 'check':
      return <Path {...s} d="M5 12.5l4.5 4.5L19 7.5" />;
    case 'settings':
      return (
        <>
          <Path {...s} d="M4 7.5h9M18.5 7.5H20M4 16.5h2.5M12 16.5h8" />
          <Circle {...s} cx={15.8} cy={7.5} r={2.4} />
          <Circle {...s} cx={9.2} cy={16.5} r={2.4} />
        </>
      );
    case 'search':
      return (
        <>
          <Circle {...s} cx={10.8} cy={10.8} r={6.3} />
          <Path {...s} d="M15.6 15.6L20 20" />
        </>
      );
    case 'library':
      return (
        <>
          <Rect {...s} x={4} y={4.5} width={4} height={15} rx={1.4} />
          <Rect {...s} x={10} y={4.5} width={4} height={15} rx={1.4} />
          <Path {...s} d="M16 6.4l2.9-.9 3.1 13.3-2.9.9z" />
        </>
      );
    case 'trash':
      return (
        <>
          <Path {...s} d="M4.5 7h15M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7" />
          <Path {...s} d="M6.5 7l.8 11.3A2 2 0 0 0 9.3 20h5.4a2 2 0 0 0 2-1.7L17.5 7" />
        </>
      );
    case 'journal':
      return (
        <>
          <Path {...s} d="M6 3.5h11a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6z" />
          <Path {...s} d="M6 3.5v17M9.5 8h6M9.5 11.5h4" />
        </>
      );
    case 'grid':
      return (
        <>
          <Rect {...s} x={4} y={4} width={6.5} height={7.5} rx={1.8} />
          <Rect {...s} x={13.5} y={4} width={6.5} height={7.5} rx={1.8} />
          <Rect {...s} x={4} y={14.5} width={6.5} height={5.5} rx={1.8} />
          <Rect {...s} x={13.5} y={14.5} width={6.5} height={5.5} rx={1.8} />
        </>
      );
    case 'chart':
      return <Path {...s} d="M5 20v-6M10 20V9M15 20v-8M20 20V4" />;
    case 'refresh':
      return (
        <>
          <Path {...s} d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
          <Path {...s} d="M19.5 4.5v3.8h-3.8" />
        </>
      );
    case 'calendar':
      return (
        <>
          <Rect {...s} x={4} y={5.5} width={16} height={14.5} rx={3} />
          <Path {...s} d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
        </>
      );
    case 'star':
      return <Path {...s} d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />;
    case 'starFill':
      return <Path {...s} fill={color} d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />;
    case 'link':
      return (
        <>
          <Path {...s} d="M10 14a4.2 4.2 0 0 0 6 0l3-3a4.2 4.2 0 0 0-6-6l-1 1" />
          <Path {...s} d="M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.2 4.2 0 0 0 6 6l1-1" />
        </>
      );
    case 'bell':
      return (
        <>
          <Path {...s} d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14z" />
          <Path {...s} d="M10 20.5a2 2 0 0 0 4 0" />
        </>
      );
    case 'user':
      return (
        <>
          <Circle {...s} cx={12} cy={8.5} r={3.8} />
          <Path {...s} d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
        </>
      );
    case 'undo':
      return (
        <>
          <Path {...s} d="M9 7.5L4.5 12 9 16.5" />
          <Path {...s} d="M4.5 12H15a4.5 4.5 0 0 1 0 9h-2" />
        </>
      );
    case 'chevronRight':
      return <Path {...s} d="M9.5 5.5L16 12l-6.5 6.5" />;
    case 'sparkle':
      return <Path {...s} d="M12 3.5l1.9 5.6 5.6 1.9-5.6 1.9L12 18.5l-1.9-5.6L4.5 11l5.6-1.9z" />;
  }
}
