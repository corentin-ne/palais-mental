import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import PosterRail from '@/components/media/PosterRail';
import Icon from '@/components/ui/Icon';
import Poster from '@/components/ui/Poster';
import PressableScale from '@/components/ui/PressableScale';
import Segmented from '@/components/ui/Segmented';
import { Section } from '@/components/ui/Screen';
import { FadeIn, ResultSkeleton } from '@/components/ui/Motion';
import { makeStyles, noOutline, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { useLayout } from '@/hooks/useLayout';
import { SearchResult, popularMovies, popularShows, searchMovies, searchShows } from '@/lib/api';
import { addBook, addGame, addMovie, followShow } from '@/lib/actions';
import { searchBooks, trendingBooks } from '@/lib/books';
import { popularGames, searchGames } from '@/lib/games';
import { countdown } from '@/lib/format';
import { useLibrary } from '@/store/useLibrary';

type Scope = 'all' | 'shows' | 'movies' | 'books' | 'games';
const SCOPES: Scope[] = ['all', 'shows', 'movies', 'books', 'games'];
const hrefOf = (r: SearchResult) => `/${r.kind}/${r.id}`;
const caption = (r: SearchResult) => (r.releaseDate && r.releaseDate > Date.now() ? countdown(r.releaseDate) : r.subtitle ?? (r.year ? String(r.year) : undefined));
const rail = (items: SearchResult[]) => items.map((p) => ({ key: p.id, href: hrefOf(p), title: p.title, poster: p.poster, kind: p.kind, caption: caption(p) }));

/** One field for every show, film, book and game; add straight from the results. */
export default function SearchScreen() {
  const { t, i18n } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { gutter, content, wide, inner, gap } = useLayout();
  const tmdbKey = useLibrary((s) => s.settings.tmdbKey) || undefined;
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [shows, setShows] = useState<SearchResult[]>([]);
  const [movies, setMovies] = useState<SearchResult[]>([]);
  const [books, setBooks] = useState<SearchResult[]>([]);
  const [games, setGames] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [discover, setDiscover] = useState<{ shows: SearchResult[]; movies: SearchResult[]; books: SearchResult[]; games: SearchResult[]; gamesSoon: SearchResult[] }>({
    shows: [],
    movies: [],
    books: [],
    games: [],
    gamesSoon: [],
  });
  const request = useRef(0);

  useEffect(() => {
    Promise.all([popularShows(), popularMovies({ tmdbKey, lang: i18n.language }), trendingBooks(), popularGames(i18n.language)]).then(([s, m, b, g]) =>
      setDiscover({ shows: s, movies: m, books: b, games: g.top, gamesSoon: g.soon }),
    );
  }, [tmdbKey, i18n.language]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setShows([]);
      setMovies([]);
      setBooks([]);
      setGames([]);
      setLoading(false);
      return;
    }
    const id = ++request.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      const wants = (s: Scope) => scope === 'all' || scope === s;
      const none = Promise.resolve([] as SearchResult[]);
      const [s, m, b, g] = await Promise.all([
        wants('shows') ? searchShows(query) : none,
        wants('movies') ? searchMovies(query, { tmdbKey, lang: i18n.language }) : none,
        wants('books') ? searchBooks(query, i18n.language) : none,
        wants('games') ? searchGames(query, i18n.language) : none,
      ]);
      if (id !== request.current) return;
      setShows(s);
      setMovies(m);
      setBooks(b);
      setGames(g);
      setLoading(false);
    }, 280);
    return () => clearTimeout(timer);
  }, [q, scope, tmdbKey, i18n.language]);

  const searching = q.trim().length >= 2;
  const colW = wide ? Math.floor((inner - gap) / 2) : inner;
  const list = (items: SearchResult[]) => (
    <View style={[styles.results, { gap: wide ? gap : 4 }]}>
      {items.map((r, i) => (
        <FadeIn key={`${r.kind}${r.id}`} index={i} distance={8} style={{ width: colW }}>
          <ResultRow r={r} />
        </FadeIn>
      ))}
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + 10 }]}>
      <View style={{ width: content, paddingHorizontal: gutter, gap: 12, alignSelf: 'center' }}>
        <View style={styles.bar}>
          <View style={styles.field}>
            <Icon name="search" size={18} color={palette.inkFaint} />
            <TextInput
              autoFocus
              value={q}
              onChangeText={setQ}
              placeholder={t('search.placeholder')}
              placeholderTextColor={palette.inkFaint}
              returnKeyType="search"
              autoCorrect={false}
              style={[styles.input, noOutline]}
              onSubmitEditing={() => Keyboard.dismiss()}
            />
            {loading ? (
              <ActivityIndicator size="small" color={palette.inkFaint} />
            ) : (
              !!q && (
                <PressableScale onPress={() => setQ('')} accessibilityLabel={t('common.clear')} style={styles.clear}>
                  <Icon name="close" size={12} color={palette.screen} strokeWidth={2.6} />
                </PressableScale>
              )
            )}
          </View>
          <PressableScale onPress={() => router.back()} style={{ paddingVertical: 8 }}>
            <Text style={styles.cancel}>{t('common.cancel')}</Text>
          </PressableScale>
        </View>
        <Segmented value={scope} onChange={setScope} options={SCOPES.map((value) => ({ value, label: t(`common.${value}`) }))} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: insets.bottom + 40, alignItems: 'center' }}>
        <View style={{ width: content, paddingHorizontal: gutter }}>
          {!searching ? (
            <>
              {(scope === 'all' || scope === 'shows') && discover.shows.length > 0 && (
                <Section title={t('search.onTonight')} style={{ marginTop: 22 }}>
                  <PosterRail items={rail(discover.shows)} />
                </Section>
              )}
              {(scope === 'all' || scope === 'movies') && discover.movies.length > 0 && (
                <Section title={t('search.popularFilms')} style={{ marginTop: 22 }}>
                  <PosterRail items={discover.movies.map((p) => ({ ...rail([p])[0], caption: p.year ? String(p.year) : undefined }))} />
                </Section>
              )}
              {(scope === 'all' || scope === 'books') && discover.books.length > 0 && (
                <Section title={t('search.trendingBooks')} style={{ marginTop: 22 }}>
                  <PosterRail items={rail(discover.books)} />
                </Section>
              )}
              {(scope === 'all' || scope === 'games') && discover.games.length > 0 && (
                <Section title={t('search.topGames')} style={{ marginTop: 22 }}>
                  <PosterRail items={rail(discover.games)} />
                </Section>
              )}
              {scope === 'games' && discover.gamesSoon.length > 0 && (
                <Section title={t('search.soonGames')} style={{ marginTop: 22 }}>
                  <PosterRail items={rail(discover.gamesSoon)} />
                </Section>
              )}
            </>
          ) : loading && !shows.length && !movies.length && !books.length && !games.length ? (
            <View style={{ marginTop: 18 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <ResultSkeleton key={i} />
              ))}
            </View>
          ) : !shows.length && !movies.length && !books.length && !games.length ? (
            <Text style={styles.none}>{t('search.none', { q: q.trim() })}</Text>
          ) : (
            <>
              {shows.length > 0 && (
                <Section title={t('common.shows')} style={{ marginTop: 20 }}>
                  {list(scope === 'all' ? shows.slice(0, 6) : shows)}
                </Section>
              )}
              {movies.length > 0 && (
                <Section title={t('common.movies')} style={{ marginTop: 26 }}>
                  {list(scope === 'all' ? movies.slice(0, 8) : movies)}
                </Section>
              )}
              {books.length > 0 && (
                <Section title={t('common.books')} style={{ marginTop: 26 }}>
                  {list(scope === 'all' ? books.slice(0, 6) : books)}
                </Section>
              )}
              {games.length > 0 && (
                <Section title={t('common.games')} style={{ marginTop: 26 }}>
                  {list(scope === 'all' ? games.slice(0, 6) : games)}
                </Section>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function ResultRow({ r }: { r: SearchResult }) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const haptics = useHaptics();
  const inLibrary = useLibrary((s) => !!(r.kind === 'show' ? s.shows : r.kind === 'movie' ? s.movies : r.kind === 'book' ? s.books : s.games)[r.id]);
  const [busy, setBusy] = useState(false);
  const upcoming = r.releaseDate && r.releaseDate > Date.now();
  const meta = [r.year, r.subtitle].filter(Boolean).join(' · ');

  const add = async () => {
    if (inLibrary || busy) return;
    setBusy(true);
    haptics.tap();
    try {
      if (r.kind === 'show') await followShow(r.id);
      else if (r.kind === 'book') await addBook(r.id);
      else if (r.kind === 'game') await addGame(r.id);
      else await addMovie(r.id, r);
      haptics.success();
    } catch {
      haptics.warn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <PressableScale depth={0.98} onPress={() => router.push(hrefOf(r) as never)} style={styles.row} accessibilityLabel={r.title}>
      <Poster uri={r.poster} title={r.title} width={50} kind={r.kind} elevated={false} radius={7} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title} numberOfLines={2}>
          {r.title}
        </Text>
        {!!meta && (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        )}
        {upcoming && <Text style={styles.soon}>{countdown(r.releaseDate!)}</Text>}
      </View>
      <PressableScale
        onPress={add}
        depth={0.85}
        accessibilityLabel={inLibrary ? t('search.added') : t('search.add')}
        style={[styles.add, inLibrary && { backgroundColor: palette.field }]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={palette.onInk} />
        ) : (
          <Icon name={inLibrary ? 'check' : 'plus'} size={18} color={inLibrary ? palette.primary : palette.onInk} strokeWidth={2.4} />
        )}
      </PressableScale>
    </PressableScale>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  root: { flex: 1, backgroundColor: palette.screen },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 14, borderRadius: 23, backgroundColor: palette.surface },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: palette.ink, height: 46 },
  clear: { width: 20, height: 20, borderRadius: 10, backgroundColor: palette.inkFaint, alignItems: 'center', justifyContent: 'center' },
  cancel: { fontFamily: fonts.semibold, fontSize: 15, color: palette.primary },
  results: { flexDirection: 'row', flexWrap: 'wrap' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 8, borderRadius: radii.md, backgroundColor: palette.surface },
  title: { fontFamily: fonts.semibold, fontSize: 15, color: palette.ink, letterSpacing: -0.2 },
  meta: { fontFamily: fonts.body, fontSize: 12.5, color: palette.inkSoft },
  soon: { fontFamily: fonts.semibold, fontSize: 12, color: palette.primary },
  add: { width: 38, height: 38, borderRadius: 19, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  none: { ...type.small, textAlign: 'center', marginTop: 48 },
}));
