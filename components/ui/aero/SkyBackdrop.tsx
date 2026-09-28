import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

const BUBBLES = [
  { x: 0.12, size: 46, dur: 26000, delay: 0 },
  { x: 0.78, size: 72, dur: 34000, delay: 6000 },
  { x: 0.44, size: 22, dur: 21000, delay: 3000 },
  { x: 0.9, size: 30, dur: 24000, delay: 14000 },
  { x: 0.28, size: 58, dur: 31000, delay: 19000 },
  { x: 0.62, size: 16, dur: 18000, delay: 9000 },
  { x: 0.05, size: 26, dur: 23000, delay: 12000 },
];

/**
 * The Aero world behind every screen: a clear morning sky, two aurora veils, a soft
 * white light-wave, and a few glass bubbles drifting upward. Everything is vector and
 * GPU-composited (native-driver transforms), so it costs next to nothing.
 */
function SkyBackdrop() {
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#3FA9EA" />
            <Stop offset="0.38" stopColor="#8FD2F5" />
            <Stop offset="0.72" stopColor="#DDF3FC" />
            <Stop offset="1" stopColor="#F2FBF4" />
          </LinearGradient>
          <RadialGradient id="auroraA" cx="0.5" cy="0.5" rx="0.5" ry="0.5">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="auroraB" cx="0.5" cy="0.5" rx="0.5" ry="0.5">
            <Stop offset="0" stopColor="#9BE7C4" stopOpacity={0.5} />
            <Stop offset="1" stopColor="#9BE7C4" stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="wave" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0.75} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={`M0 0H${width}V${height}H0Z`} fill="url(#sky)" />
        <Ellipse cx={width * 0.18} cy={height * 0.12} rx={width * 0.7} ry={height * 0.16} fill="url(#auroraA)" />
        <Ellipse cx={width * 0.95} cy={height * 0.62} rx={width * 0.6} ry={height * 0.22} fill="url(#auroraB)" />
        {/* The light-wave: two thin swooshes crossing the lower third */}
        <Path
          d={`M${-width * 0.1} ${height * 0.7} C ${width * 0.3} ${height * 0.58}, ${width * 0.6} ${height * 0.82}, ${width * 1.1} ${height * 0.64} L ${width * 1.1} ${height * 0.67} C ${width * 0.6} ${height * 0.86}, ${width * 0.3} ${height * 0.62}, ${-width * 0.1} ${height * 0.73} Z`}
          fill="url(#wave)"
        />
        <Path
          d={`M${-width * 0.1} ${height * 0.78} C ${width * 0.35} ${height * 0.7}, ${width * 0.65} ${height * 0.9}, ${width * 1.1} ${height * 0.74} L ${width * 1.1} ${height * 0.755} C ${width * 0.65} ${height * 0.92}, ${width * 0.35} ${height * 0.72}, ${-width * 0.1} ${height * 0.795} Z`}
          fill="url(#wave)"
          opacity={0.6}
        />
      </Svg>
      {BUBBLES.map((b, i) => (
        <Bubble key={i} x={b.x * width} size={b.size} duration={b.dur} delay={b.delay} height={height} />
      ))}
    </View>
  );
}

const Bubble = memo(function Bubble({ x, size, duration, delay, height }: { x: number; size: number; duration: number; delay: number; height: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, duration, delay]);
  const style = useMemo(
    () => ({
      position: 'absolute' as const,
      left: x - size / 2,
      top: 0,
      width: size,
      height: size,
      opacity: t.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 0.9, 0.9, 0] }),
      transform: [
        { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [height + size, -size] }) },
        { translateX: t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, 10, 0, -10, 0] }) },
      ],
    }),
    [t, x, size, height],
  );
  return (
    <Animated.View style={style}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="bubble" cx="0.5" cy="0.5" rx="0.5" ry="0.5">
            <Stop offset="0.7" stopColor="#FFFFFF" stopOpacity={0.04} />
            <Stop offset="0.93" stopColor="#FFFFFF" stopOpacity={0.5} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.85} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2 - 0.5} fill="url(#bubble)" />
        <Ellipse cx={size * 0.34} cy={size * 0.28} rx={size * 0.16} ry={size * 0.09} fill="#FFFFFF" opacity={0.8} transform={`rotate(-35 ${size * 0.34} ${size * 0.28})`} />
      </Svg>
    </Animated.View>
  );
});

export default memo(SkyBackdrop);
