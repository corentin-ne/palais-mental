import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import Chips from '@/components/ui/Chips';
import Empty from '@/components/ui/Empty';
import Poster from '@/components/ui/Poster';
import PressableScale from '@/components/ui/PressableScale';
import Screen from '@/components/ui/Screen';
import Segmented from '@/components/ui/Segmented';
import { FadeIn } from '@/components/ui/Motion';
import { makeStyles } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { countdown } from '@/lib/format';
import { progressOf, showState } from '@/lib/progress';
import { ShowState } from '@/lib/types';
import { useLibrary } from '@/store/useLibrary';

type Tab = 'shows' | 'movies';
type ShowFilter = 'all' | ShowState;
type MovieFilter = 'watchlist' | 'upcoming' | 'watched';

interface Tile {
  key: string;
  href: string;
  title: string;
  poster?: string;
  caption?: string;
  progress?: number;
  dim?: boolean;
}

/** Everything you follow, as a wall of posters. */
export default function LibraryScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const router = useRouter();
  const { gutter, gap, poster, columns } = useLayout();
  const shows = useLibrary((s) => s.shows);
  const movies = useLibrary((s) => s.movies);
  const [tab, setTab] = useState<Tab>('shows');
  const [showFilter, setShowFilter] = useState<ShowFilter>('all');
  const [movieFilter, setMovieFilter] = useState<MovieFilter>('watchlist');

  const showTiles = useMemo(() => {
    const now = Date.now();
    return Object.values(shows)
      .map((show) => ({ show, state: showState(show, now), progress: progressOf(show, now) }))
      .sort((a, b) => a.show.title.localeCompare(b.show.title));
  }, [shows]);

  const showCounts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const s of showTiles) {
      c[s.state] = (c[s.state] ?? 0) + 1;
      if (s.state !== 'dropped') c.all++;
    }
    return c;
  }, [showTiles]);

  const movieGroups = useMemo(() => {
    const now = Date.now();
    const list = Object.values(movies);
    return {
      watchlist: list.filter((m) => !m.watchedAt && (!m.releaseDate || m.releaseDate <= now)).sort((a, b) => b.addedAt - a.addedAt),
      upcoming: list.filter((m) => !m.watchedAt && m.releaseDate && m.releaseDate > now).sort((a, b) => a.releaseDate! - b.releaseDate!),
      watched: list.filter((m) => m.watchedAt).sort((a, b) => b.watchedAt! - a.watchedAt!),
    };
  }, [movies]);

  const tiles: Tile[] =
    tab === 'shows'
      ? showTiles
          .filter((s) => (showFilter === 'all' ? s.state !== 'dropped' : s.state === showFilter))
          .map(({ show, state, progress }) => ({
            key: show.id,
            href: `/show/${show.tvmazeId}`,
            title: show.title,
            poster: show.poster,
            progress: state === 'notStarted' ? undefined : progress.fraction,
            dim: state === 'dropped',
            caption:
              state === 'watching'
                ? t('upNext.left', { count: progress.left })
                : state === 'upToDate' && progress.upcoming?.airstamp
                  ? countdown(progress.upcoming.airstamp)
                  : t(`state.${state}`),
          }))
      : movieGroups[movieFilter].map((m) => ({
          key: m.id,
          href: `/movie/${m.id}`,
          title: m.title,
          poster: m.poster,
          caption: movieFilter === 'upcoming' && m.releaseDate ? countdown(m.releaseDate) : m.year ? String(m.year) : undefined,
        }));

  const empty = !Object.keys(shows).length && !Object.keys(movies).length;

  return (
    <Screen title={t('library.title')}>
      {empty ? (
        <Empty icon="grid" title={t('library.emptyTitle')} body={t('library.emptyBody')} cta={t('welcome.cta')} onPress={() => router.push('/search')} />
      ) : (
        <>
          <View style={{ marginTop: 10, gap: 14 }}>
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: 'shows', label: `${t('common.shows')} · ${Object.keys(shows).length}` },
                { value: 'movies', label: `${t('common.movies')} · ${Object.keys(movies).length}` },
              ]}
            />
            {tab === 'shows' ? (
              <Chips
                inset={gutter}
                value={showFilter}
                onChange={setShowFilter}
                options={(['all', 'watching', 'notStarted', 'upToDate', 'finished', 'dropped'] as const)
                  .filter((f) => f === 'all' || showCounts[f])
                  .map((f) => ({ value: f, label: t(`state.${f}`), count: showCounts[f] ?? 0 }))}
              />
            ) : (
              <Chips
                inset={gutter}
                value={movieFilter}
                onChange={setMovieFilter}
                options={(['watchlist', 'upcoming', 'watched'] as const).map((f) => ({ value: f, label: t(`library.${f}`), count: movieGroups[f].length }))}
              />
            )}
          </View>
          {tiles.length === 0 ? (
            <Text style={styles.none}>{t('library.none')}</Text>
          ) : (
            <View style={[styles.grid, { gap, rowGap: gap + 8 }]} key={`${tab}${showFilter}${movieFilter}${columns}`}>
              {tiles.map((tile, i) => (
                <FadeIn key={tile.key} index={i} distance={10}>
                  <PressableScale onPress={() => router.push(tile.href as never)} style={{ width: poster, gap: 7 }} accessibilityLabel={tile.title}>
                    <Poster uri={tile.poster} title={tile.title} width={poster} kind={tab === 'shows' ? 'show' : 'movie'} progress={tile.progress} dim={tile.dim} />
                    <View>
                      <Text style={styles.title} numberOfLines={1}>
                        {tile.title}
                      </Text>
                      {!!tile.caption && (
                        <Text style={styles.caption} numberOfLines={1}>
                          {tile.caption}
                        </Text>
                      )}
                    </View>
                  </PressableScale>
                </FadeIn>
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const useStyles = makeStyles(({ palette, fonts, type }) => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 20 },
  title: { fontFamily: fonts.semibold, fontSize: 13, color: palette.ink },
  caption: { fontFamily: fonts.body, fontSize: 11.5, color: palette.inkSoft },
  none: { ...type.small, textAlign: 'center', marginTop: 40 },
}));
