import { ReactNode, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import Icon from '@/components/ui/Icon';
import Poster from '@/components/ui/Poster';
import PressableScale from '@/components/ui/PressableScale';
import { FadeIn, Skeleton } from '@/components/ui/Motion';
import { makeStyles, useTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';

interface Props {
  kind: 'show' | 'movie';
  title?: string;
  poster?: string;
  backdrop?: string;
  meta?: string;
  tags?: string[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  children?: ReactNode;
}

/**
 * Detail page: the backdrop stretches on pull and drifts slower than the page on scroll,
 * then fades into the paper; the poster overlaps it. A frosted bar takes the title once
 * the hero has scrolled away.
 */
export default function DetailLayout({ kind, title, poster, backdrop, meta, tags, loading, error, onRetry, children }: Props) {
  const { t } = useTranslation();
  const { palette, type, glass } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, gutter, content, wide } = useLayout();
  const y = useRef(new Animated.Value(0)).current;
  const heroH = wide ? 420 : Math.round(width * 0.78);
  const posterW = wide ? 180 : 116;
  const art = backdrop ?? poster;

  const heroStyle = {
    transform: [
      { translateY: y.interpolate({ inputRange: [-200, 0, heroH], outputRange: [-100, 0, heroH * 0.45], extrapolateRight: 'clamp' }) },
      { scale: y.interpolate({ inputRange: [-200, 0], outputRange: [1.6, 1], extrapolateRight: 'clamp' }) },
    ],
  };
  const barOpacity = y.interpolate({ inputRange: [heroH - 140, heroH - 70], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y } } }], { useNativeDriver: true })}
        contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
      >
        <Animated.View style={[{ height: heroH, overflow: 'hidden' }, heroStyle]}>
          {art ? (
            <Image source={{ uri: art }} style={StyleSheet.absoluteFill} contentFit="cover" transition={350} blurRadius={backdrop ? 0 : 24} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.hero }]} />
          )}
          <LinearGradient colors={[palette.scrimClear, palette.scrimSoft, palette.screen]} locations={[0.35, 0.6, 1]} style={StyleSheet.absoluteFill} />
        </Animated.View>

        <View style={[styles.body, { width: content, paddingHorizontal: gutter, marginTop: -posterW * 0.9 }]}>
          <View style={styles.head}>
            <FadeIn distance={24}>
              {loading && !poster ? <Skeleton width={posterW} height={posterW * 1.5} radius={14} /> : <Poster uri={poster} title={title ?? ''} width={posterW} kind={kind} />}
            </FadeIn>
            <FadeIn index={1} style={{ flex: 1, gap: 6, paddingBottom: 4 }}>
              {title ? (
                <Text style={[type.hero, wide && { fontSize: 38, lineHeight: 42 }]} numberOfLines={3}>
                  {title}
                </Text>
              ) : (
                <Skeleton width="80%" height={26} />
              )}
              {!!meta && <Text style={styles.meta}>{meta}</Text>}
            </FadeIn>
          </View>
          {!!tags?.length && (
            <FadeIn index={2} style={styles.tags}>
              {tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </FadeIn>
          )}
          {error ? (
            <View style={styles.error}>
              <Text style={type.small}>{t('detail.error')}</Text>
              {onRetry && (
                <PressableScale onPress={onRetry}>
                  <Text style={styles.retry}>{t('common.retry')}</Text>
                </PressableScale>
              )}
            </View>
          ) : (
            children
          )}
        </View>
      </Animated.ScrollView>

      <Animated.View pointerEvents="none" style={[styles.bar, { height: insets.top + 52, opacity: barOpacity }]}>
        <BlurView intensity={40} tint={glass.tint} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.glass }]} />
        <View style={[styles.barInner, { paddingTop: insets.top }]}>
          <Text style={[type.heading, { maxWidth: '70%' }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </Animated.View>
      <PressableScale onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={[styles.back, { top: insets.top + 6, left: gutter - 6 }]} accessibilityLabel={t('common.back')}>
        <BlurView intensity={30} tint={glass.tint} style={StyleSheet.absoluteFill} />
        <Icon name="back" size={20} color={palette.ink} strokeWidth={2.2} />
      </PressableScale>
    </View>
  );
}

/** Synopsis that opens on tap when it runs long. */
export function Synopsis({ text }: { text?: string }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const long = text.length > 260;
  return (
    <PressableScale depth={0.99} disabled={!long} onPress={() => setOpen((o) => !o)} style={{ marginTop: 22 }}>
      <Text style={styles.synopsis} numberOfLines={open || !long ? undefined : 4}>
        {text}
      </Text>
      {long && <Text style={styles.more}>{open ? t('detail.less') : t('detail.more')}</Text>}
    </PressableScale>
  );
}

/** Cast as small round portraits. */
export function CastRail({ cast }: { cast: { name: string; character?: string; image?: string }[] }) {
  const { t } = useTranslation();
  const { type } = useTheme();
  const styles = useStyles();
  const { gutter } = useLayout();
  if (!cast.length) return null;
  return (
    <View style={{ marginTop: 30, gap: 14 }}>
      <Text style={type.title}>{t('detail.cast')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ paddingHorizontal: gutter, gap: 14 }}>
        {cast.map((c, i) => (
          <FadeIn key={`${c.name}${i}`} index={i} style={{ width: 78, alignItems: 'center', gap: 6 }}>
            <View style={styles.face}>
              {c.image ? (
                <Image source={{ uri: c.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
              ) : (
                <Text style={styles.initials}>
                  {c.name
                    .split(' ')
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join('')}
                </Text>
              )}
            </View>
            <Text style={styles.castName} numberOfLines={2}>
              {c.name}
            </Text>
            {!!c.character && (
              <Text style={styles.castRole} numberOfLines={1}>
                {c.character}
              </Text>
            )}
          </FadeIn>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles(({ palette, fonts, type }) => ({
  root: { flex: 1, backgroundColor: palette.screen },
  body: { alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: 18 },
  meta: { fontFamily: fonts.medium, fontSize: 13.5, color: palette.inkSoft },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 16 },
  tag: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: palette.surface },
  tagText: { fontFamily: fonts.medium, fontSize: 12, color: palette.inkSoft },
  synopsis: { ...type.body, color: palette.ink, lineHeight: 22 },
  more: { fontFamily: fonts.semibold, fontSize: 13, color: palette.primary, marginTop: 4 },
  error: { marginTop: 30, alignItems: 'center', gap: 10 },
  retry: { fontFamily: fonts.semibold, fontSize: 14, color: palette.primary },
  bar: { position: 'absolute', left: 0, right: 0, top: 0, overflow: 'hidden' },
  barInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: palette.glass },
  face: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', backgroundColor: palette.fieldActive, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fonts.semibold, fontSize: 18, color: palette.inkSoft },
  castName: { fontFamily: fonts.medium, fontSize: 12, color: palette.ink, textAlign: 'center' },
  castRole: { fontFamily: fonts.body, fontSize: 11, color: palette.inkFaint, textAlign: 'center' },
}));
