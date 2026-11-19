import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import Icon from '@/components/ui/Icon';
import PressableScale from '@/components/ui/PressableScale';
import { FadeIn } from '@/components/ui/Motion';
import { makeStyles, useTheme } from '@/constants/theme';
import { mix, rotate } from '@/spark';

/** The way into a year's recap: a deep accent card with a slow sheen across it. */
export default function RecapBanner({ year, style }: { year: number; style?: object }) {
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useStyles();
  const { spark } = useTheme();
  const sheen = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!spark.motion.loops) return;
    const loop = Animated.loop(Animated.sequence([Animated.timing(sheen, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.delay(2400)]));
    loop.start();
    return () => loop.stop();
  }, [sheen, spark.motion.loops]);
  const base = spark.accentBase;
  return (
    <FadeIn style={style}>
      <PressableScale depth={0.98} onPress={() => router.push(`/recap?year=${year}` as Href)} style={styles.card} accessibilityLabel={t('recap.banner', { year })}>
        <LinearGradient colors={[mix(base, '#04060c', 0.3), mix(rotate(base, 50), '#04060c', 0.55)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Animated.View
          pointerEvents="none"
          style={[styles.sheen, { transform: [{ translateX: sheen.interpolate({ inputRange: [0, 1], outputRange: [-220, 520] }) }, { rotate: '18deg' }] }]}
        />
        <View style={styles.icon}>
          <Icon name="sparkle" size={22} color="#fff" strokeWidth={2} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title}>{t('recap.banner', { year })}</Text>
          <Text style={styles.body} numberOfLines={2}>
            {t('recap.bannerBody')}
          </Text>
        </View>
        <Icon name="chevronRight" size={18} color="rgba(255,255,255,0.8)" strokeWidth={2.4} />
      </PressableScale>
    </FadeIn>
  );
}

const useStyles = makeStyles(({ fonts, radii }) => ({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radii.lg, overflow: 'hidden' },
  sheen: { position: 'absolute', top: -40, bottom: -40, width: 60, backgroundColor: 'rgba(255,255,255,0.14)' },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  title: { ...fonts.bold, fontSize: 17, color: '#fff', letterSpacing: -0.2 },
  body: { ...fonts.medium, fontSize: 13.5, lineHeight: 18, color: 'rgba(255,255,255,0.78)' },
}));
