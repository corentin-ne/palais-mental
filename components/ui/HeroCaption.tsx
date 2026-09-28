import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import Glass from './Glass';
import Icon from './Icon';
import { makeStyles, useTheme } from '@/constants/theme';
import { CATEGORY_SPECS } from '@/lib/itemVisuals';
import { selectActiveHero, usePalaceStore } from '@/store/usePalaceStore';

/** Names the object being brought into the light, then fades away with it. */
export default function HeroCaption() {
  const { type } = useTheme();
  const styles = useStyles();
  const { t } = useTranslation();
  const hero = usePalaceStore(selectActiveHero);
  const item = usePalaceStore((s) => (hero ? s.items[hero.itemId] : undefined));
  const opacity = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<{ category: string; title: string; line: string; accent: string } | null>(null);

  useEffect(() => {
    if (hero && item) {
      const line =
        hero.kind === 'episode'
          ? hero.completesSeason
            ? t('series.seasonComplete', { season: hero.seasonIndex + 1 })
            : t('series.episode', { episode: hero.episodeIndex + 1, total: hero.episodeCount })
          : t('hero.placed', { category: t(`categories.${item.category}`) });
      setShown({ category: item.category, title: item.title, line, accent: CATEGORY_SPECS[item.category].accent });
      Animated.timing(opacity, { toValue: 1, duration: 380, delay: 250, useNativeDriver: true }).start();
    } else {
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }
  }, [hero, item, opacity, t]);

  if (!shown) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        { opacity, transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] },
      ]}
    >
      <Glass radius={20} contentStyle={styles.inner}>
        <Icon name={shown.category as never} size={18} color={shown.accent} strokeWidth={2} />
        <Text style={styles.title} numberOfLines={1}>
          {shown.title}
        </Text>
        <Text style={[type.label, { color: shown.accent }]} numberOfLines={1}>
          {shown.line}
        </Text>
      </Glass>
    </Animated.View>
  );
}

const useStyles = makeStyles(({ palette, fonts }) => ({
  wrap: { alignSelf: 'center', maxWidth: '86%' },
  inner: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 4 },
  title: { fontFamily: fonts.displayItalic, fontSize: 20, color: palette.ink },
}));
