import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { useUiStore } from '@/store/useUiStore';

const COUNT = 16;

/**
 * Aero's reward for logging: a handful of glass bubbles rise from the log button and
 * pop softly near the top of the screen. Plays once per log, ~1.8 s, native driver.
 */
export default function BubbleBurst() {
  const celebrations = useUiStore((s) => s.celebrations);
  const [runs, setRuns] = useState<number[]>([]);
  useEffect(() => {
    if (!celebrations) return;
    setRuns((r) => [...r.slice(-2), celebrations]);
  }, [celebrations]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {runs.map((id) => (
        <Burst key={id} onDone={() => setRuns((r) => r.filter((x) => x !== id))} />
      ))}
    </View>
  );
}

function Burst({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const t = useRef(new Animated.Value(0)).current;
  const seeds = useRef(
    Array.from({ length: COUNT }, () => ({
      dx: (Math.random() - 0.5) * width * 0.9,
      rise: height * (0.35 + Math.random() * 0.45),
      size: 10 + Math.random() * 34,
      delay: Math.random() * 0.25,
    })),
  ).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 1800, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(onDone);
  }, [t, onDone]);
  return (
    <>
      {seeds.map((s, i) => {
        const local = t.interpolate({ inputRange: [0, s.delay, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: width / 2 - s.size / 2,
              top: height - 90,
              width: s.size,
              height: s.size,
              opacity: local.interpolate({ inputRange: [0, 0.1, 0.75, 1], outputRange: [0, 1, 0.9, 0] }),
              transform: [
                { translateX: local.interpolate({ inputRange: [0, 1], outputRange: [0, s.dx] }) },
                { translateY: local.interpolate({ inputRange: [0, 1], outputRange: [0, -s.rise] }) },
                { scale: local.interpolate({ inputRange: [0, 0.2, 0.9, 1], outputRange: [0.3, 1, 1, 1.35] }) },
              ],
            }}
          >
            <Svg width={s.size} height={s.size}>
              <Defs>
                <RadialGradient id={`bb${i}`} cx="0.5" cy="0.5" rx="0.5" ry="0.5">
                  <Stop offset="0.62" stopColor="#E9F8FF" stopOpacity={0.08} />
                  <Stop offset="0.92" stopColor="#FFFFFF" stopOpacity={0.6} />
                  <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.95} />
                </RadialGradient>
              </Defs>
              <Circle cx={s.size / 2} cy={s.size / 2} r={s.size / 2 - 0.5} fill={`url(#bb${i})`} />
              <Ellipse cx={s.size * 0.34} cy={s.size * 0.3} rx={s.size * 0.15} ry={s.size * 0.08} fill="#FFFFFF" opacity={0.9} />
            </Svg>
          </Animated.View>
        );
      })}
    </>
  );
}
