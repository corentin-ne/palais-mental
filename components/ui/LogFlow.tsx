import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';

import Sheet from './Sheet';
import Icon from './Icon';
import CoverArt from './CoverArt';
import PressableScale from './PressableScale';
import { Button, Field, RatingStars, Segmented, Stepper } from './Controls';
import { FadeIn, Pop, ResultSkeleton } from './Motion';
import { noOutline, makeStyles, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { CatalogResult, TvmazeSeason, fetchSeasons, searchAll, searchCategory } from '@/lib/catalog';
import { CATEGORY_SPECS } from '@/lib/itemVisuals';
import { itemMeta } from '@/lib/format';
import { decorUnlockedAt, roomProgress } from '@/lib/milestones';
import { CATEGORIES, CategoryId } from '@/lib/types';
import { DEFAULT_EPISODES, getSeriesProgress, usePalaceStore } from '@/store/usePalaceStore';
import { LogDraft, useUiStore } from '@/store/useUiStore';

const DEBOUNCE_MS = 300;

/**
 * The heart of the app: search → tap the right cover → confirm. A few letters and two
 * taps for a typical addition; manual entry is always one row away.
 */
export default function LogFlow() {
  const log = useUiStore((s) => s.log);
  const closeLog = useUiStore((s) => s.closeLog);
  const { t } = useTranslation();
  return (
    <Sheet visible={log.stage !== 'closed'} onClose={closeLog} maxHeight={0.93} accessibilityLabel={t('log.cancel')}>
      {log.stage === 'confirm' && log.draft ? <ConfirmPane key={log.draft.title} draft={log.draft} /> : <SearchPane />}
    </Sheet>
  );
}

// ------------------------------------------------------------------ Search
type Groups = { category: CategoryId; results: CatalogResult[] }[];

function SearchPane() {
  const { t, i18n } = useTranslation();
  const { palette, type } = useTheme();
  const styles = useStyles();
  const category = useUiStore((s) => s.log.category);
  const setCategory = useUiStore((s) => s.setSearchCategory);
  const confirm = useUiStore((s) => s.confirm);
  const closeLog = useUiStore((s) => s.closeLog);
  const findExisting = usePalaceStore((s) => s.findExisting);
  const recentSearches = usePalaceStore((s) => s.recentSearches);
  const rememberSearch = usePalaceStore((s) => s.rememberSearch);
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<Groups>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setGroups([]);
      setLoading(false);
      setSearched(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      const opts = { lang: i18n.language, signal: ctrl.signal };
      const next: Groups =
        category === 'all' ? await searchAll(q, opts) : [{ category, results: await searchCategory(category, q, opts) }];
      if (ctrl.signal.aborted) return;
      setGroups(next.filter((g) => g.results.length));
      setLoading(false);
      setSearched(true);
      setGeneration((g) => g + 1);
    }, DEBOUNCE_MS);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [query, category, i18n.language]);

  const pick = (r: CatalogResult) => {
    rememberSearch(query);
    confirm({
      category: r.category,
      title: r.title,
      creator: r.creator,
      year: r.year,
      releaseDate: r.releaseDate,
      coverUrl: r.coverUrl,
      season: r.season,
      episodeCount: r.episodeCount,
      tvmazeId: r.tvmazeId,
      source: r.source,
    });
  };

  const manual = () =>
    confirm({ category: category === 'all' ? 'movies' : category, title: query.trim(), source: { provider: 'manual', id: '' } });

  const scopes: (CategoryId | 'all')[] = ['all', ...CATEGORIES];
  const q = query.trim();
  let row = 0;

  return (
    <>
      <View style={styles.searchRow}>
        <View style={styles.search}>
          <Icon name="search" size={19} color={palette.inkSoft} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => rememberSearch(query)}
            placeholder={t(category === 'all' ? 'log.searchAll' : `log.search.${category}`)}
            placeholderTextColor={palette.inkFaint}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
          />
          {!!query && (
            <PressableScale onPress={() => setQuery('')} hitSlop={10} accessibilityLabel={t('log.clear')}>
              <Icon name="close" size={16} color={palette.inkFaint} />
            </PressableScale>
          )}
        </View>
        <PressableScale onPress={closeLog} accessibilityLabel={t('log.cancel')} style={styles.roundBtn} hitSlop={8}>
          <Icon name="close" size={18} />
        </PressableScale>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroller} contentContainerStyle={styles.chips}>
        {scopes.map((s) => {
          const active = s === category;
          return (
            <PressableScale key={s} onPress={() => setCategory(s)} style={[styles.chip, active && styles.chipActive]} accessibilityState={{ selected: active }}>
              {s !== 'all' && <Icon name={s} size={15} color={active ? palette.onInk : palette.inkSoft} strokeWidth={2} />}
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{s === 'all' ? t('library.all') : t(`categories.${s}`)}</Text>
            </PressableScale>
          );
        })}
      </ScrollView>

      {q.length < 2 ? (
        <Suggestions recent={recentSearches} onPick={setQuery} />
      ) : (
        <View style={{ gap: 18 }}>
          {loading && !searched && (
            <View>
              {[0, 1, 2, 3].map((i) => (
                <ResultSkeleton key={i} />
              ))}
            </View>
          )}
          {groups.map((g) => (
            <View key={`${g.category}-${generation}`} style={{ gap: 2 }}>
              {category === 'all' && <Text style={type.label}>{t(`categories.${g.category}`)}</Text>}
              {g.results.map((r) => (
                <FadeIn key={r.key} index={row++} distance={10}>
                  <ResultRow result={r} inPalace={!!findExisting(r.category, r.title, r.source)} onPress={() => pick(r)} />
                </FadeIn>
              ))}
            </View>
          ))}
          {searched && !loading && groups.length === 0 && <Text style={[type.small, styles.center]}>{t('log.noResults')}</Text>}
          <PressableScale onPress={manual} style={styles.manual} depth={0.98}>
            <View style={styles.manualIcon}>
              <Icon name="plus" size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={type.bodyMedium} numberOfLines={1}>
                {t('log.addManually', { title: q })}
              </Text>
              <Text style={type.small}>{t('log.addManuallyHint')}</Text>
            </View>
          </PressableScale>
        </View>
      )}
    </>
  );
}

function ResultRow({ result, inPalace, onPress }: { result: CatalogResult; inPalace: boolean; onPress: () => void }) {
  const { t, i18n } = useTranslation();
  const { type } = useTheme();
  const styles = useStyles();
  const upcoming = result.releaseDate && result.releaseDate > Date.now();
  const meta = [
    result.creator,
    result.year,
    result.season && result.source.provider === 'itunes' ? t('series.season', { season: result.season }) : undefined,
    result.episodeCount ? t('log.episodesCount', { count: result.episodeCount }) : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <PressableScale onPress={onPress} style={styles.result} depth={0.98}>
      <CoverArt uri={result.coverUrl} title={result.title} category={result.category} width={48} aspect={2 / 3} radius={6} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.resultTitle} numberOfLines={2}>
          {result.title}
        </Text>
        {!!meta && (
          <Text style={type.small} numberOfLines={1}>
            {meta}
          </Text>
        )}
        {upcoming && (
          <Text style={styles.upcoming}>
            {t('log.comingOn', { date: new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(result.releaseDate!)) })}
          </Text>
        )}
      </View>
      {inPalace ? (
        <View style={styles.inPalace}>
          <Icon name="check" size={14} strokeWidth={2.4} />
        </View>
      ) : (
        <Icon name="plus" size={18} strokeWidth={2} />
      )}
    </PressableScale>
  );
}

/** Empty query: recent searches and series in progress, so the next addition starts from recognition, not recall. */
function Suggestions({ recent, onPick }: { recent: string[]; onPick: (q: string) => void }) {
  const { t } = useTranslation();
  const { type, palette } = useTheme();
  const styles = useStyles();
  const items = usePalaceStore((s) => s.items);
  const selectItem = usePalaceStore((s) => s.selectItem);
  const closeLog = useUiStore((s) => s.closeLog);
  const watching = useMemo(
    () =>
      Object.values(items)
        .filter((i) => i.category === 'series' && !getSeriesProgress(i).allComplete)
        .sort((a, b) => b.updatedAt! - a.updatedAt!)
        .slice(0, 4),
    [items],
  );
  if (!recent.length && !watching.length) return <Text style={[type.serif, styles.center]}>{t('log.searchHint')}</Text>;
  return (
    <View style={{ gap: 18 }}>
      {recent.length > 0 && (
        <View style={{ gap: 10 }}>
          <Text style={type.label}>{t('log.recentSearches')}</Text>
          <View style={styles.recentWrap}>
            {recent.map((r, i) => (
              <FadeIn key={r} index={i} distance={6}>
                <PressableScale onPress={() => onPick(r)} style={styles.recentChip}>
                  <Icon name="search" size={13} color={palette.inkSoft} />
                  <Text style={styles.chipText}>{r}</Text>
                </PressableScale>
              </FadeIn>
            ))}
          </View>
        </View>
      )}
      {watching.length > 0 && (
        <View style={{ gap: 4 }}>
          <Text style={type.label}>{t('series.continue')}</Text>
          {watching.map((i, n) => (
            <FadeIn key={i.id} index={n}>
              <PressableScale
                onPress={() => {
                  closeLog();
                  selectItem(i.id);
                }}
                style={styles.result}
                depth={0.98}
              >
                <CoverArt uri={i.coverUrl} title={i.title} category={i.category} width={48} aspect={2 / 3} radius={6} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.resultTitle} numberOfLines={1}>
                    {i.title}
                  </Text>
                  <Text style={type.small} numberOfLines={1}>
                    {itemMeta(i) || t(`categories.${i.category}`)}
                  </Text>
                </View>
                <Icon name="chevronRight" size={18} color={palette.inkFaint} />
              </PressableScale>
            </FadeIn>
          ))}
        </View>
      )}
    </View>
  );
}

// ------------------------------------------------------------------ Confirm
function ConfirmPane({ draft }: { draft: LogDraft }) {
  const { t, i18n } = useTranslation();
  const { palette, type, radii } = useTheme();
  const styles = useStyles();
  const pathname = usePathname();
  const haptics = useHaptics();
  const back = useUiStore((s) => s.backToSearch);
  const closeLog = useUiStore((s) => s.closeLog);
  const showToast = useUiStore((s) => s.showToast);
  const manual = !draft.source || draft.source.provider === 'manual';

  const [category, setCategory] = useState<CategoryId>(draft.category);
  const [title, setTitle] = useState(draft.title);
  const [creator, setCreator] = useState(draft.creator ?? '');
  const [year, setYear] = useState(draft.year ? String(draft.year) : '');
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState('');
  const [season, setSeason] = useState(draft.season ?? 1);
  const [episodes, setEpisodes] = useState(draft.episodeCount ?? DEFAULT_EPISODES);
  const [whole, setWhole] = useState<'whole' | 'watching'>('watching');
  const [seasons, setSeasons] = useState<TvmazeSeason[]>([]);

  const existing = usePalaceStore((s) => s.findExisting(category, title, draft.source));
  const selectItem = usePalaceStore((s) => s.selectItem);
  const awaited = !!draft.releaseDate && draft.releaseDate > Date.now();

  // TVmaze knows every season's length: pre-fill episodes so nobody has to count.
  useEffect(() => {
    if (!draft.tvmazeId) return;
    let alive = true;
    fetchSeasons(draft.tvmazeId).then((list) => alive && setSeasons(list));
    return () => {
      alive = false;
    };
  }, [draft.tvmazeId]);
  useEffect(() => {
    const s = seasons.find((x) => x.number === season);
    if (s?.episodeOrder) setEpisodes(s.episodeOrder);
  }, [season, seasons]);

  const spec = CATEGORY_SPECS[category];

  const submit = () => {
    if (!title.trim()) return;
    const s = usePalaceStore.getState();
    const onPalace = pathname === '/';
    const countBefore = s.order[category].length;
    const totalBefore = Object.keys(s.items).length;
    const { id } = s.addItem(
      category,
      { title, creator, year: year ? Number(year) : undefined, rating, note, coverUrl: draft.coverUrl },
      {
        source: manual ? { provider: 'manual', id: '' } : draft.source,
        releaseDate: draft.releaseDate,
        tvmazeId: draft.tvmazeId,
        season,
        episodeCount: episodes,
        seasonComplete: whole === 'whole',
        animate: onPalace,
      },
    );
    if (onPalace) s.setFocus(category);
    haptics.success();
    closeLog();

    // Peak moments: a new decor object or a bigger room beats a plain confirmation.
    const decor = decorUnlockedAt(category, countBefore + 1);
    const before = roomProgress(totalBefore);
    const after = roomProgress(totalBefore + 1);
    const message =
      after.level > before.level
        ? t('toast.roomGrew')
        : decor && countBefore > 0
          ? t('toast.decor', { object: t(`decor.${decor}`), category: t(`categories.${category}`) })
          : awaited
            ? t('toast.awaited', { title: title.trim() })
            : t('toast.placed', { title: title.trim() });
    showToast(message, onPalace ? undefined : { kind: 'see', itemId: id });
  };

  if (existing) {
    return (
      <>
        <Head back={back} close={closeLog} label={t('log.alreadyTitle')} />
        <FadeIn style={styles.hero}>
          <CoverArt uri={existing.coverUrl ?? draft.coverUrl} title={existing.title} category={existing.category} width={104} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.titleText}>{existing.title}</Text>
            <Text style={type.small}>{t('log.alreadyBody')}</Text>
          </View>
        </FadeIn>
        <Button
          label={t('log.openIt')}
          icon="chevronRight"
          onPress={() => {
            closeLog();
            selectItem(existing.id);
          }}
        />
      </>
    );
  }

  return (
    <>
      <Head back={back} close={closeLog} label={t(awaited ? 'log.awaitTitle' : 'log.confirmTitle')} />

      <FadeIn style={styles.hero}>
        <CoverArt uri={draft.coverUrl} title={title} category={category} width={104} radius={radii.sm} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={[styles.catPill, { backgroundColor: spec.tint }]}>
            <Icon name={category} size={13} color={spec.accent} strokeWidth={2.2} />
            <Text style={[styles.catPillText, { color: spec.accent }]}>{t(`categories.${category}`)}</Text>
          </View>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('log.titleLabel')}
            placeholderTextColor={palette.inkFaint}
            style={styles.titleInput}
            multiline
            maxLength={120}
            autoFocus={manual && !title}
          />
          <TextInput
            value={creator}
            onChangeText={setCreator}
            placeholder={t(`creator.${category}`)}
            placeholderTextColor={palette.inkFaint}
            style={styles.metaInput}
            maxLength={80}
          />
          <TextInput
            value={year}
            onChangeText={(v) => setYear(v.replace(/[^0-9]/g, '').slice(0, 4))}
            placeholder={t('log.year')}
            placeholderTextColor={palette.inkFaint}
            keyboardType="number-pad"
            style={styles.metaInput}
            maxLength={4}
          />
        </View>
      </FadeIn>

      {manual && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroller} contentContainerStyle={styles.chips}>
          {CATEGORIES.map((c) => {
            const active = c === category;
            return (
              <PressableScale key={c} onPress={() => setCategory(c)} style={[styles.chip, active && styles.chipActive]}>
                <Icon name={c} size={15} color={active ? palette.onInk : palette.inkSoft} strokeWidth={2} />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(`categories.${c}`)}</Text>
              </PressableScale>
            );
          })}
        </ScrollView>
      )}

      {awaited && (
        <FadeIn index={1} style={styles.banner}>
          <Icon name="bell" size={17} color={palette.ink} />
          <Text style={[type.small, { flex: 1, color: palette.ink }]}>
            {t('log.awaitBody', {
              date: new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(draft.releaseDate!)),
            })}
          </Text>
        </FadeIn>
      )}

      {category === 'series' && (
        <FadeIn index={2} style={styles.block}>
          <Segmented<'whole' | 'watching'>
            value={whole}
            onChange={setWhole}
            options={[
              { value: 'watching', label: t('log.stillWatching') },
              { value: 'whole', label: t('log.wholeSeason') },
            ]}
          />
          <View style={styles.rowBetween}>
            <Text style={type.bodyMedium}>{t('series.season', { season })}</Text>
            <Stepper value={season} onChange={setSeason} min={1} max={seasons.length || 60} />
          </View>
          <View style={styles.rowBetween}>
            <Text style={type.bodyMedium}>{t('series.episodesLabel')}</Text>
            <Stepper value={episodes} onChange={setEpisodes} />
          </View>
        </FadeIn>
      )}

      {!awaited && (
        <FadeIn index={3} style={styles.rowBetween}>
          <Text style={type.label}>{t('log.rating')}</Text>
          <Pop trigger={rating}>
            <RatingStars value={rating} onChange={setRating} size={30} />
          </Pop>
        </FadeIn>
      )}

      <FadeIn index={4}>
        <Field value={note} onChangeText={setNote} placeholder={t('log.notePlaceholder')} multiline maxLength={600} style={styles.note} />
      </FadeIn>

      <Button label={t(awaited ? 'log.await' : 'log.submit')} icon={awaited ? 'bell' : 'check'} onPress={submit} disabled={!title.trim()} />
    </>
  );
}

function Head({ back, close, label }: { back: () => void; close: () => void; label: string }) {
  const { t } = useTranslation();
  const { type } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.confirmHead}>
      <PressableScale onPress={back} accessibilityLabel={t('log.back')} style={styles.roundBtn} hitSlop={8}>
        <Icon name="back" size={18} />
      </PressableScale>
      <Text style={type.label}>{label}</Text>
      <PressableScale onPress={close} accessibilityLabel={t('log.cancel')} style={styles.roundBtn} hitSlop={8}>
        <Icon name="close" size={18} />
      </PressableScale>
    </View>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii }) => ({
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: palette.field,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    height: 50,
  },
  searchInput: { ...(noOutline as object), flex: 1, fontFamily: fonts.medium, fontSize: 17, color: palette.ink, height: 50 },
  roundBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.field },
  chipsScroller: { marginHorizontal: -22, flexGrow: 0 },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 22 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: radii.pill, backgroundColor: palette.field },
  chipActive: { backgroundColor: palette.primary },
  chipText: { fontFamily: fonts.semibold, fontSize: 13.5, color: palette.inkSoft },
  chipTextActive: { color: palette.onInk },
  center: { textAlign: 'center', paddingVertical: 20 },
  recentWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recentChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: radii.pill, backgroundColor: palette.field },
  result: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  resultTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20, color: palette.ink, letterSpacing: -0.2 },
  upcoming: { fontFamily: fonts.displayItalic, fontSize: 14, color: palette.inkSoft },
  inPalace: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.fieldActive },
  manual: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  manualIcon: { width: 48, height: 48, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.field },
  confirmHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hero: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  titleText: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 28, letterSpacing: -0.7, color: palette.ink },
  catPill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 4 },
  catPillText: { fontFamily: fonts.semibold, fontSize: 12 },
  titleInput: { ...(noOutline as object), fontFamily: fonts.bold, fontSize: 24, lineHeight: 28, letterSpacing: -0.7, color: palette.ink, padding: 0 },
  metaInput: { ...(noOutline as object), fontFamily: fonts.medium, fontSize: 15, color: palette.inkSoft, padding: 0, paddingVertical: 2 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: palette.field, borderRadius: radii.md, padding: 12 },
  block: { gap: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  note: { minHeight: 76, textAlignVertical: 'top' },
}));
