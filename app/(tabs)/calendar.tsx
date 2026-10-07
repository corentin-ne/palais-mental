import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import Button from '@/components/ui/Button';
import Chips from '@/components/ui/Chips';
import Empty from '@/components/ui/Empty';
import Icon from '@/components/ui/Icon';
import Poster from '@/components/ui/Poster';
import PressableScale from '@/components/ui/PressableScale';
import Screen from '@/components/ui/Screen';
import { FadeIn } from '@/components/ui/Motion';
import { makeStyles, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { useLayout } from '@/hooks/useLayout';
import { countdown, dayKey, fullDate, relativeDay, timeOf } from '@/lib/format';
import { episodeCode } from '@/lib/progress';
import { refreshRelated, relatedHref, relationLabel, visibleRelated } from '@/lib/related';
import { UpcomingEntry, getUpcoming, notificationPermission, refreshLibrary, requestNotifications, scheduleNotifications } from '@/lib/sync';
import { useConnections } from '@/store/useConnections';
import { useLibrary } from '@/store/useLibrary';

type Filter = 'all' | 'shows' | 'movies' | 'related';
const MAX = 200;

/** Every upcoming episode and release among what you follow, day by day. */
export default function CalendarScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const haptics = useHaptics();
  const { gutter, wide } = useLayout();
  const shows = useLibrary((s) => s.shows);
  const movies = useLibrary((s) => s.movies);
  const notificationsOn = useLibrary((s) => s.settings.notifications);
  const relatedOn = useLibrary((s) => s.settings.related);
  const relatedAll = useConnections((s) => s.related.entries);
  const [filter, setFilter] = useState<Filter>('all');
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>('granted');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    notificationPermission().then(setPermission);
  }, []);

  const related = useMemo(() => (relatedOn ? visibleRelated(relatedAll) : []), [relatedOn, relatedAll, shows, movies]);
  const all = useMemo(() => getUpcoming(shows, movies, Date.now(), related), [shows, movies, related]);
  const days = useMemo(() => {
    const list = all.filter((u) => filter === 'all' || u.kind === (filter === 'shows' ? 'episode' : filter === 'movies' ? 'movie' : 'related')).slice(0, MAX);
    const groups: { day: number; entries: UpcomingEntry[] }[] = [];
    for (const u of list) {
      const day = dayKey(u.date);
      const last = groups[groups.length - 1];
      if (last?.day === day) last.entries.push(u);
      else groups.push({ day, entries: [u] });
    }
    return groups;
  }, [all, filter]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshLibrary(true);
    await refreshRelated(true);
    await scheduleNotifications();
    setRefreshing(false);
  }, []);

  const episodes = all.filter((u) => u.kind === 'episode').length;
  const relatedCount = all.filter((u) => u.kind === 'related').length;
  let row = 0;

  return (
    <Screen title={t('calendar.title')} subtitle={t('calendar.subtitle')} refreshing={refreshing} onRefresh={onRefresh}>
      {/* Soft ask, in context, before the system prompt. */}
      {Platform.OS !== 'web' && notificationsOn && permission === 'undetermined' && all.length > 0 && (
        <FadeIn style={styles.ask}>
          <View style={styles.askIcon}>
            <Icon name="bell" size={20} color={palette.onInk} />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={styles.askTitle}>{t('calendar.askTitle')}</Text>
            <Text style={styles.askBody}>{t('calendar.askBody')}</Text>
            <Button
              label={t('calendar.askCta')}
              compact
              style={{ alignSelf: 'flex-start' }}
              onPress={async () => {
                const ok = await requestNotifications();
                haptics.tap();
                setPermission(ok ? 'granted' : 'denied');
                if (ok) scheduleNotifications();
              }}
            />
          </View>
        </FadeIn>
      )}

      <View style={{ marginTop: 14 }}>
        <Chips
          inset={gutter}
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('common.all'), count: all.length },
            { value: 'shows', label: t('common.shows'), count: episodes },
            { value: 'movies', label: t('common.movies'), count: all.length - episodes - relatedCount },
            ...(relatedCount ? [{ value: 'related' as const, label: t('related.chip'), count: relatedCount }] : []),
          ]}
        />
      </View>

      {days.length === 0 ? (
        <Empty icon="calendar" title={t('calendar.emptyTitle')} body={t('calendar.emptyBody')} cta={t('welcome.cta')} onPress={() => router.push('/search')} />
      ) : (
        days.map(({ day, entries }) => (
          <View key={day} style={[styles.day, wide && styles.dayWide]}>
            <FadeIn index={row++} style={[styles.dayHead, wide && { width: 180 }]}>
              <Text style={styles.dayName}>{relativeDay(day)}</Text>
              <Text style={styles.dayDate}>{fullDate(day)}</Text>
            </FadeIn>
            <View style={styles.dayEntries}>
              {entries.map((u) => (
                <FadeIn key={u.kind === 'episode' ? `e${u.episode.id}` : u.kind === 'movie' ? `m${u.movie.id}` : `r${u.related.imdbId}`} index={row++}>
                  <Entry u={u} />
                </FadeIn>
              ))}
            </View>
          </View>
        ))
      )}
    </Screen>
  );
}

function Entry({ u }: { u: UpcomingEntry }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const router = useRouter();
  if (u.kind === 'related') return <RelatedEntry u={u} />;
  const isEp = u.kind === 'episode';
  const title = isEp ? u.show.title : u.movie.title;
  const poster = isEp ? u.show.poster : u.movie.poster;
  return (
    <PressableScale depth={0.98} style={styles.entry} onPress={() => router.push((isEp ? `/show/${u.show.tvmazeId}` : `/movie/${u.movie.id}`) as never)}>
      <Poster uri={poster} title={title} width={46} kind={isEp ? 'show' : 'movie'} elevated={false} radius={7} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.entryTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.entryDetail} numberOfLines={1}>
          {isEp ? `${episodeCode(u.episode)}${u.episode.name ? ` · ${u.episode.name}` : ''}` : t('calendar.release')}
        </Text>
        <Text style={styles.entryMeta} numberOfLines={1}>
          {isEp ? [timeOf(u.date), u.show.network].filter(Boolean).join(' · ') : countdown(u.date)}
        </Text>
      </View>
      {isEp && u.episode.number === 1 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{u.episode.season === 1 ? t('calendar.premiere') : t('calendar.newSeason')}</Text>
        </View>
      )}
    </PressableScale>
  );
}

/** A sequel or a title from the same universe: not followed yet, shown dashed. */
function RelatedEntry({ u }: { u: Extract<UpcomingEntry, { kind: 'related' }> }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const router = useRouter();
  const r = u.related;
  return (
    <PressableScale depth={0.98} style={[styles.entry, styles.entryRelated]} onPress={async () => router.push((await relatedHref(r)) as never)}>
      <Poster uri={r.poster} title={r.title} width={46} kind={r.kind} elevated={false} radius={7} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.entryTitle} numberOfLines={1}>
          {r.title}
        </Text>
        <Text style={styles.entryDetail} numberOfLines={1}>
          {relationLabel(r)}
        </Text>
        <Text style={styles.entryMeta} numberOfLines={1}>
          {countdown(u.date)}
        </Text>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{t(r.relation === 'sequel' ? 'related.sequel' : 'related.universe')}</Text>
      </View>
    </PressableScale>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  ask: { flexDirection: 'row', gap: 14, padding: 16, marginTop: 16, borderRadius: radii.lg, backgroundColor: palette.surface },
  askIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  askTitle: { ...type.bodyMedium },
  askBody: { ...type.small },
  day: { marginTop: 26, gap: 10 },
  dayWide: { flexDirection: 'row', gap: 24 },
  dayHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  dayName: { fontFamily: fonts.bold, fontSize: 19, letterSpacing: -0.4, color: palette.ink },
  dayDate: { fontFamily: fonts.body, fontSize: 13, color: palette.inkFaint },
  dayEntries: { flex: 1, gap: 8 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 10, borderRadius: radii.md, backgroundColor: palette.surface },
  entryRelated: { borderWidth: 1, borderStyle: 'dashed', borderColor: palette.primary, backgroundColor: 'transparent' },
  entryTitle: { fontFamily: fonts.semibold, fontSize: 15, color: palette.ink, letterSpacing: -0.2 },
  entryDetail: { fontFamily: fonts.body, fontSize: 13, color: palette.inkSoft },
  entryMeta: { fontFamily: fonts.medium, fontSize: 12, color: palette.primary },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: palette.primaryTint },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11, color: palette.primary },
}));
