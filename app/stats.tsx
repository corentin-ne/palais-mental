import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import Chips from '@/components/ui/Chips';
import Empty from '@/components/ui/Empty';
import { IconName } from '@/components/ui/Icon';
import Poster from '@/components/ui/Poster';
import PressableScale from '@/components/ui/PressableScale';
import Segmented from '@/components/ui/Segmented';
import { Block, Group, Header, useStyles as useListStyles } from '@/components/ui/SettingsList';
import Stat from '@/components/ui/Stat';
import Stepper from '@/components/ui/Stepper';
import { makeStyles, useTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { duration } from '@/lib/format';
import { Bucket, STAT_KINDS, StatKind, Stats, countsOf, statsOf, yearsOf } from '@/lib/stats';
import { Aurora, Meter } from '@/spark';
import { useLibrary } from '@/store/useLibrary';
import { usePrefs } from '@/store/usePrefs';

const KIND_LABEL: Record<StatKind, string> = { show: 'stats.episodes', movie: 'common.movies', book: 'common.books', game: 'common.games' };
const KIND_ICON: Record<StatKind, IconName> = { show: 'series', movie: 'movies', book: 'journal', game: 'gamepad' };
/** Episodes are ticked as they come: a goal only means something for what you finish. */
const GOALS: StatKind[] = ['movie', 'book', 'game'];
const CHART = 110;

/** A year of yours in numbers (or all of them): what you got through, when, which genres, how you rated it, and the goals you set. */
export default function StatsScreen() {
  const { t } = useTranslation();
  const list = useListStyles();
  const styles = useStyles();
  const { palette } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { gutter, content, wide } = useLayout();
  const shows = useLibrary((s) => s.shows);
  const movies = useLibrary((s) => s.movies);
  const books = useLibrary((s) => s.books);
  const games = useLibrary((s) => s.games);
  const thisYear = new Date().getFullYear();
  const [period, setPeriod] = useState(String(thisYear));
  const year = period === 'all' ? undefined : Number(period);

  const lib = useMemo(() => ({ shows, movies, books, games }), [shows, movies, books, games]);
  const years = useMemo(() => [...new Set([thisYear, ...yearsOf(lib)])], [lib, thisYear]);
  const stats = useMemo(() => statsOf(lib, year), [lib, year]);
  const empty = !stats.activeDays;

  return (
    <View style={list.root}>
      <Aurora />
      <Header title={t('stats.title')} top={insets.top} gutter={gutter} width={content} onBack={() => router.back()} backLabel={t('common.back')} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 48, paddingHorizontal: gutter, width: content, alignSelf: 'center' }}>
        <View style={{ marginTop: 10 }}>
          <Chips inset={gutter} value={period} onChange={setPeriod} options={[...years.map((y) => ({ value: String(y), label: String(y) })), { value: 'all', label: t('stats.allTime') }]} />
        </View>

        {empty ? (
          <Empty icon="chart" title={t('stats.emptyTitle')} body={t('stats.emptyBody')} />
        ) : (
          <>
            <View style={[styles.stats, wide && { flexWrap: 'nowrap' }]}>
              <Stat index={0} icon="series" value={stats.episodes} label={t('profile.episodes')} />
              <Stat index={1} icon="clock" text={duration(stats.showMinutes)} label={t('profile.showTime')} />
              <Stat index={2} icon="movies" value={stats.films} label={t('profile.films')} />
              <Stat index={3} icon="clock" text={duration(stats.filmMinutes)} label={t('profile.filmTime')} />
            </View>
            <View style={[styles.stats, { marginTop: 10 }, wide && { flexWrap: 'nowrap' }]}>
              {stats.books > 0 && <Stat index={4} icon="journal" value={stats.books} label={t('profile.books')} />}
              {stats.pages > 0 && <Stat index={5} icon="journal" value={stats.pages} label={t('profile.pages')} />}
              {stats.games > 0 && <Stat index={6} icon="gamepad" value={stats.games} label={t('profile.games')} />}
              <Stat index={7} icon="calendar" value={stats.activeDays} label={t('stats.activeDays')} />
              <Stat index={8} icon="sparkle" value={stats.streak} label={t('stats.streak')} />
            </View>
            {/* Remounted with the period: the chart goes back to a kind that has something to show. */}
            <Chart key={period} buckets={stats.buckets} byYear={year == null} />
          </>
        )}

        {year === thisYear && <Goals year={thisYear} lib={lib} />}

        {!empty && (
          <>
            {stats.genres.length > 0 && (
              <Group index={3} title={t('stats.genres')}>
                <View style={styles.pad}>
                  {stats.genres.map((g) => (
                    <View key={g.name} style={styles.line}>
                      <Text style={styles.name} numberOfLines={1}>
                        {g.name}
                      </Text>
                      <Meter value={g.count / stats.genres[0].count} color={palette.primary} style={{ flex: 1 }} />
                      <Text style={styles.count}>{g.count}</Text>
                    </View>
                  ))}
                </View>
              </Group>
            )}
            <Ratings stats={stats} />
            {stats.topShows.length > 0 && (
              <Group index={5} title={t('stats.topShows')}>
                {stats.topShows.map(({ show, episodes }, i) => (
                  <PressableScale key={show.id} depth={0.98} onPress={() => router.push(`/show/${show.tvmazeId}`)} style={[list.row, i < stats.topShows.length - 1 && list.line]} accessibilityLabel={show.title}>
                    <Poster uri={show.poster} title={show.title} width={34} kind="show" elevated={false} radius={5} />
                    <Text style={[list.rowLabel, { flex: 1 }]} numberOfLines={1}>
                      {show.title}
                    </Text>
                    <Text style={list.rowHint}>{t('upNext.episodes', { count: episodes })}</Text>
                  </PressableScale>
                ))}
              </Group>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** One bar per month (or per year), for one kind at a time: the app has a single accent, not a colour per kind. */
function Chart({ buckets, byYear }: { buckets: Bucket[]; byYear: boolean }) {
  const { t, i18n } = useTranslation();
  const styles = useStyles();
  const kinds = STAT_KINDS.filter((k) => buckets.some((b) => b[k] > 0));
  const [picked, setKind] = useState<StatKind>(kinds[0]);
  const kind = kinds.includes(picked) ? picked : kinds[0];
  if (!kind) return null;
  const max = Math.max(...buckets.map((b) => b[kind]));
  const label = (at: number) => (byYear ? (buckets.length > 6 ? `’${String(at).slice(2)}` : String(at)) : new Date(2001, at, 1).toLocaleDateString(i18n.language, { month: 'narrow' }));
  return (
    <Group index={1} title={t(byYear ? 'stats.byYear' : 'stats.byMonth')}>
      <View style={styles.pad}>
        {kinds.length > 1 && <Segmented<StatKind> value={kind} onChange={setKind} options={kinds.map((k) => ({ value: k, label: t(KIND_LABEL[k]) }))} />}
        <View style={styles.chart}>
          {buckets.map((b) => (
            <View key={b.at} style={styles.column} accessibilityLabel={`${label(b.at)}: ${b[kind]}`}>
              <Text style={styles.barValue} numberOfLines={1}>
                {b[kind] || ''}
              </Text>
              <View style={[styles.bar, b[kind] ? { height: Math.max(4, Math.round((b[kind] / max) * CHART)) } : styles.barNone]} />
              <Text style={styles.barLabel} numberOfLines={1}>
                {label(b.at)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Group>
  );
}

/** How many films, books and games you mean to get through this year, and where you are. */
function Goals({ year, lib }: { year: number; lib: Parameters<typeof countsOf>[0] }) {
  const { t } = useTranslation();
  const list = useListStyles();
  const styles = useStyles();
  const goals = usePrefs((s) => s.goals);
  const set = usePrefs((s) => s.set);
  const counts = useMemo(() => countsOf(lib, year), [lib, year]);
  return (
    <>
      <Group index={2} title={t('stats.goals', { year })}>
        {GOALS.map((kind, i) => {
          const goal = goals[kind] ?? 0;
          return (
            <Block key={kind} icon={KIND_ICON[kind]} tint="" label={t(KIND_LABEL[kind])} last={i === GOALS.length - 1}>
              {goal > 0 && (
                <View style={styles.line}>
                  <Meter value={counts[kind] / goal} style={{ flex: 1 }} />
                  <Text style={styles.count}>{counts[kind] >= goal ? t('stats.goalDone', { count: counts[kind] }) : `${counts[kind]} / ${goal}`}</Text>
                </View>
              )}
              <Stepper value={goal} onChange={(n) => set({ goals: { ...goals, [kind]: Math.round(n) || undefined } })} bigStep={5} max={999} suffix={t('stats.perYear')} label={t(KIND_LABEL[kind])} />
            </Block>
          );
        })}
      </Group>
      <Text style={list.footnote}>{t('stats.goalsHint')}</Text>
    </>
  );
}

/** How many titles got each rating, half a star to five. */
function Ratings({ stats }: { stats: Stats }) {
  const { t, i18n } = useTranslation();
  const styles = useStyles();
  if (stats.average == null) return null;
  const max = Math.max(...stats.ratings);
  return (
    <Group index={4} title={t('stats.ratings')}>
      <View style={styles.pad}>
        <Text style={styles.average}>{t('stats.average', { value: (stats.average / 2).toLocaleString(i18n.language, { maximumFractionDigits: 1 }) })}</Text>
        <View style={[styles.chart, { height: 86 }]}>
          {stats.ratings.map((n, i) => (
            <View key={i} style={styles.column} accessibilityLabel={`${(i + 1) / 2}: ${n}`}>
              <Text style={styles.barValue} numberOfLines={1}>
                {n || ''}
              </Text>
              <View style={[styles.bar, n ? { height: Math.max(4, Math.round((n / max) * 50)) } : styles.barNone]} />
              <Text style={styles.barLabel}>{i % 2 ? (i + 1) / 2 : ''}</Text>
            </View>
          ))}
        </View>
      </View>
    </Group>
  );
}

const useStyles = makeStyles(({ palette, fonts, type }) => ({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  pad: { padding: 14, gap: 12 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { ...fonts.medium, fontSize: 14.5, color: palette.ink, width: 110 },
  average: { ...type.small },
  count: { ...fonts.semibold, fontSize: 13.5, color: palette.inkSoft, minWidth: 22, textAlign: 'right', fontVariant: ['tabular-nums'] },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: CHART + 36 },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { alignSelf: 'stretch', borderRadius: 4, backgroundColor: palette.primary },
  barNone: { height: 2, backgroundColor: palette.fieldActive },
  barValue: { ...fonts.semibold, fontSize: 10.5, color: palette.inkSoft, fontVariant: ['tabular-nums'] },
  barLabel: { ...type.small, fontSize: 11, lineHeight: 14, height: 14 },
}));
