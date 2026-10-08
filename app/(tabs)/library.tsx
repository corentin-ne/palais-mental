import { memo, useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import Chips from '@/components/ui/Chips';
import Empty from '@/components/ui/Empty';
import Poster from '@/components/ui/Poster';
import PressableScale from '@/components/ui/PressableScale';
import Screen from '@/components/ui/Screen';
import Segmented from '@/components/ui/Segmented';
import { FadeIn } from '@/components/ui/Motion';
import Icon from '@/components/ui/Icon';
import { makeStyles, noOutline, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { useLayout } from '@/hooks/useLayout';
import { useProgressive } from '@/hooks/useProgressive';
import { countdown } from '@/lib/format';
import { progressOf, showState } from '@/lib/progress';
import { SHELF_STATES, bookFraction, gameFraction, shelfActivity, shelfState } from '@/lib/shelf';
import { Book, Game, MediaKind, ShelfState, ShowState } from '@/lib/types';
import { useLibrary } from '@/store/useLibrary';

type Tab = 'shows' | 'movies' | 'books' | 'games';
const TAB_KIND: Record<Tab, MediaKind> = { shows: 'show', movies: 'movie', books: 'book', games: 'game' };
type ShowFilter = 'all' | ShowState;
type MovieFilter = 'watchlist' | 'upcoming' | 'watched';
type Sort = 'recent' | 'title' | 'next' | 'rating';
const SORTS: Sort[] = ['recent', 'title', 'next', 'rating'];
const norm = (s: string) => s.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

interface Tile {
  key: string;
  href: string;
  title: string;
  poster?: string;
  caption?: string;
  progress?: number;
  dim?: boolean;
  /** Also matched by the filter: authors, developer, director, network, genres. */
  search?: string;
}

/** Everything you follow, read and play, as a wall of posters. */
export default function LibraryScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const haptics = useHaptics();
  const router = useRouter();
  const { gutter, gap, poster, columns } = useLayout();
  const shows = useLibrary((s) => s.shows);
  const movies = useLibrary((s) => s.movies);
  const books = useLibrary((s) => s.books);
  const games = useLibrary((s) => s.games);
  const [shelfFilter, setShelfFilter] = useState<ShelfState>('started');
  // Open on the first kind you have something of.
  const [tab, setTab] = useState<Tab>(() => (Object.keys(shows).length ? 'shows' : Object.keys(movies).length ? 'movies' : Object.keys(books).length ? 'books' : Object.keys(games).length ? 'games' : 'shows'));
  const [showFilter, setShowFilter] = useState<ShowFilter>('all');
  const [movieFilter, setMovieFilter] = useState<MovieFilter>('watchlist');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('recent');

  const showTiles = useMemo(() => {
    const now = Date.now();
    return Object.values(shows)
      .map((show) => ({ show, state: showState(show, now), progress: progressOf(show, now), activity: Math.max(show.addedAt, ...Object.values(show.watched)) }))
      .sort((a, b) => {
        if (sort === 'title') return a.show.title.localeCompare(b.show.title);
        if (sort === 'rating') return (b.show.rating ?? 0) - (a.show.rating ?? 0) || b.activity - a.activity;
        if (sort === 'next') return (a.progress.upcoming?.airstamp ?? Infinity) - (b.progress.upcoming?.airstamp ?? Infinity) || a.show.title.localeCompare(b.show.title);
        return b.activity - a.activity;
      });
  }, [shows, sort]);

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
      watchlist: list
        .filter((m) => !m.watchedAt && (!m.releaseDate || m.releaseDate <= now))
        .sort((a, b) => (sort === 'title' ? a.title.localeCompare(b.title) : sort === 'next' ? (b.releaseDate ?? 0) - (a.releaseDate ?? 0) : b.addedAt - a.addedAt)),
      upcoming: list.filter((m) => !m.watchedAt && m.releaseDate && m.releaseDate > now).sort((a, b) => a.releaseDate! - b.releaseDate!),
      watched: list
        .filter((m) => m.watchedAt)
        .sort((a, b) => (sort === 'title' ? a.title.localeCompare(b.title) : sort === 'rating' ? (b.rating ?? 0) - (a.rating ?? 0) || b.watchedAt! - a.watchedAt! : b.watchedAt! - a.watchedAt!)),
    };
  }, [movies, sort]);

  // Books and games share their states: reading or playing, on the list, coming soon, finished, dropped.
  const shelf = useMemo(() => {
    const now = Date.now();
    const list: (Book | Game)[] = tab === 'books' ? Object.values(books) : tab === 'games' ? Object.values(games) : [];
    const groups: Record<ShelfState, (Book | Game)[]> = { started: [], want: [], upcoming: [], finished: [], dropped: [] };
    for (const item of list) groups[shelfState(item, now)].push(item);
    const bySort = (a: Book | Game, b: Book | Game) =>
      sort === 'title'
        ? a.title.localeCompare(b.title)
        : sort === 'rating'
          ? (b.rating ?? 0) - (a.rating ?? 0) || shelfActivity(b) - shelfActivity(a)
          : sort === 'next'
            ? (a.releaseDate ?? Infinity) - (b.releaseDate ?? Infinity)
            : shelfActivity(b) - shelfActivity(a);
    for (const state of SHELF_STATES) groups[state].sort(state === 'upcoming' ? (a, b) => (a.releaseDate ?? 0) - (b.releaseDate ?? 0) : bySort);
    return groups;
  }, [tab, books, games, sort]);
  // Open on the first state that has something in it.
  const activeShelf = shelf[shelfFilter].length ? shelfFilter : (SHELF_STATES.find((f) => shelf[f].length) ?? shelfFilter);

  const shelfCaption = (item: Book | Game, state: ShelfState) => {
    if (state === 'upcoming' && item.releaseDate) return countdown(item.releaseDate);
    if (state === 'started') {
      if (tab === 'books') {
        const b = item as Book;
        return b.page ? (b.pages ? t('book.pageOf', { page: b.page, count: b.pages }) : t('book.pageN', { page: b.page })) : t('book.notStartedPage');
      }
      const g = item as Game;
      return [g.hours ? t('game.hoursN', { count: g.hours }) : undefined, g.percent ? `${g.percent} %` : undefined].filter(Boolean).join(' · ') || t('game.justStarted');
    }
    return tab === 'books' ? ((item as Book).authors[0] ?? (item.year ? String(item.year) : undefined)) : item.year ? String(item.year) : undefined;
  };

  const q = norm(query.trim());
  const allTiles: Tile[] =
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
            search: [show.network, ...show.genres].filter(Boolean).join(' '),
            caption:
              state === 'watching'
                ? t('upNext.left', { count: progress.left })
                : state === 'upToDate' && progress.upcoming?.airstamp
                  ? countdown(progress.upcoming.airstamp)
                  : t(`state.${state}`),
          }))
      : tab === 'movies'
        ? movieGroups[movieFilter].map((m) => ({
            key: m.id,
            href: `/movie/${m.id}`,
            title: m.title,
            poster: m.poster,
            search: [m.director, ...m.genres].filter(Boolean).join(' '),
            caption: movieFilter === 'upcoming' && m.releaseDate ? countdown(m.releaseDate) : m.year ? String(m.year) : undefined,
          }))
        : shelf[activeShelf].map((item) => ({
            key: item.id,
            href: `/${TAB_KIND[tab]}/${item.id}`,
            title: item.title,
            poster: item.cover,
            caption: shelfCaption(item, activeShelf),
            progress: activeShelf === 'started' ? (tab === 'books' ? bookFraction(item as Book) : gameFraction(item as Game)) : undefined,
            dim: activeShelf === 'dropped',
            search: tab === 'books' ? [...(item as Book).authors, ...(item as Book).subjects, (item as Book).series?.name].filter(Boolean).join(' ') : [(item as Game).developer, ...(item as Game).platforms, ...(item as Game).genres, item.series?.name].filter(Boolean).join(' '),
          }));

  const tiles = q ? allTiles.filter((tile) => norm(tile.title).includes(q) || (!!tile.search && norm(tile.search).includes(q))) : allTiles;
  const gridKey = `${tab}${showFilter}${movieFilter}${activeShelf}${columns}`;
  const shown = useProgressive(tiles.length, `${gridKey}${q}${sort}`);
  const empty = !Object.keys(shows).length && !Object.keys(movies).length && !Object.keys(books).length && !Object.keys(games).length;

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
              options={(['shows', 'movies', 'books', 'games'] as const).map((value) => ({ value, label: t(`common.${value}`) }))}
            />
            <View style={styles.tools}>
              <View style={styles.search}>
                <Icon name="search" size={16} color={palette.inkFaint} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('library.filter')}
                  placeholderTextColor={palette.inkFaint}
                  autoCorrect={false}
                  style={[styles.searchInput, noOutline]}
                />
              </View>
              <PressableScale
                depth={0.92}
                style={styles.sort}
                accessibilityLabel={t('library.sortBy')}
                onPress={() => {
                  haptics.select();
                  setSort(SORTS[(SORTS.indexOf(sort) + 1) % SORTS.length]);
                }}
              >
                <Icon name="settings" size={16} color={palette.ink} />
                <Text style={styles.sortText}>{t(`library.sort.${sort}`)}</Text>
              </PressableScale>
            </View>
            {tab === 'shows' ? (
              <Chips
                inset={gutter}
                value={showFilter}
                onChange={setShowFilter}
                options={(['all', 'watching', 'notStarted', 'upToDate', 'finished', 'dropped'] as const)
                  .filter((f) => f === 'all' || showCounts[f])
                  .map((f) => ({ value: f, label: t(`state.${f}`), count: showCounts[f] ?? 0 }))}
              />
            ) : tab === 'movies' ? (
              <Chips
                inset={gutter}
                value={movieFilter}
                onChange={setMovieFilter}
                options={(['watchlist', 'upcoming', 'watched'] as const).map((f) => ({ value: f, label: t(`library.${f}`), count: movieGroups[f].length }))}
              />
            ) : (
              <Chips
                inset={gutter}
                value={activeShelf}
                onChange={setShelfFilter}
                options={SHELF_STATES.filter((f) => f === 'started' || f === 'want' || shelf[f].length).map((f) => ({
                  value: f,
                  label: t(`shelf.${tab === 'books' ? 'book' : 'game'}.${f}`),
                  count: shelf[f].length,
                }))}
              />
            )}
          </View>
          {tiles.length === 0 ? (
            <Text style={styles.none}>{t('library.none')}</Text>
          ) : (
            <View style={[styles.grid, { gap, rowGap: gap + 8 }]} key={gridKey}>
              {tiles.slice(0, shown).map(({ key, search: _search, ...tile }, i) => (
                <FadeIn key={key} index={i} distance={10}>
                  <PosterTile {...tile} width={poster} kind={TAB_KIND[tab]} />
                </FadeIn>
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

/** One poster of the wall. Unchanged tiles skip re-rendering while you type or tick things elsewhere. */
const PosterTile = memo(function PosterTile({ href, title, poster, caption, progress, dim, width, kind }: Omit<Tile, 'key' | 'search'> & { width: number; kind: MediaKind }) {
  const router = useRouter();
  const styles = useStyles();
  return (
    <PressableScale onPress={() => router.push(href as never)} style={{ width, gap: 7 }} accessibilityLabel={title}>
      <Poster uri={poster} title={title} width={width} kind={kind} progress={progress} dim={dim} />
      <View>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {!!caption && (
          <Text style={styles.caption} numberOfLines={1}>
            {caption}
          </Text>
        )}
      </View>
    </PressableScale>
  );
});

const useStyles = makeStyles(({ palette, fonts, type }) => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 20 },
  title: { fontFamily: fonts.semibold, fontSize: 13, color: palette.ink },
  caption: { fontFamily: fonts.body, fontSize: 11.5, color: palette.inkSoft },
  none: { ...type.small, textAlign: 'center', marginTop: 40 },
  tools: { flexDirection: 'row', gap: 8 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 12, borderRadius: 20, backgroundColor: palette.surface },
  searchInput: { flex: 1, height: 40, fontFamily: fonts.body, fontSize: 14, color: palette.ink },
  sort: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: palette.surface },
  sortText: { fontFamily: fonts.medium, fontSize: 13, color: palette.ink },
}));
