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
import { addMovie, followShow } from '@/lib/actions';
import { countdown } from '@/lib/format';
import { useLibrary } from '@/store/useLibrary';

type Scope = 'all' | 'shows' | 'movies';

/** One field for every show and film; add straight from the results. */
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
  const [loading, setLoading] = useState(false);
  const [discover, setDiscover] = useState<{ shows: SearchResult[]; movies: SearchResult[] }>({ shows: [], movies: [] });
  const request = useRef(0);

  useEffect(() => {
    Promise.all([popularShows(), popularMovies({ tmdbKey, lang: i18n.language })]).then(([s, m]) => setDiscover({ shows: s, movies: m }));
  }, [tmdbKey, i18n.language]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setShows([]);
      setMovies([]);
      setLoading(false);
      return;
    }
    const id = ++request.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      const [s, m] = await Promise.all([
        scope !== 'movies' ? searchShows(query) : Promise.resolve([]),
        scope !== 'shows' ? searchMovies(query, { tmdbKey, lang: i18n.language }) : Promise.resolve([]),
      ]);
      if (id !== request.current) return;
      setShows(s);
      setMovies(m);
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
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { value: 'all', label: t('common.all') },
            { value: 'shows', label: t('common.shows') },
            { value: 'movies', label: t('common.movies') },
          ]}
        />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: insets.bottom + 40, alignItems: 'center' }}>
        <View style={{ width: content, paddingHorizontal: gutter }}>
          {!searching ? (
            <>
              {scope !== 'movies' && discover.shows.length > 0 && (
                <Section title={t('search.onTonight')} style={{ marginTop: 22 }}>
                  <PosterRail items={discover.shows.map((p) => ({ key: p.id, href: `/show/${p.id}`, title: p.title, poster: p.poster, kind: 'show', caption: p.subtitle }))} />
                </Section>
              )}
              {scope !== 'shows' && discover.movies.length > 0 && (
                <Section title={t('search.popularFilms')} style={{ marginTop: 22 }}>
                  <PosterRail
                    items={discover.movies.map((p) => ({ key: p.id, href: `/movie/${p.id}`, title: p.title, poster: p.poster, kind: 'movie', caption: p.year ? String(p.year) : undefined }))}
                  />
                </Section>
              )}
            </>
          ) : loading && !shows.length && !movies.length ? (
            <View style={{ marginTop: 18 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <ResultSkeleton key={i} />
              ))}
            </View>
          ) : !shows.length && !movies.length ? (
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
  const inLibrary = useLibrary((s) => (r.kind === 'show' ? !!s.shows[r.id] : !!s.movies[r.id]));
  const [busy, setBusy] = useState(false);
  const upcoming = r.releaseDate && r.releaseDate > Date.now();
  const meta = [r.year, r.subtitle].filter(Boolean).join(' · ');

  const add = async () => {
    if (inLibrary || busy) return;
    setBusy(true);
    haptics.tap();
    try {
      if (r.kind === 'show') await followShow(r.id);
      else await addMovie(r.id, r);
      haptics.success();
    } catch {
      haptics.warn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <PressableScale depth={0.98} onPress={() => router.push((r.kind === 'show' ? `/show/${r.id}` : `/movie/${r.id}`) as never)} style={styles.row} accessibilityLabel={r.title}>
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
