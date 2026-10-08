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

type Filter = 'all' | 'shows' | 'movies' | 'books' | 'games' | 'related';
const FILTER_KIND: Record<Exclude<Filter, 'all'>, UpcomingEntry['kind']> = { shows: 'episode', movies: 'movie', books: 'book', games: 'game', related: 'related' };
const entryKey = (u: UpcomingEntry) =>
  u.kind === 'episode' ? `e${u.episode.id}` : u.kind === 'movie' ? `m${u.movie.id}` : u.kind === 'book' ? `b${u.book.id}` : u.kind === 'game' ? `g${u.game.id}` : `r${u.related.imdbId}`;
const MAX = 200;

/** Every upcoming episode, film, book and game among what you follow, day by day. */
export default function CalendarScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const haptics = useHaptics();
  const { gutter, wide } = useLayout();
  const shows = useLibrary((s) => s.shows);
  const movies = useLibrary((s) => s.movies);
  const books = useLibrary((s) => s.books);
  const games = useLibrary((s) => s.games);
  const notificationsOn = useLibrary((s) => s.settings.notifications);
  const relatedOn = useLibrary((s) => s.settings.related);
  const relatedAll = useConnections((s) => s.related.entries);
  const [filter, setFilter] = useState<Filter>('all');
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>('granted');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    notificationPermission().then(setPermission);
  }, []);

  const related = useMemo(() => (relatedOn ? visibleRelated(relatedAll) : []), [relatedOn, relatedAll, shows, movies, books, games]);
  const all = useMemo(() => getUpcoming(shows, movies, Date.now(), related, books, games), [shows, movies, related, books, games]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const u of all) c[u.kind] = (c[u.kind] ?? 0) + 1;
    return c;
  }, [all]);
  const days = useMemo(() => {
    const list = all.filter((u) => filter === 'all' || u.kind === FILTER_KIND[filter]).slice(0, MAX);
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
            { value: 'all' as const, label: t('common.all'), count: all.length },
            ...(['shows', 'movies', 'books', 'games', 'related'] as const)
              .filter((f) => counts[FILTER_KIND[f]] || (f === 'shows' || f === 'movies'))
              .map((f) => ({ value: f, label: f === 'related' ? t('related.chip') : t(`common.${f}`), count: counts[FILTER_KIND[f]] ?? 0 })),
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
                <FadeIn key={entryKey(u)} index={row++}>
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
  const { title, poster, href, kind, detail } =
    u.kind === 'episode'
      ? { title: u.show.title, poster: u.show.poster, href: `/show/${u.show.tvmazeId}`, kind: 'show' as const, detail: `${episodeCode(u.episode)}${u.episode.name ? ` · ${u.episode.name}` : ''}` }
      : u.kind === 'movie'
        ? { title: u.movie.title, poster: u.movie.poster, href: `/movie/${u.movie.id}`, kind: 'movie' as const, detail: t('calendar.release') }
        : u.kind === 'book'
          ? { title: u.book.title, poster: u.book.cover, href: `/book/${u.book.id}`, kind: 'book' as const, detail: [t('calendar.bookOut'), u.book.authors[0]].filter(Boolean).join(' · ') }
          : { title: u.game.title, poster: u.game.cover, href: `/game/${u.game.id}`, kind: 'game' as const, detail: [t('calendar.gameOut'), u.game.platforms.slice(0, 3).join(', ')].filter(Boolean).join(' · ') };
  return (
    <PressableScale depth={0.98} style={styles.entry} onPress={() => router.push(href as never)}>
      <Poster uri={poster} title={title} width={46} kind={kind} elevated={false} radius={7} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.entryTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.entryDetail} numberOfLines={1}>
          {detail}
        </Text>
        <Text style={styles.entryMeta} numberOfLines={1}>
          {isEp ? [timeOf(u.date), u.show.network].filter(Boolean).join(' · ') : countdown(u.date)}
        </Text>
      </View>
      {u.kind === 'episode' && u.episode.number === 1 && (
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
        <Text style={styles.badgeText}>{t(r.relation === 'sequel' ? 'related.sequel' : r.relation === 'prequel' ? 'related.prequel' : 'related.universe')}</Text>
      </View>
    </PressableScale>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  ask: { flexDirection: 'row', gap: 14, padding: 16, marginTop: 16, borderRadius: radii.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  askIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  askTitle: { ...type.bodyMedium },
  askBody: { ...type.small },
  day: { marginTop: 26, gap: 10 },
  dayWide: { flexDirection: 'row', gap: 24 },
  dayHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  dayName: { ...fonts.bold, fontSize: 19, letterSpacing: -0.4, color: palette.ink },
  dayDate: { ...fonts.body, fontSize: 13, color: palette.inkFaint },
  dayEntries: { flex: 1, gap: 8 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 10, borderRadius: radii.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  entryRelated: { borderWidth: 1, borderStyle: 'dashed', borderColor: palette.primary, backgroundColor: 'transparent' },
  entryTitle: { ...fonts.semibold, fontSize: 15, color: palette.ink, letterSpacing: -0.2 },
  entryDetail: { ...fonts.body, fontSize: 13, color: palette.inkSoft },
  entryMeta: { ...fonts.medium, fontSize: 12, color: palette.primaryText },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: palette.primaryTint },
  badgeText: { ...fonts.semibold, fontSize: 11, color: palette.primaryText },
}));
