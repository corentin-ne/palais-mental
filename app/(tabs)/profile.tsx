import { ReactNode, useMemo } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import Icon, { IconName } from '@/components/ui/Icon';
import Poster from '@/components/ui/Poster';
import PressableScale from '@/components/ui/PressableScale';
import Screen, { Section } from '@/components/ui/Screen';
import { StarBadge } from '@/components/ui/StarRating';
import { FadeIn, useCountUp } from '@/components/ui/Motion';
import { makeStyles, useTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { duration, relativeDay } from '@/lib/format';
import { episodeCode, minutesWatched } from '@/lib/progress';
import { pagesRead } from '@/lib/shelf';
import { useLibrary } from '@/store/useLibrary';

const JOURNAL = 8;

/** A few honest numbers and the notes you kept along the way. Settings live one tap away. */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const { wide } = useLayout();
  const shows = useLibrary((s) => s.shows);
  const movies = useLibrary((s) => s.movies);
  const books = useLibrary((s) => s.books);
  const games = useLibrary((s) => s.games);
  const router = useRouter();

  const stats = useMemo(() => {
    const showList = Object.values(shows);
    const watchedMovies = Object.values(movies).filter((m) => m.watchedAt);
    return {
      episodes: showList.reduce((n, s) => n + Object.keys(s.watched).length, 0),
      showMinutes: showList.reduce((n, s) => n + minutesWatched(s), 0),
      films: watchedMovies.length,
      filmMinutes: watchedMovies.reduce((n, m) => n + (m.runtime ?? 0), 0),
      books: Object.values(books).filter((b) => b.finishedAt).length,
      pages: Object.values(books).reduce((n, b) => n + pagesRead(b), 0),
      games: Object.values(games).filter((g) => g.finishedAt).length,
      hours: Object.values(games).reduce((n, g) => n + (g.hours ?? 0), 0),
    };
  }, [shows, movies, books, games]);

  const settingsButton = (
    <PressableScale onPress={() => router.push('/settings')} style={styles.gear} accessibilityLabel={t('settings.title')}>
      <Icon name="settings" size={22} color={palette.ink} />
    </PressableScale>
  );

  return (
    <Screen title={t('profile.title')} right={settingsButton}>
      <View style={[styles.stats, wide && { flexWrap: 'nowrap' }]}>
        <Stat index={0} icon="series" value={stats.episodes} label={t('profile.episodes')} />
        <Stat index={1} icon="clock" text={duration(stats.showMinutes)} label={t('profile.showTime')} />
        <Stat index={2} icon="movies" value={stats.films} label={t('profile.films')} />
        <Stat index={3} icon="clock" text={duration(stats.filmMinutes)} label={t('profile.filmTime')} />
      </View>
      {(stats.books > 0 || stats.pages > 0 || stats.games > 0 || stats.hours > 0) && (
        <View style={[styles.stats, { marginTop: 10 }, wide && { flexWrap: 'nowrap' }]}>
          <Stat index={4} icon="journal" value={stats.books} label={t('profile.books')} />
          <Stat index={5} icon="journal" value={stats.pages} label={t('profile.pages')} />
          <Stat index={6} icon="play" value={stats.games} label={t('profile.games')} />
          <Stat index={7} icon="clock" value={Math.round(stats.hours)} label={t('profile.playTime')} />
        </View>
      )}

      <View style={[styles.group, { marginTop: 12 }]}>
        <ActionRow icon="clock" label={t('history.title')} hint={t('history.hint')} onPress={() => router.push('/history')} />
        <ActionRow icon="settings" label={t('settings.title')} hint={t('settings.hint')} onPress={() => router.push('/settings')} last />
      </View>

      <Journal />
    </Screen>
  );
}

/** Your latest episode notes and series reviews: just for you, for now. */
function Journal() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const shows = useLibrary((s) => s.shows);

  const entries = useMemo(() => {
    const out: { key: string; at: number; title: string; detail: string; poster?: string; rating?: number; text?: string; href: string }[] = [];
    for (const show of Object.values(shows)) {
      const byId = new Map(show.episodes.map((e) => [String(e.id), e]));
      const href = `/show/${show.tvmazeId}`;
      for (const [id, note] of Object.entries(show.notes ?? {})) {
        const e = byId.get(id);
        out.push({
          key: `${show.id}-${id}`,
          at: note.at,
          title: show.title,
          detail: e ? `${episodeCode(e)}${e.name ? ` · ${e.name}` : ''}` : t('journal.episode'),
          poster: show.poster,
          rating: note.rating,
          text: note.text,
          href,
        });
      }
      if (show.review) out.push({ key: `${show.id}-review`, at: show.reviewedAt ?? show.addedAt, title: show.title, detail: t('journal.review'), poster: show.poster, rating: show.rating, text: show.review, href });
    }
    return out.sort((a, b) => b.at - a.at).slice(0, JOURNAL);
  }, [shows, t]);

  return (
    <Section title={t('journal.title')}>
      {entries.length === 0 ? (
        <View style={styles.emptyCard}>
          <Icon name="journal" size={22} color={palette.primary} />
          <Text style={styles.emptyText}>{t('journal.empty')}</Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {entries.map((e, i) => (
            <FadeIn key={e.key} index={i} distance={8}>
              <PressableScale depth={0.98} style={styles.entry} onPress={() => router.push(e.href as never)}>
                <Poster uri={e.poster} title={e.title} width={44} kind="show" elevated={false} radius={6} />
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={styles.entryHead}>
                    <Text style={styles.entryTitle} numberOfLines={1}>
                      {e.title}
                    </Text>
                    {e.rating != null && <StarBadge value={e.rating} />}
                  </View>
                  <Text style={styles.entryDetail} numberOfLines={1}>
                    {e.detail} · {relativeDay(e.at)}
                  </Text>
                  {!!e.text && (
                    <Text style={styles.entryText} numberOfLines={3}>
                      {e.text}
                    </Text>
                  )}
                </View>
              </PressableScale>
            </FadeIn>
          ))}
        </View>
      )}
    </Section>
  );
}

function Stat({ icon, value, text, label, index }: { icon: IconName; value?: number; text?: string; label: string; index: number }) {
  const styles = useStyles();
  const { palette } = useTheme();
  const shown = useCountUp(value ?? 0);
  return (
    <FadeIn index={index} style={styles.stat}>
      <Icon name={icon} size={18} color={palette.primary} />
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {text ?? Math.round(shown).toLocaleString()}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </FadeIn>
  );
}

function Row({ icon, label, hint, last, children }: { icon: IconName; label: string; hint?: string; last?: boolean; children: ReactNode }) {
  const styles = useStyles();
  const { palette } = useTheme();
  return (
    <View style={[styles.row, !last && styles.line]}>
      <Icon name={icon} size={20} color={palette.ink} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {!!hint && <Text style={styles.rowHint}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

function ActionRow({ icon, label, hint, last, onPress }: { icon: IconName; label: string; hint?: string; last?: boolean; onPress: () => void }) {
  const { palette } = useTheme();
  return (
    <PressableScale depth={0.98} onPress={onPress} accessibilityLabel={label}>
      <Row icon={icon} label={label} hint={hint} last={last}>
        <Icon name="chevronRight" size={16} color={palette.inkFaint} />
      </Row>
    </PressableScale>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  gear: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface, marginBottom: 2 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  stat: { flexGrow: 1, flexBasis: '45%', padding: 16, gap: 6, borderRadius: radii.lg, backgroundColor: palette.surface },
  statValue: { fontFamily: fonts.bold, fontSize: 26, letterSpacing: -0.8, color: palette.ink },
  statLabel: { ...type.small },
  group: { borderRadius: radii.lg, backgroundColor: palette.surface, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  line: { borderBottomWidth: 1, borderBottomColor: palette.hairline },
  rowLabel: { fontFamily: fonts.medium, fontSize: 15, color: palette.ink },
  rowHint: { ...type.small, fontSize: 12.5, lineHeight: 17 },
  emptyCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radii.lg, backgroundColor: palette.surface },
  emptyText: { ...type.small, flex: 1 },
  entry: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 10, borderRadius: radii.md, backgroundColor: palette.surface },
  entryHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 14.5, color: palette.ink },
  entryDetail: { fontFamily: fonts.body, fontSize: 12.5, color: palette.inkSoft },
  entryText: { fontFamily: fonts.displayItalic, fontSize: 16, lineHeight: 21, color: palette.ink, marginTop: 2 },
}));
