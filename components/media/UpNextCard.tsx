import { useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import CheckButton from '@/components/ui/CheckButton';
import PressableScale from '@/components/ui/PressableScale';
import Poster from '@/components/ui/Poster';
import { animateLayout } from '@/components/ui/Motion';
import { makeStyles } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { episodeCode, Progress } from '@/lib/progress';
import { Show } from '@/lib/types';
import { useLibrary } from '@/store/useLibrary';

/**
 * The next episode to watch for one show. Ticking it slides the next one in; the
 * card leaves once you are up to date.
 */
export default function UpNextCard({ show, progress, width }: { show: Show; progress: Progress; width: number }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const router = useRouter();
  const haptics = useHaptics();
  const toggle = useLibrary((s) => s.toggleEpisode);
  const ep = progress.next!;
  const slide = useRef(new Animated.Value(1)).current;
  const still = ep.image ?? show.backdrop;
  const imgW = Math.min(150, Math.round(width * 0.36));

  const onCheck = () => {
    haptics.success();
    Animated.timing(slide, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      // The last episode out: the card leaves and the list closes the gap.
      if (progress.left <= 1) animateLayout();
      toggle(show.id, ep.id);
      slide.setValue(0);
      Animated.spring(slide, { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 220 }).start();
    });
  };

  return (
    <PressableScale depth={0.98} onPress={() => router.push(`/show/${show.tvmazeId}`)} style={[styles.card, { width }]} accessibilityLabel={show.title}>
      <View style={[styles.still, { width: imgW, height: Math.round(imgW * 0.62) }]}>
        {still ? (
          <Image source={{ uri: still }} style={StyleSheet.absoluteFill} contentFit="cover" transition={220} />
        ) : (
          <View style={styles.posterFill}>
            <Poster uri={show.poster} title={show.title} width={imgW} elevated={false} radius={0} />
          </View>
        )}
        <View style={styles.codeTag}>
          <Text style={styles.codeText}>{episodeCode(ep)}</Text>
        </View>
      </View>
      <Animated.View style={[styles.info, { opacity: slide, transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
        <Text style={styles.show} numberOfLines={1}>
          {show.title}
        </Text>
        <Text style={styles.ep} numberOfLines={2}>
          {ep.name || t('show.episodeN', { n: ep.number })}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(progress.fraction * 100)}%` }]} />
          </View>
          <Text style={styles.left}>{t('upNext.left', { count: progress.left })}</Text>
        </View>
      </Animated.View>
      <CheckButton checked={false} onPress={onCheck} label={t('show.markWatched')} size={38} />
    </PressableScale>
  );
}

const useStyles = makeStyles(({ palette, fonts, shadow, radii }) => ({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 10, paddingRight: 12, borderRadius: radii.lg, backgroundColor: palette.surface, ...shadow.soft, shadowOpacity: 0.06 },
  still: { borderRadius: radii.sm, overflow: 'hidden', backgroundColor: '#DCE8F4' },
  posterFill: { position: 'absolute', top: '-40%', left: 0, right: 0 },
  codeTag: { position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(10,37,64,0.72)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  codeText: { fontFamily: fonts.semibold, fontSize: 10.5, color: '#fff', letterSpacing: 0.3 },
  info: { flex: 1, gap: 3 },
  show: { fontFamily: fonts.semibold, fontSize: 15.5, color: palette.ink, letterSpacing: -0.2 },
  ep: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 18, color: palette.inkSoft },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: palette.field, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: palette.primary },
  left: { fontFamily: fonts.medium, fontSize: 11.5, color: palette.inkFaint },
}));
