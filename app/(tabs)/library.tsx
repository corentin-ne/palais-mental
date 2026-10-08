import { memo, useEffect, useMemo, useState } from 'react';
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
import { Collection, CollectionItem, artOf, collectionHref, groupCollections, isDone, refreshMovieSeries } from '@/lib/collections';
import { countdown } from '@/lib/format';
import { progressOf, showState } from '@/lib/progress';
import { SHELF_STATES, bookFraction, gameFraction, shelfActivity, shelfState } from '@/lib/shelf';
import { Book, Game, MediaKind, Movie, ShelfState, ShowState } from '@/lib/types';
import { useLibrary } from '@/store/useLibrary';
import { usePrefs } from '@/store/usePrefs';

type Tab = 'shows' | 'movies' | 'books' | 'games';
const TAB_KIND: Record<Tab, MediaKind> = { shows: 'show', movies: 'movie', books: 'book', games: 'game' };
type ShowFilter = 'all' | ShowState;
type MovieFilter = 'watchlist' | 'upcoming' | 'watched';
type Sort = 'recent' | 'title' | 'next' | 'rating';
const SORTS: Sort[] = ['recent', 'title', 'next', 'rating'];
const norm = (s: string) => s.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** A title on its own, or a series kept together (two or more of it in the library; `item` is its first). */
type Unit<T extends CollectionItem> = { item: T; group?: Collection<T> };
const unitsOf = <T extends CollectionItem>(list: T[]): Unit<T>[] => {
  const { singles, groups } = groupCollections(list);
  return [...singles.map((item) => ({ item })), ...groups.map((group) => ({ item: group.members[0].item, group }))];
};
const itemsOf = <T extends CollectionItem>(u: Unit<T>): T[] => (u.group ? u.group.members.map((m) => m.item) : [u.item]);
/** A value over a unit: the item's, or the highest (lowest with `min`) of the series'. */
const over = <T extends CollectionItem>(u: Unit<T>, f: (i: T) => number | undefined, min = false) => {
  const v = itemsOf(u)
    .map(f)
    .filter((x): x is number => x != null);
  return v.length ? (min ? Math.min(...v) : Math.max(...v)) : undefined;
};
const titleOf = <T extends CollectionItem>(u: Unit<T>) => (u.group ? u.group.name : u.item.title);

/** A film series is on the watchlist while one that is out is left, coming soon while only announced ones are, else watched. */
function movieUnitState(u: Unit<Movie>, now: number): MovieFilter {
  const left = itemsOf(u).filter((m) => !m.watchedAt);
  if (left.some((m) => !m.releaseDate || m.releaseDate <= now)) return 'watchlist';
  return left.length ? 'upcoming' : 'watched';
}

/** A book or game series reads like a show: started once you are in it, finished once all of it is. */
function shelfUnitState(u: Unit<Book | Game>, now: number): ShelfState {
  if (!u.group) return shelfState(u.item, now);
  const states = u.group.members.map((m) => shelfState(m.item, now));
  const has = (s: ShelfState) => states.includes(s);
  if (has('started') || (has('finished') && has('want'))) return 'started';
  if (has('want')) return 'want';
  if (has('upcoming')) return 'upcoming';
  return has('finished') ? 'finished' : 'dropped';
}

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
  /** A series: posters stacked. */
  stack?: boolean;
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
  // The tab, filters and sort you left the library on come back next time (prefs, kept across launches).
  const prefs = usePrefs();
  const setPrefs = usePrefs((p) => p.set);
  const pick = <T extends string>(v: string | undefined, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
  const shelfFilter = pick<ShelfState>(prefs.shelfFilter, SHELF_STATES, 'started');
  const setShelfFilter = (shelfFilter: ShelfState) => setPrefs({ shelfFilter });
  // Else open on the first kind you have something of.
  const firstKind: Tab = Object.keys(shows).length ? 'shows' : Object.keys(movies).length ? 'movies' : Object.keys(books).length ? 'books' : Object.keys(games).length ? 'games' : 'shows';
  const tab = pick<Tab>(prefs.libraryTab, ['shows', 'movies', 'books', 'games'], firstKind);
  const setTab = (libraryTab: Tab) => setPrefs({ libraryTab });
  const showFilter = pick<ShowFilter>(prefs.showFilter, ['all', 'watching', 'notStarted', 'upToDate', 'finished', 'dropped'], 'all');
  const setShowFilter = (showFilter: ShowFilter) => setPrefs({ showFilter });
  const movieFilter = pick<MovieFilter>(prefs.movieFilter, ['watchlist', 'upcoming', 'watched'], 'watchlist');
  const setMovieFilter = (movieFilter: MovieFilter) => setPrefs({ movieFilter });
  const [query, setQuery] = useState('');
  const sort = pick<Sort>(prefs.sort, SORTS, 'recent');
  const setSort = (sort: Sort) => setPrefs({ sort });

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

  // Films of the same series come as one poster, like a show (their series is looked up in the background).
  const movieCount = Object.keys(movies).length;
  useEffect(() => {
    refreshMovieSeries();
  }, [movieCount]);
  const movieGroups = useMemo(() => {
    const now = Date.now();
    const groups: Record<MovieFilter, Unit<Movie>[]> = { watchlist: [], upcoming: [], watched: [] };
    for (const u of unitsOf(Object.values(movies))) groups[movieUnitState(u, now)].push(u);
    const added = (u: Unit<Movie>) => over(u, (m) => m.addedAt) ?? 0;
    const watched = (u: Unit<Movie>) => over(u, (m) => m.watchedAt) ?? 0;
    const nextOut = (u: Unit<Movie>) => over(u, (m) => (m.watchedAt || !m.releaseDate || m.releaseDate <= now ? undefined : m.releaseDate), true) ?? Infinity;
    groups.watchlist.sort((a, b) =>
      sort === 'title' ? titleOf(a).localeCompare(titleOf(b)) : sort === 'next' ? (over(b, (m) => m.releaseDate) ?? 0) - (over(a, (m) => m.releaseDate) ?? 0) : added(b) - added(a),
    );
    groups.upcoming.sort((a, b) => nextOut(a) - nextOut(b));
    groups.watched.sort((a, b) =>
      sort === 'title' ? titleOf(a).localeCompare(titleOf(b)) : sort === 'rating' ? (over(b, (m) => m.rating) ?? 0) - (over(a, (m) => m.rating) ?? 0) || watched(b) - watched(a) : watched(b) - watched(a),
    );
    return groups;
  }, [movies, sort]);

  // Books and games share their states: reading or playing, on the list, coming soon, finished, dropped.
  const shelf = useMemo(() => {
    const now = Date.now();
    const list: (Book | Game)[] = tab === 'books' ? Object.values(books) : tab === 'games' ? Object.values(games) : [];
    type U = Unit<Book | Game>;
    const groups: Record<ShelfState, U[]> = { started: [], want: [], upcoming: [], finished: [], dropped: [] };
    for (const u of unitsOf(list)) groups[shelfUnitState(u, now)].push(u);
    const activity = (u: U) => over(u, shelfActivity) ?? 0;
    const release = (u: U) => over(u, (i) => (i.finishedAt ? undefined : i.releaseDate), true);
    const bySort = (a: U, b: U) =>
      sort === 'title'
        ? titleOf(a).localeCompare(titleOf(b))
        : sort === 'rating'
          ? (over(b, (i) => i.rating) ?? 0) - (over(a, (i) => i.rating) ?? 0) || activity(b) - activity(a)
          : sort === 'next'
            ? (release(a) ?? Infinity) - (release(b) ?? Infinity)
            : activity(b) - activity(a);
    for (const state of SHELF_STATES) groups[state].sort(state === 'upcoming' ? (a, b) => (release(a) ?? 0) - (release(b) ?? 0) : bySort);
    return groups;
  }, [tab, books, games, sort]);
  // Open on the first state that has something in it.
  const activeShelf = shelf[shelfFilter].length ? shelfFilter : (SHELF_STATES.find((f) => shelf[f].length) ?? shelfFilter);

  /** A series' poster: the first one's art, and how far through it you are. */
  const groupTile = (kind: 'movie' | 'book' | 'game', c: Collection<CollectionItem>, dim?: boolean): Tile => {
    const list = c.members.map((m) => m.item);
    const done = list.filter((i) => isDone(kind, i)).length;
    return {
      key: `series:${c.key}`,
      href: collectionHref(kind, c, list.find((i) => i.wikidataId)?.wikidataId),
      title: c.name,
      poster: list.map(artOf).find(Boolean),
      caption: t(`collection.tile.${kind}`, { done, count: list.length }),
      progress: done ? done / list.length : undefined,
      dim,
      stack: true,
      search: list.map((i) => i.title).join(' '),
    };
  };

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
        ? movieGroups[movieFilter].map(({ item: m, group }) =>
            group
              ? groupTile('movie', group)
              : {
                  key: m.id,
                  href: `/movie/${m.id}`,
                  title: m.title,
                  poster: m.poster,
                  search: [m.director, ...m.genres].filter(Boolean).join(' '),
                  caption: movieFilter === 'upcoming' && m.releaseDate ? countdown(m.releaseDate) : m.year ? String(m.year) : undefined,
                },
          )
        : shelf[activeShelf].map(({ item, group }) => group ? groupTile(tab === 'books' ? 'book' : 'game', group, activeShelf === 'dropped') : ({
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
const PosterTile = memo(function PosterTile({ href, title, poster, caption, progress, dim, stack, width, kind }: Omit<Tile, 'key' | 'search'> & { width: number; kind: MediaKind }) {
  const router = useRouter();
  const styles = useStyles();
  return (
    <PressableScale onPress={() => router.push(href as never)} style={{ width, gap: 7 }} accessibilityLabel={title}>
      <View>
        {/* A series: the next posters peek out above the first, like a pile. */}
        {stack && (
          <>
            <View style={[styles.pile, { left: 12, right: 12, top: -8, opacity: 0.55 }]} />
            <View style={[styles.pile, { left: 6, right: 6, top: -4 }]} />
          </>
        )}
        <Poster uri={poster} title={title} width={width} kind={kind} progress={progress} dim={dim} />
      </View>
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
  pile: { position: 'absolute', height: 24, borderRadius: 8, backgroundColor: palette.surfaceRaised, borderWidth: 1, borderColor: palette.hairline },
  title: { ...fonts.semibold, fontSize: 13, color: palette.ink },
  caption: { ...fonts.body, fontSize: 11.5, color: palette.inkSoft },
  none: { ...type.small, textAlign: 'center', marginTop: 40 },
  tools: { flexDirection: 'row', gap: 8 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 12, borderRadius: 20, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  searchInput: { flex: 1, height: 40, ...fonts.body, fontSize: 14, color: palette.ink },
  sort: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  sortText: { ...fonts.medium, fontSize: 13, color: palette.ink },
}));
