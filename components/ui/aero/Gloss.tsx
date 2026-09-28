import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

let uid = 0;
const nextId = () => `aero${++uid}`;

/**
 * The Frutiger Aero sheen: a bright specular band across the top half of a surface
 * that fades out before the middle, like light on a glass bead. Purely decorative,
 * pointer-transparent, drawn over any rounded surface (the parent clips it).
 */
export function Sheen({ strength = 0.7, height = 0.52 }: { strength?: number; height?: number }) {
  const id = nextId();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={strength} />
            <Stop offset={String(height * 0.9)} stopColor="#FFFFFF" stopOpacity={strength * 0.18} />
            <Stop offset={String(height)} stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** Aqua (or any two-stop) gel: vertical gradient, top sheen, soft inner glow at the base. */
export function Gel({ from, to, glow = true }: { from: string; to: string; glow?: boolean }) {
  const id = nextId();
  const glowId = nextId();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
          <RadialGradient id={glowId} cx="0.5" cy="1.05" rx="0.6" ry="0.55">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.45} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
        {glow && <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${glowId})`} />}
      </Svg>
      <Sheen strength={0.62} height={0.5} />
    </View>
  );
}
