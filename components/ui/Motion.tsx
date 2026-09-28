import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutAnimation, Platform, StyleProp, UIManager, View, ViewStyle } from 'react-native';

import { useTheme } from '@/constants/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Smoothly animate the next layout change (list insertions, removals, reflows). */
export function animateLayout(duration = 260) {
  LayoutAnimation.configureNext({
    duration,
    create: { type: 'easeInEaseOut', property: 'opacity' },
    update: { type: 'spring', springDamping: 0.82 },
    delete: { type: 'easeInEaseOut', property: 'opacity' },
  });
}

/**
 * Enters with a short rise and fade, staggered by `index`. Staggering tells the eye
 * where to start reading and makes lists feel assembled rather than dumped.
 */
export function FadeIn({
  children,
  index = 0,
  style,
  distance = 14,
  delay = 0,
}: {
  children: ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
  distance?: number;
  delay?: number;
}) {
  const { motion } = useTheme();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(t, {
      toValue: 1,
      delay: delay + Math.min(index, 12) * motion.stagger,
      useNativeDriver: true,
      damping: 20,
      stiffness: 190,
      mass: 0.9,
    }).start();
  }, [t, index, delay, motion.stagger]);
  return (
    <Animated.View
      style={[style, { opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] }]}
    >
      {children}
    </Animated.View>
  );
}

/** Number that counts up to its value: small rewards feel earned when you watch them grow. */
export function useCountUp(value: number, duration = 700) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const t0 = Date.now();
    let raf = 0;
    const step = () => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(start + (value - start) * e);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return shown;
}

/** Springy pop whenever `trigger` changes (ratings, counters, checkmarks). */
export function Pop({ trigger, children, style }: { trigger: unknown; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    s.setValue(0.7);
    Animated.spring(s, { toValue: 1, useNativeDriver: true, damping: 8, stiffness: 320 }).start();
  }, [trigger, s]);
  return <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>;
}

/** Placeholder with a gentle breathing shimmer while results load (perceived speed). */
export function Skeleton({ width, height, radius = 8, style }: { width: number | `${number}%`; height: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const { palette } = useTheme();
  const o = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(o, { toValue: 0.5, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [o]);
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: palette.fieldActive, opacity: o }, style]} />;
}

/** A row of skeletons shaped like a search result. */
export function ResultSkeleton() {
  return (
    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 8 }}>
      <Skeleton width={48} height={72} radius={6} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="70%" height={14} />
        <Skeleton width="45%" height={11} />
      </View>
    </View>
  );
}
