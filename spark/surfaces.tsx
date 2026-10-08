/**
 * Spark UI kit · native/surfaces.tsx
 * The three depths of §1 on a phone: the aurora backdrop, glass panels, and the press feedback every
 * control shares.
 *
 * Phone rule for glass (§2.4 adapted): **blur only floating layers** (tab bar, top bar, sheets, toasts).
 * Cards inside a scrolling screen are translucent glass without blur: the aurora behind them is soft
 * already, and one blur per card would cost a GPU pass per card on every scroll frame.
 */
import { ReactNode, memo, useRef } from 'react';
import { Animated, Platform, Pressable, PressableProps, StyleProp, StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { sparkStyles, useSpark } from './theme';

// ------------------------------------------------------------------ Aurora
/**
 * The colour backdrop the glass refracts (base.css `body::before`): four soft radial washes of the accent
 * family on the theme background. Static (no animation, no filter); place it first, absolutely filled.
 */
export const Aurora = memo(function Aurora({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useSpark();
  const { width, height } = useWindowDimensions();
  const [a1, a2, a3] = t.color.aurora;
  // The web's ellipses (900×640 px on a ~1440×900 window) as fractions of the screen, so a phone in
  // portrait keeps the same composition: top-left accent, top-right companion, a wash at the bottom.
  const washes = [
    { id: 'a1', c: a1, x: 0.08, y: 0, rx: 1.1, ry: 0.55 },
    { id: 'a2', c: a2, x: 0.98, y: 0.08, rx: 0.95, ry: 0.5 },
    { id: 'a3', c: a3, x: 0.62, y: 1.06, rx: 1.15, ry: 0.6 },
    { id: 'a4', c: a2, x: 0.3, y: 0.7, rx: 0.75, ry: 0.4, o: 0.45 },
  ];
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.color.bg }, style]}>
      <Svg width={width} height={height}>
        <Defs>
          {washes.map((w) => (
            <RadialGradient key={w.id} id={w.id} cx={w.x * width} cy={w.y * height} rx={w.rx * width} ry={w.ry * height} fx={w.x * width} fy={w.y * height} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={w.c} stopOpacity={w.o ?? 1} />
              <Stop offset="0.62" stopColor={w.c} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {washes.map((w) => (
          <Rect key={w.id} x={0} y={0} width={width} height={height} fill={`url(#${w.id})`} />
        ))}
      </Svg>
    </View>
  );
});

// ------------------------------------------------------------------ Glass
export interface GlassProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** `strong`: modals, toasts, sheets (--glass-strong); `subtle`: fields and chips inside cards. */
  tone?: 'default' | 'strong' | 'subtle';
  /** Blur what is behind: floating layers only (see the phone rule above). Off in lite rendering. */
  blur?: boolean;
  /** The 1 px light line along the top edge (`--glass-highlight`). On by default. */
  highlight?: boolean;
  /** Raised: the glass shadow (`--glass-shadow`); `lg` for floating layers. */
  elevated?: boolean | 'lg';
  radius?: number;
}

export function Glass({ children, style, tone = 'default', blur, highlight = true, elevated, radius }: GlassProps) {
  const t = useSpark();
  const s = useGlassStyles();
  const fill = tone === 'strong' ? t.color.glassStrong : tone === 'subtle' ? t.color.glassSubtle : t.color.glass;
  const blurred = blur && !t.lite && t.blur.intensity > 0;
  const r = radius ?? t.radius.lg;
  // The panel itself carries the layout (padding, gap…), the border and the shadow; the blur and the
  // fill sit under the children, clipped to the corners.
  return (
    <View style={[s.panel, { borderRadius: r, backgroundColor: blurred ? 'transparent' : fill }, elevated && (elevated === 'lg' ? t.shadow.glassLg : t.shadow.glass), style]}>
      {blurred && (
        <View style={[StyleSheet.absoluteFill, { borderRadius: r, overflow: 'hidden' }]} pointerEvents="none">
          <BlurView
            intensity={tone === 'strong' ? t.blur.strong : t.blur.intensity}
            tint={t.blur.tint}
            // Android blurs only through this method; without it the fill alone shows.
            experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
        </View>
      )}
      {highlight && <View pointerEvents="none" style={[s.highlight, { left: r * 0.6, right: r * 0.6 }]} />}
      {children}
    </View>
  );
}

const useGlassStyles = sparkStyles((t) => ({
  panel: { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: t.color.glassBorder },
  highlight: { position: 'absolute', top: 0, height: StyleSheet.hairlineWidth * 2, backgroundColor: t.color.glassHighlight },
}));

// ------------------------------------------------------------------ Press
export interface PressProps extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Scale under the finger: 0.97 for controls (default), 0.98–0.99 for large surfaces, 1 for none. */
  depth?: number;
}

/**
 * Press feedback (motion §2.8): a spring down to `depth` and back, composited (transform only).
 */
/** One element carries the layout (flex, width, margins) and the scale, so a pressable lays out like a View. */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Press({ children, style, depth, disabled, ...rest }: PressProps) {
  const t = useSpark();
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, ...t.motion.spring }).start();
  const d = t.reduceMotion ? 1 : (depth ?? t.motion.pressScale);
  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={6}
      {...rest}
      onPressIn={(e) => {
        to(d);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1);
        rest.onPressOut?.(e);
      }}
      style={[style, { transform: [{ scale }] }, disabled && { opacity: 0.45 }]}
    >
      {children}
    </AnimatedPressable>
  );
}
