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
import { useUi } from '@/store/useUi';

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
  // A fixed, modest still: the text column gets the room (titles and episode names were cut short).
  const imgW = width >= 520 ? 132 : 104;

  const onCheck = () => {
    haptics.success();
    Animated.timing(slide, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      // The last episode out: the card leaves and the list closes the gap.
      if (progress.left <= 1) animateLayout();
      toggle(show.id, ep.id);
      useUi.getState().showToast(t('toast.watchedEp', { code: episodeCode(ep) }), () => useLibrary.getState().setEpisodes(show.id, [ep.id], false));
      slide.setValue(0);
      Animated.spring(slide, { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 220 }).start();
    });
  };

  return (
    // The card opens the show and the check marks the episode: siblings, not one control inside another.
    <View style={[styles.card, { width }]}>
      <PressableScale depth={0.98} onPress={() => router.push(`/show/${show.tvmazeId}`)} style={styles.open} accessibilityLabel={show.title}>
        <View style={[styles.still, { width: imgW, height: Math.round(imgW * 0.625) }]}>
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
      </PressableScale>
      <CheckButton checked={false} onPress={onCheck} label={t('show.markWatched')} size={40} />
    </View>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii }) => ({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radii.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  still: { borderRadius: radii.sm, overflow: 'hidden', backgroundColor: palette.placeholder },
  posterFill: { position: 'absolute', top: '-40%', left: 0, right: 0 },
  codeTag: { position: 'absolute', left: 5, bottom: 5, backgroundColor: palette.codeTag, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1.5 },
  codeText: { ...fonts.semibold, fontSize: 10, color: '#fff', letterSpacing: 0.3, fontVariant: ['tabular-nums'] },
  info: { flex: 1, minWidth: 0, gap: 2 },
  show: { ...fonts.semibold, fontSize: 15.5, lineHeight: 20, color: palette.ink, letterSpacing: -0.2 },
  ep: { ...fonts.body, fontSize: 13.5, lineHeight: 18, color: palette.inkSoft },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: palette.fieldActive, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: palette.primary },
  left: { ...fonts.medium, fontSize: 12, color: palette.inkFaint, fontVariant: ['tabular-nums'] },
}));
