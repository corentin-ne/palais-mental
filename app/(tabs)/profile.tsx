import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import JournalCard, { useJournal } from '@/components/media/JournalCard';
import Icon from '@/components/ui/Icon';
import PressableScale from '@/components/ui/PressableScale';
import Screen, { Section } from '@/components/ui/Screen';
import { ActionRow, useStyles as useListStyles } from '@/components/ui/SettingsList';
import Stat from '@/components/ui/Stat';
import { FadeIn } from '@/components/ui/Motion';
import { makeStyles, useTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { duration } from '@/lib/format';
import { minutesWatched } from '@/lib/progress';
import { pagesRead } from '@/lib/shelf';
import { useLibrary } from '@/store/useLibrary';

const JOURNAL = 8;

/** A few honest numbers, your data and settings, and the notes you kept along the way. */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const { wide } = useLayout();
  const shows = useLibrary((s) => s.shows);
  const movies = useLibrary((s) => s.movies);
  const books = useLibrary((s) => s.books);
  const games = useLibrary((s) => s.games);
  const router = useRouter();
  const list = useListStyles();
  const solo = useLibrary((s) => s.settings.solo);

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

  return (
    <Screen title={t('profile.title')}>
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

      <View style={[list.group, { marginTop: 16 }]}>
        <ActionRow icon="chart" tint="" label={t('stats.title')} hint={t('stats.hint')} onPress={() => router.push('/stats')} />
        {/* Solo mode: Social has no tab of its own, it is one row away from here. */}
        {solo && <ActionRow icon="heart" tint="" label={t('tabs.social')} hint={t('friends.hint')} onPress={() => router.push('/social')} />}
        <ActionRow icon="download" tint="" label={t('profile.data')} hint={t('data.hint')} onPress={() => router.push('/data')} />
        <ActionRow icon="settings" tint="" label={t('settings.title')} hint={t('settings.hint')} onPress={() => router.push('/settings')} last />
      </View>

      <Journal />
    </Screen>
  );
}

/** Your latest notes: episodes, and what you thought of a series, film, book or game. Just for you, for now. */
function Journal() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const all = useJournal();
  const entries = all.slice(0, JOURNAL);

  return (
    <Section
      title={t('journal.title')}
      count={all.length || undefined}
      action={
        all.length > JOURNAL ? (
          <PressableScale onPress={() => router.push('/journal')} style={styles.link}>
            <Text style={styles.linkText}>{t('common.seeAll')}</Text>
            <Icon name="chevronRight" size={14} color={palette.primaryText} strokeWidth={2.2} />
          </PressableScale>
        ) : undefined
      }
    >
      {entries.length === 0 ? (
        <View style={styles.emptyCard}>
          <Icon name="journal" size={22} color={palette.primaryText} />
          <Text style={styles.emptyText}>{t('journal.empty')}</Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {entries.map((e, i) => (
            <FadeIn key={e.key} index={i} distance={8}>
              <JournalCard entry={e} />
            </FadeIn>
          ))}
        </View>
      )}
    </Section>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  emptyCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radii.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  emptyText: { ...type.small, flex: 1 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4 },
  linkText: { ...fonts.semibold, fontSize: 14, color: palette.primaryText },
}));
