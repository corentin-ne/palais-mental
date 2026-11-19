import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import Button from './Button';
import Icon, { IconName } from './Icon';
import { FadeIn } from './Motion';
import { makeStyles, useTheme } from '@/constants/theme';

/**
 * An empty state with a drawing of its own: three cards fanned out in the accent family, the one in front
 * carrying the icon, floating gently (still in lite and with reduced motion). One sentence, one way forward.
 */
export default function Empty({ icon, title, body, cta, ctaIcon = 'search', onPress }: { icon: IconName; title: string; body?: string; cta?: string; ctaIcon?: IconName; onPress?: () => void }) {
  const styles = useStyles();
  return (
    <FadeIn style={styles.root}>
      <Fan icon={icon} />
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {!!body && <Text style={styles.body}>{body}</Text>}
      {cta && onPress && <Button label={cta} icon={ctaIcon} onPress={onPress} style={{ marginTop: 10 }} />}
    </FadeIn>
  );
}

export function Fan({ icon, size = 64 }: { icon: IconName; size?: number }) {
  const { palette, spark } = useTheme();
  const bob = useRef(new Animated.Value(0)).current;
  const open = useRef(new Animated.Value(spark.reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (!spark.reduceMotion) Animated.spring(open, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 140, delay: 120 }).start();
    if (!spark.motion.loops) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob, open, spark.motion.loops, spark.reduceMotion]);

  const w = size;
  const h = Math.round(size * 1.4);
  const card = (tilt: number, shift: number, colors: [string, string], front?: boolean) => (
    <Animated.View
      style={{
        position: 'absolute',
        width: w,
        height: h,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: palette.glassEdge,
        transform: [
          { translateX: open.interpolate({ inputRange: [0, 1], outputRange: [0, shift] }) },
          { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, front ? -6 : -3] }) },
          { rotate: open.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${tilt}deg`] }) },
        ],
      }}
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {front && <Icon name={icon} size={size * 0.42} color={palette.onInk} strokeWidth={2} />}
      </LinearGradient>
    </Animated.View>
  );
  const [t1, t2] = palette.posterTints;
  return (
    <View style={{ width: w * 2.2, height: h + 16, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }} importantForAccessibility="no-hide-descendants">
      {card(-14, -w * 0.5, t1)}
      {card(14, w * 0.5, t2)}
      {card(0, 0, [palette.primary, palette.primaryDeep], true)}
    </View>
  );
}

const useStyles = makeStyles(({ palette, type }) => ({
  root: { alignItems: 'center', paddingVertical: 34, paddingHorizontal: 18, gap: 6 },
  title: { ...type.title, textAlign: 'center' },
  body: { ...type.body, color: palette.inkSoft, textAlign: 'center', maxWidth: 340 },
}));
