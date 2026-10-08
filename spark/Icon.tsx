/**
 * Spark UI kit · native/Icon.tsx
 * The kit's icon set (24×24, 2 px stroke, round caps) drawn with react-native-svg from the same markup as
 * the web (`icons.generated.ts`). `addIcons()` registers app glyphs with the same drawing rules.
 * Decorative by default; pass `label` for a meaningful standalone icon.
 */
import { memo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

import { PATHS } from './icons.generated';
import { useSpark } from './theme';

type Shape = { tag: string; attrs: Record<string, string> };

const registry: Record<string, string> = { ...PATHS };
const parsed = new Map<string, Shape[]>();

/** Registers extra glyphs: inner SVG markup in a 24×24 box (stroke = currentColor). */
export function addIcons(paths: Record<string, string>) {
  Object.assign(registry, paths);
  for (const k of Object.keys(paths)) parsed.delete(k);
}
export const iconNames = () => Object.keys(registry);
export const hasIcon = (name: string) => name in registry;

function shapes(name: string): Shape[] {
  let s = parsed.get(name);
  if (s) return s;
  const markup = registry[name] ?? registry.info;
  s = [...markup.matchAll(/<(\w+)([^>]*?)\/?>/g)].map(([, tag, raw]) => ({
    tag,
    attrs: Object.fromEntries([...raw.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v])),
  }));
  parsed.set(name, s);
  return s;
}

const num = (v?: string) => (v == null ? undefined : Number(v));

export interface IconProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  /** Filled glyph (a starred rating, a selected heart): the shape takes the colour too. */
  filled?: boolean;
  label?: string;
}

export const Icon = memo(function Icon({ name, size = 20, color, strokeWidth = 2, filled, label }: IconProps) {
  const t = useSpark();
  const c = color ?? t.color.textPrimary;
  const common = { stroke: c, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: filled ? c : 'none' };
  // The View carries the accessibility (the Svg would pass it on to the DOM on the web) and makes the glyph a
  // positioned box, so it paints above absolutely placed fills (gradients, tiles) on the web too.
  return (
    <View
      style={{ width: size, height: size }}
      accessible={!!label}
      accessibilityLabel={label}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {shapes(name).map(({ tag, attrs: a }, i) => {
          switch (tag) {
            case 'path':
              return <Path key={i} d={a.d} {...common} />;
            case 'circle':
              return <Circle key={i} cx={num(a.cx)} cy={num(a.cy)} r={num(a.r)} {...common} />;
            case 'rect':
              return <Rect key={i} x={num(a.x)} y={num(a.y)} width={num(a.width)} height={num(a.height)} rx={num(a.rx)} ry={num(a.ry ?? a.rx)} {...common} />;
            case 'line':
              return <Line key={i} x1={num(a.x1)} y1={num(a.y1)} x2={num(a.x2)} y2={num(a.y2)} {...common} />;
            case 'polyline':
              return <Polyline key={i} points={a.points} {...common} />;
            case 'polygon':
              return <Polygon key={i} points={a.points} {...common} />;
            default:
              return null;
          }
        })}
      </Svg>
    </View>
  );
});
