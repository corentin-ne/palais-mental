import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import Icon, { IconName } from '@/components/ui/Icon';
import Poster from '@/components/ui/Poster';
import PressableScale from '@/components/ui/PressableScale';
import { useCountUp } from '@/components/ui/Motion';
import { makeStyles, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { useLayout } from '@/hooks/useLayout';
import i18n from '@/locales/i18n';
import { fullDate } from '@/lib/format';
import { Recap, recapOf } from '@/lib/recap';
import { mix, rotate } from '@/spark';
import { useLibrary } from '@/store/useLibrary';
import { usePrefs } from '@/store/usePrefs';

/** How long a card stays before the next one, unless you hold it. */
const DWELL = 6500;
const KIND_ICON: Record<string, IconName> = { show: 'series', movie: 'movies', book: 'journal', game: 'gamepad' };

interface Slide {
  key: string;
  render: () => ReactNode;
}

/**
 * Your year as a story: one card at a time on a deep wash of your accent, numbers that count up, tap the right
 * to go on and the left to go back, hold to pause. Every card can be shared as an image.
 */
export default function RecapScreen() {
  const { year: param } = useLocalSearchParams<{ year?: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const haptics = useHaptics();
  const { palette, spark } = useTheme();
  const shows = useLibrary((s) => s.shows);
  const movies = useLibrary((s) => s.movies);
  const books = useLibrary((s) => s.books);
  const games = useLibrary((s) => s.games);
  const goals = usePrefs((s) => s.goals);
  const year = Number(param) || new Date().getFullYear();
  const recap = useMemo(() => recapOf({ shows, movies, books, games }, year, year === new Date().getFullYear() ? goals : {}), [shows, movies, books, games, year, goals]);
  const slides = useMemo(() => slidesOf(recap, t), [recap, t]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const card = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const go = (to: number) => {
    if (to >= slides.length) return close();
    setIndex(Math.max(0, to));
    haptics.select();
  };

  // The bar of the current card fills over DWELL, then the next card comes. Holding pauses it where it is.
  const resume = useRef(0);
  useEffect(() => {
    resume.current = 0;
  }, [index]);
  useEffect(() => {
    if (paused || sharing) return;
    const from = resume.current;
    progress.setValue(from);
    const anim = Animated.timing(progress, { toValue: 1, duration: DWELL * (1 - from), easing: Easing.linear, useNativeDriver: false });
    anim.start(({ finished }) => {
      if (finished && index < slides.length - 1) setIndex((i) => i + 1);
    });
    return () => {
      anim.stop();
      progress.stopAnimation((v) => (resume.current = v));
    };
  }, [index, paused, sharing, progress, slides.length]);

  const share = async () => {
    setSharing(true);
    try {
      if (Platform.OS === 'web') throw new Error('web');
      const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('recap.title', { year }) });
    } catch {
      await Share.share({ message: shareText(recap, t) }).catch(() => undefined);
    } finally {
      setSharing(false);
    }
  };

  const hue = (i: number) => {
    const base = rotate(spark.accentBase, i * 32 - 20);
    return [mix(base, '#04060c', 0.35), mix(rotate(base, 40), '#04060c', 0.62), '#04060c'] as const;
  };

  if (!slides.length) return null;
  const slide = slides[Math.min(index, slides.length - 1)];

  return (
    <View style={styles.root}>
      <View ref={card} collapsable={false} style={StyleSheet.absoluteFill}>
        <LinearGradient colors={hue(index)} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={[styles.body, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 110 }]}>
          <View key={slide.key} style={{ flex: 1, justifyContent: 'center' }}>
            {slide.render()}
          </View>
          <Text style={styles.brand}>{t('recap.brand', { year })}</Text>
        </View>
      </View>

      {/* Tap zones: the left third goes back, the rest goes on. Holding pauses. */}
      <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', top: insets.top + 50, bottom: insets.bottom + 96 }]}>
        <Pressable style={{ flex: 1 }} onPress={() => go(index - 1)} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} delayLongPress={220} accessibilityLabel={t('recap.previous')} />
        <Pressable style={{ flex: 2 }} onPress={() => go(index + 1)} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} delayLongPress={220} accessibilityLabel={t('recap.next')} />
      </View>

      <View style={[styles.bars, { top: insets.top + 10 }]}>
        {slides.map((s, i) => (
          <View key={s.key} style={styles.barTrack}>
            <Animated.View
              style={[
                styles.barFill,
                { width: i < index ? '100%' : i > index ? '0%' : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
              ]}
            />
          </View>
        ))}
      </View>
      <PressableScale onPress={close} style={[styles.close, { top: insets.top + 22 }]} accessibilityLabel={t('common.close')}>
        <Icon name="close" size={22} color="#fff" strokeWidth={2.2} />
      </PressableScale>

      <View style={[styles.footer, { bottom: insets.bottom + 26 }]}>
        <PressableScale onPress={share} disabled={sharing} style={styles.share} accessibilityLabel={t('recap.share')}>
          <Icon name="share" size={18} color="#0b1020" strokeWidth={2.2} />
          <Text style={styles.shareText}>{t('recap.share')}</Text>
        </PressableScale>
      </View>
    </View>
  );
}

// ------------------------------------------------------------------ Cards
function slidesOf(r: Recap, t: (k: string, o?: Record<string, unknown>) => string): Slide[] {
  const out: Slide[] = [];
  const s = r.stats;
  if (!r.titles) {
    out.push({ key: 'empty', render: () => <Big eyebrow={t('recap.title', { year: r.year })} value={0} caption={t('recap.empty')} /> });
    return out;
  }
  out.push({ key: 'intro', render: () => <Big eyebrow={t('recap.title', { year: r.year })} value={r.titles} caption={t('recap.titles', { count: r.titles })} /> });
  if (r.minutes > 60)
    out.push({
      key: 'time',
      render: () => <Big eyebrow={t('recap.timeEyebrow')} value={Math.round(r.minutes / 60)} caption={t('recap.hours', { count: Math.round(r.minutes / 60) })} footnote={r.minutes >= 1440 ? t('recap.days', { count: Math.floor(r.minutes / 1440) }) : undefined} />,
    });
  if (s.episodes)
    out.push({
      key: 'shows',
      render: () => (
        <View style={{ gap: 26 }}>
          <Big eyebrow={t('recap.showsEyebrow')} value={s.episodes} caption={t('recap.episodes', { count: s.episodes })} />
          {r.binge && <Feature poster={r.binge.poster} title={r.binge.title} kind="show" line={t('recap.binge', { count: r.binge.episodes, date: fullDate(r.binge.at) })} />}
          {!r.binge && s.topShows[0] && <Feature poster={s.topShows[0].show.poster} title={s.topShows[0].show.title} kind="show" line={t('recap.topShow', { count: s.topShows[0].episodes })} />}
        </View>
      ),
    });
  const kinds = [
    { icon: 'movies' as const, value: s.films, label: t('recap.films', { count: s.films }) },
    { icon: 'journal' as const, value: s.books, label: t('recap.books', { count: s.books }) },
    { icon: 'gamepad' as const, value: s.games, label: t('recap.games', { count: s.games }) },
  ].filter((k) => k.value);
  if (kinds.length)
    out.push({
      key: 'kinds',
      render: () => (
        <View style={{ gap: 18 }}>
          <Eyebrow text={t('recap.kindsEyebrow')} />
          {kinds.map((k, i) => (
            <Row key={k.icon} index={i} icon={k.icon} value={k.value} label={k.label} />
          ))}
          {s.pages > 0 && <Foot text={t('recap.pages', { count: s.pages })} />}
        </View>
      ),
    });
  if (s.genres.length || r.bestMonth != null)
    out.push({
      key: 'taste',
      render: () => (
        <View style={{ gap: 26 }}>
          {s.genres[0] && <Big eyebrow={t('recap.genreEyebrow')} text={s.genres[0].name} caption={s.genres.slice(1, 4).map((g) => g.name).join(' · ')} />}
          {r.bestMonth != null && <Months buckets={s.buckets.map((b) => b.show + b.movie + b.book + b.game)} best={r.bestMonth} caption={t('recap.bestMonth', { month: new Date(r.year, r.bestMonth, 1).toLocaleDateString(i18n.language, { month: 'long' }) })} />}
        </View>
      ),
    });
  if (r.top.length)
    out.push({
      key: 'top',
      render: () => (
        <View style={{ gap: 18 }}>
          <Eyebrow text={t('recap.topEyebrow')} />
          {r.top.map((x, i) => (
            <Ranked key={x.href} index={i} title={x.title} poster={x.poster} kind={x.kind} rating={x.rating} />
          ))}
        </View>
      ),
    });
  out.push({
    key: 'rhythm',
    render: () => (
      <View style={{ gap: 22 }}>
        <Big eyebrow={t('recap.rhythmEyebrow')} value={s.activeDays} caption={t('recap.activeDays', { count: s.activeDays })} />
        {s.streak > 1 && <Foot text={t('recap.streak', { count: s.streak })} />}
        {r.busiest && r.busiest.count > 2 && <Foot text={t('recap.busiest', { count: r.busiest.count, date: fullDate(r.busiest.at) })} />}
        {r.goals.map((g) => (
          <Foot key={g.kind} text={g.count >= g.goal ? t('recap.goalDone', { count: g.count, goal: g.goal, what: t(`recap.unit.${g.kind}`, { count: g.goal }) }) : t('recap.goalLeft', { count: g.count, goal: g.goal, what: t(`recap.unit.${g.kind}`, { count: g.goal }) })} />
        ))}
      </View>
    ),
  });
  out.push({ key: 'outro', render: () => <Big eyebrow={t('recap.outroEyebrow')} text={t('recap.outro')} caption={t('recap.outroBody', { year: r.year + 1 })} /> });
  return out;
}

function shareText(r: Recap, t: (k: string, o?: Record<string, unknown>) => string) {
  const s = r.stats;
  return [
    t('recap.title', { year: r.year }),
    t('recap.titles', { count: r.titles }),
    s.episodes ? t('recap.episodes', { count: s.episodes }) : '',
    s.films ? t('recap.films', { count: s.films }) : '',
    s.books ? t('recap.books', { count: s.books }) : '',
    s.games ? t('recap.games', { count: s.games }) : '',
    r.top[0] ? `★ ${r.top[0].title}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

// ------------------------------------------------------------------ Card parts (white on the wash)
function useEnter(delay = 0) {
  const { spark } = useTheme();
  const v = useRef(new Animated.Value(spark.reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (!spark.reduceMotion) Animated.spring(v, { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 150, delay }).start();
  }, [v, delay, spark.reduceMotion]);
  return { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] };
}

function Eyebrow({ text }: { text: string }) {
  const styles = useStyles();
  return <Animated.Text style={[styles.eyebrow, useEnter()]}>{text}</Animated.Text>;
}

function Big({ eyebrow, value, text, caption, footnote }: { eyebrow: string; value?: number; text?: string; caption?: string; footnote?: string }) {
  const styles = useStyles();
  const shown = useCountUp(value ?? 0, 1200);
  const a = useEnter(80);
  const b = useEnter(220);
  return (
    <View style={{ gap: 10 }}>
      <Eyebrow text={eyebrow} />
      <Animated.Text style={[text ? styles.word : styles.figure, a]} numberOfLines={text ? 3 : 1} adjustsFontSizeToFit>
        {text ?? Math.round(shown).toLocaleString()}
      </Animated.Text>
      {!!caption && <Animated.Text style={[styles.caption, b]}>{caption}</Animated.Text>}
      {!!footnote && <Foot text={footnote} delay={360} />}
    </View>
  );
}

function Foot({ text, delay = 300 }: { text: string; delay?: number }) {
  const styles = useStyles();
  return <Animated.Text style={[styles.foot, useEnter(delay)]}>{text}</Animated.Text>;
}

function Row({ icon, value, label, index }: { icon: IconName; value: number; label: string; index: number }) {
  const styles = useStyles();
  const shown = useCountUp(value, 1000);
  return (
    <Animated.View style={[styles.row, useEnter(120 + index * 120)]}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={22} color="#fff" strokeWidth={2} />
      </View>
      <Text style={styles.rowValue}>{Math.round(shown)}</Text>
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
    </Animated.View>
  );
}

function Feature({ poster, title, kind, line }: { poster?: string; title: string; kind: 'show' | 'movie' | 'book' | 'game'; line: string }) {
  const styles = useStyles();
  return (
    <Animated.View style={[styles.feature, useEnter(320)]}>
      <Poster uri={poster} title={title} width={86} kind={kind} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.featureTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.featureLine}>{line}</Text>
      </View>
    </Animated.View>
  );
}

function Ranked({ index, title, poster, kind, rating }: { index: number; title: string; poster?: string; kind: 'show' | 'movie' | 'book' | 'game'; rating?: number }) {
  const styles = useStyles();
  const { inner } = useLayout();
  return (
    <Animated.View style={[styles.ranked, useEnter(100 + index * 110)]}>
      <Text style={styles.rank}>{index + 1}</Text>
      <Poster uri={poster} title={title} width={inner > 400 ? 52 : 44} kind={kind} elevated={false} radius={6} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.featureTitle} numberOfLines={1}>
          {title}
        </Text>
        {!!rating && <Text style={styles.stars}>{'★'.repeat(Math.floor(rating / 2)) + (rating % 2 ? '½' : '')}</Text>}
      </View>
      <Icon name={KIND_ICON[kind]} size={16} color="rgba(255,255,255,0.6)" />
    </Animated.View>
  );
}

function Months({ buckets, best, caption }: { buckets: number[]; best: number; caption: string }) {
  const styles = useStyles();
  const max = Math.max(1, ...buckets);
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(grow, { toValue: 1, duration: 900, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [grow]);
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.months}>
        {buckets.map((n, i) => (
          <View key={i} style={styles.monthCol}>
            <Animated.View
              style={[
                styles.monthBar,
                { height: Math.max(3, Math.round((n / max) * 90)), backgroundColor: i === best ? '#fff' : 'rgba(255,255,255,0.32)', transform: [{ scaleY: grow }], transformOrigin: 'bottom' } as object,
              ]}
            />
          </View>
        ))}
      </View>
      <Foot text={caption} delay={500} />
    </View>
  );
}

const WHITE = '#ffffff';
const SOFT = 'rgba(255,255,255,0.78)';

const useStyles = makeStyles(({ fonts }) => ({
  root: { flex: 1, backgroundColor: '#04060c' },
  body: { flex: 1, paddingHorizontal: 28 },
  bars: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', gap: 4 },
  barTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.28)', overflow: 'hidden' },
  barFill: { height: 3, backgroundColor: WHITE },
  close: { position: 'absolute', right: 14, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  share: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 22, borderRadius: 24, backgroundColor: WHITE },
  shareText: { ...fonts.bold, fontSize: 15, color: '#0b1020' },
  brand: { ...fonts.semibold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
  eyebrow: { ...fonts.bold, fontSize: 13, letterSpacing: 1.4, textTransform: 'uppercase', color: SOFT },
  figure: { ...fonts.bold, fontSize: 96, lineHeight: 104, letterSpacing: -4, color: WHITE, fontVariant: ['tabular-nums'] },
  word: { ...fonts.bold, fontSize: 52, lineHeight: 58, letterSpacing: -1.6, color: WHITE },
  caption: { ...fonts.semibold, fontSize: 22, lineHeight: 28, color: WHITE },
  foot: { ...fonts.medium, fontSize: 16, lineHeight: 22, color: SOFT },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  rowValue: { ...fonts.bold, fontSize: 44, letterSpacing: -1.5, color: WHITE, minWidth: 70, fontVariant: ['tabular-nums'] },
  rowLabel: { ...fonts.semibold, fontSize: 18, color: SOFT, flex: 1 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 14, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)' },
  featureTitle: { ...fonts.bold, fontSize: 17, color: WHITE },
  featureLine: { ...fonts.medium, fontSize: 14.5, lineHeight: 20, color: SOFT },
  ranked: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rank: { ...fonts.bold, fontSize: 30, color: WHITE, width: 28, textAlign: 'center' },
  stars: { ...fonts.semibold, fontSize: 14, color: '#ffd76a', letterSpacing: 1 },
  months: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 96 },
  monthCol: { flex: 1, justifyContent: 'flex-end' },
  monthBar: { borderRadius: 3 },
}));
