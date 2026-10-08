import { useMemo } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import Empty from '@/components/ui/Empty';
import Icon from '@/components/ui/Icon';
import Poster from '@/components/ui/Poster';
import PressableScale from '@/components/ui/PressableScale';
import { FadeIn } from '@/components/ui/Motion';
import { makeStyles, useTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { dayKey, relativeDay, timeOf } from '@/lib/format';
import { episodeCode } from '@/lib/progress';
import type { MediaKind } from '@/lib/types';
import { useLibrary } from '@/store/useLibrary';
import { Aurora } from '@/spark';

type Row =
  | { type: 'day'; key: string; day: number }
  | { type: 'item'; key: string; at: number; title: string; detail: string; poster?: string; kind: MediaKind; href: string };

const LIMIT = 300;

/** Everything you watched, read and played, most recent first. */
export default function HistoryScreen() {
  const { t } = useTranslation();
  const { palette, type } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { gutter, content } = useLayout();
  const shows = useLibrary((s) => s.shows);
  const movies = useLibrary((s) => s.movies);
  const books = useLibrary((s) => s.books);
  const games = useLibrary((s) => s.games);

  const rows = useMemo(() => {
    const events: Extract<Row, { type: 'item' }>[] = [];
    for (const show of Object.values(shows)) {
      const byId = new Map(show.episodes.map((e) => [String(e.id), e]));
      for (const [id, at] of Object.entries(show.watched)) {
        const e = byId.get(id);
        if (!e) continue;
        events.push({ type: 'item', key: `e${id}`, at, title: show.title, detail: `${episodeCode(e)}${e.name ? ` · ${e.name}` : ''}`, poster: show.poster, kind: 'show', href: `/show/${show.tvmazeId}` });
      }
    }
    for (const m of Object.values(movies))
      if (m.watchedAt) events.push({ type: 'item', key: `m${m.id}`, at: m.watchedAt, title: m.title, detail: t('history.film'), poster: m.poster, kind: 'movie', href: `/movie/${m.id}` });
    for (const b of Object.values(books)) {
      const base = { type: 'item' as const, title: b.title, poster: b.cover, kind: 'book' as const, href: `/book/${b.id}` };
      if (b.finishedAt) events.push({ ...base, key: `bf${b.id}`, at: b.finishedAt, detail: t('history.bookFinished') });
      if (b.startedAt && b.startedAt !== b.finishedAt) events.push({ ...base, key: `bs${b.id}`, at: b.startedAt, detail: t('history.bookStarted') });
    }
    for (const g of Object.values(games)) {
      const base = { type: 'item' as const, title: g.title, poster: g.cover, kind: 'game' as const, href: `/game/${g.id}` };
      if (g.finishedAt) events.push({ ...base, key: `gf${g.id}`, at: g.finishedAt, detail: t('history.gameFinished') });
      if (g.startedAt && g.startedAt !== g.finishedAt) events.push({ ...base, key: `gs${g.id}`, at: g.startedAt, detail: t('history.gameStarted') });
    }
    events.sort((a, b) => b.at - a.at);
    const out: Row[] = [];
    let last = -1;
    for (const ev of events.slice(0, LIMIT)) {
      const day = dayKey(ev.at);
      if (day !== last) out.push({ type: 'day', key: `d${day}`, day });
      last = day;
      out.push(ev);
    }
    return out;
  }, [shows, movies, books, games, t]);

  return (
    <View style={styles.root}>
      <Aurora />
      <View style={[styles.header, { paddingTop: insets.top + 8, paddingHorizontal: gutter, width: content }]}>
        <PressableScale onPress={() => router.back()} style={styles.back} accessibilityLabel={t('common.back')}>
          <Icon name="back" size={20} color={palette.ink} strokeWidth={2.2} />
        </PressableScale>
        <Text style={type.hero}>{t('history.title')}</Text>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingHorizontal: gutter, width: content, alignSelf: 'center' }}
        ListEmptyComponent={<Empty icon="clock" title={t('history.emptyTitle')} body={t('history.emptyBody')} />}
        renderItem={({ item, index }) =>
          item.type === 'day' ? (
            <Text style={styles.day}>{relativeDay(item.day)}</Text>
          ) : (
            <FadeIn index={Math.min(index, 12)} distance={8}>
              <PressableScale depth={0.98} style={styles.row} onPress={() => router.push(item.href as never)}>
                <Poster uri={item.poster} title={item.title} width={40} kind={item.kind} elevated={false} radius={6} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.detail} numberOfLines={1}>
                    {item.detail}
                  </Text>
                </View>
                <Text style={styles.time}>{timeOf(item.at)}</Text>
              </PressableScale>
            </FadeIn>
          )
        }
      />
    </View>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii }) => ({
  root: { flex: 1, backgroundColor: palette.screen, alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 8 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  day: { ...fonts.bold, fontSize: 17, color: palette.ink, marginTop: 22, marginBottom: 8, letterSpacing: -0.3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, marginBottom: 6, borderRadius: radii.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  title: { ...fonts.semibold, fontSize: 14.5, color: palette.ink },
  detail: { ...fonts.body, fontSize: 12.5, color: palette.inkSoft },
  time: { ...fonts.medium, fontSize: 12, color: palette.inkFaint },
}));
