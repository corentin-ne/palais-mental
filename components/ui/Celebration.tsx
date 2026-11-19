import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';

import { makeStyles, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { Glass } from '@/spark';
import { Celebration as Model, useUi } from '@/store/useUi';

const PIECES = 34;
const BURST = 1700;
const SHOWN = 2900;

/** One piece of confetti: where it flies, how it turns, its shape. Fixed per burst. */
interface Piece {
  dx: number;
  rise: number;
  fall: number;
  spin: number;
  delay: number;
  w: number;
  h: number;
  color: string;
}

/**
 * A short burst of confetti in the accent family behind a glass card: a series, a book or a game finished,
 * a goal reached. Taps through to dismiss; with reduced motion the card simply fades in and out.
 */
export default function Celebration() {
  const celebration = useUi((s) => s.celebration);
  const end = useUi((s) => s.endCelebration);
  const [shown, setShown] = useState<Model | null>(null);
  const haptics = useHaptics();

  useEffect(() => {
    if (!celebration) return;
    setShown(celebration);
    haptics.success();
    const timer = setTimeout(end, SHOWN);
    return () => clearTimeout(timer);
  }, [celebration, end, haptics]);

  if (!shown) return null;
  return <Burst key={shown.id} model={shown} leaving={!celebration} onGone={() => setShown(null)} onDismiss={end} />;
}

function Burst({ model, leaving, onGone, onDismiss }: { model: Model; leaving: boolean; onGone: () => void; onDismiss: () => void }) {
  const { palette, spark, motion } = useTheme();
  const styles = useStyles();
  const { width, height } = useWindowDimensions();
  const fly = useRef(new Animated.Value(0)).current;
  const card = useRef(new Animated.Value(0)).current;
  const still = spark.reduceMotion;

  const pieces = useMemo<Piece[]>(() => {
    const colors = [palette.primary, palette.accent2, spark.color.accent3, palette.success, palette.warning, '#ffffff'];
    return Array.from({ length: still ? 0 : PIECES }, (_, i) => {
      const angle = (i / PIECES) * Math.PI * 2 + Math.random() * 0.4;
      const power = 0.35 + Math.random() * 0.65;
      return {
        dx: Math.cos(angle) * width * 0.48 * power,
        rise: -(Math.abs(Math.sin(angle)) * height * 0.22 * power + 40),
        fall: height * (0.28 + Math.random() * 0.25),
        spin: (Math.random() - 0.5) * 1440,
        delay: Math.random() * 0.12,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 10,
        color: colors[i % colors.length],
      };
    });
  }, [palette, spark, width, height, still]);

  useEffect(() => {
    Animated.spring(card, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 200 }).start();
    if (!still) Animated.timing(fly, { toValue: 1, duration: BURST, easing: Easing.linear, useNativeDriver: true }).start();
  }, [card, fly, still]);

  useEffect(() => {
    if (leaving) Animated.timing(card, { toValue: 0, duration: motion.base, useNativeDriver: true }).start(onGone);
  }, [leaving, card, motion.base, onGone]);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: palette.dimVeil, opacity: card.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }) }]} />
      {pieces.map((p, i) => {
        // A throw: up and out fast, then gravity. The curve is sampled, the native driver follows it.
        const t = (x: number) => p.delay + x * (1 - p.delay);
        const input = [0, t(0), t(0.25), t(0.5), t(0.75), t(1)];
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: width / 2 - p.w / 2,
              top: height * 0.42,
              width: p.w,
              height: p.h,
              borderRadius: 2,
              backgroundColor: p.color,
              opacity: fly.interpolate({ inputRange: [0, t(0), t(0.7), 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateX: fly.interpolate({ inputRange: input, outputRange: [0, 0, p.dx * 0.55, p.dx * 0.85, p.dx * 0.97, p.dx] }) },
                { translateY: fly.interpolate({ inputRange: input, outputRange: [0, 0, p.rise, p.rise * 0.6 + p.fall * 0.15, p.fall * 0.55, p.fall] }) },
                { rotate: fly.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
              ],
            }}
          />
        );
      })}
      <Pressable onPress={onDismiss} style={styles.center} accessibilityRole="alert" accessibilityLabel={[model.title, model.detail].filter(Boolean).join('. ')}>
        <Animated.View style={{ opacity: card, transform: [{ scale: card.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }}>
          <Glass tone="strong" blur elevated style={styles.card}>
            {model.art ? (
              <Image source={{ uri: model.art }} style={styles.art} contentFit="cover" cachePolicy="memory-disk" transition={200} />
            ) : (
              <Text style={styles.emoji}>🎉</Text>
            )}
            <Text style={styles.title} numberOfLines={2}>
              {model.title}
            </Text>
            {!!model.detail && (
              <Text style={styles.detail} numberOfLines={3}>
                {model.detail}
              </Text>
            )}
          </Glass>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 32 },
  card: { alignItems: 'center', gap: 8, paddingVertical: 22, paddingHorizontal: 26, borderRadius: radii.xl, maxWidth: 320 },
  art: { width: 84, height: 126, borderRadius: radii.sm, marginBottom: 6, backgroundColor: palette.placeholder },
  emoji: { fontSize: 44, marginBottom: 2 },
  title: { ...type.title, textAlign: 'center' },
  detail: { ...type.small, ...fonts.medium, textAlign: 'center' },
}));
