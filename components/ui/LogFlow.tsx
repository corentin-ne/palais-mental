import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';

import Sheet from './Sheet';
import Icon from './Icon';
import CoverArt from './CoverArt';
import PressableScale from './PressableScale';
import { Button, Field, RatingStars, Segmented, Stepper } from './Controls';
import { fonts, palette, radii, type, noOutline } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { CatalogResult, searchAll, searchCategory } from '@/lib/catalog';
import { CATEGORY_SPECS } from '@/lib/itemVisuals';
import { itemMeta } from '@/lib/format';
import { CATEGORIES, CategoryId, PalaceItem } from '@/lib/types';
import { DEFAULT_EPISODES, getSeriesProgress, usePalaceStore } from '@/store/usePalaceStore';
import { LogDraft, useUiStore } from '@/store/useUiStore';

const DEBOUNCE_MS = 320;
const DAY = 86_400_000;

/**
 * The heart of the app: search → tap the right cover → confirm. Three taps and a few
 * letters for a typical log; manual entry is always one row away.
 */
export default function LogFlow() {
  const log = useUiStore((s) => s.log);
  const closeLog = useUiStore((s) => s.closeLog);
  const { t } = useTranslation();
  return (
    <Sheet visible={log.stage !== 'closed'} onClose={closeLog} maxHeight={0.93} accessibilityLabel={t('log.cancel')}>
      {log.stage === 'confirm' && log.draft ? <ConfirmPane draft={log.draft} /> : <SearchPane />}
    </Sheet>
  );
}

// ------------------------------------------------------------------ Search
type Groups = { category: CategoryId; results: CatalogResult[] }[];

function SearchPane() {
  const { t, i18n } = useTranslation();
  const category = useUiStore((s) => s.log.category);
  const setCategory = useUiStore((s) => s.setSearchCategory);
  const confirm = useUiStore((s) => s.confirm);
  const closeLog = useUiStore((s) => s.closeLog);
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<Groups>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const findExisting = usePalaceStore((s) => s.findExisting);

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
    }, DEBOUNCE_MS);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [query, category, i18n.language]);

  const pick = (r: CatalogResult) =>
    confirm({
      category: r.category,
      title: r.title,
      creator: r.creator,
      year: r.year,
      coverUrl: r.coverUrl,
      season: r.season,
      episodeCount: r.episodeCount,
      source: r.source,
    });

  const manual = () =>
    confirm({ category: category === 'all' ? 'movies' : category, title: query.trim(), source: { provider: 'manual', id: '' } });

  const scopes: (CategoryId | 'all')[] = ['all', ...CATEGORIES];
  const q = query.trim();

  return (
    <>
      <View style={styles.searchRow}>
        <View style={styles.search}>
          <Icon name="search" size={19} color={palette.inkSoft} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={t(category === 'all' ? 'log.searchAll' : `log.search.${category}`)}
            placeholderTextColor={palette.inkFaint}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
          />
          {loading && <ActivityIndicator size="small" color={palette.inkSoft} />}
        </View>
        <PressableScale onPress={closeLog} accessibilityLabel={t('log.cancel')} style={styles.roundBtn} hitSlop={8}>
          <Icon name="close" size={18} />
        </PressableScale>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroller} contentContainerStyle={styles.chips}>
        {scopes.map((s) => {
          const active = s === category;
          return (
            <PressableScale
              key={s}
              onPress={() => setCategory(s)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityState={{ selected: active }}
            >
              {s !== 'all' && <Icon name={s} size={15} color={active ? palette.onInk : palette.inkSoft} strokeWidth={2} />}
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {s === 'all' ? t('library.all') : t(`categories.${s}`)}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>

      {q.length < 2 ? (
        <Recent />
      ) : (
        <View style={{ gap: 18 }}>
          {groups.map((g) => (
            <View key={g.category} style={{ gap: 4 }}>
              {category === 'all' && <Text style={type.label}>{t(`categories.${g.category}`)}</Text>}
              {g.results.map((r) => (
                <ResultRow key={r.key} result={r} inPalace={!!findExisting(r.category, r.title, r.source)} onPress={() => pick(r)} />
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
  const { t } = useTranslation();
  const meta = [
    result.creator,
    result.year,
    result.season ? t('series.season', { season: result.season }) : undefined,
    result.episodeCount ? t('log.episodesCount', { count: result.episodeCount }) : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <PressableScale onPress={onPress} style={styles.result} depth={0.98}>
      <CoverArt uri={result.coverUrl} title={result.title} category={result.category} width={48} aspect={2 / 3} radius={radii.xs} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.resultTitle} numberOfLines={2}>
          {result.title}
        </Text>
        {!!meta && (
          <Text style={type.small} numberOfLines={1}>
            {meta}
          </Text>
        )}
        {inPalace && <Text style={styles.inPalace}>{t('log.inPalace')}</Text>}
      </View>
    </PressableScale>
  );
}

/** Empty query: the things you log most often are right there. */
function Recent() {
  const { t } = useTranslation();
  const items = usePalaceStore((s) => s.items);
  const confirm = useUiStore((s) => s.confirm);
  const recent = useMemo(
    () =>
      Object.values(items)
        .sort((a, b) => (b.lastLoggedAt ?? b.createdAt) - (a.lastLoggedAt ?? a.createdAt))
        .slice(0, 6),
    [items],
  );
  if (!recent.length) return <Text style={[type.serif, styles.center]}>{t('log.searchHint')}</Text>;
  return (
    <View style={{ gap: 4 }}>
      <Text style={type.label}>{t('log.recent')}</Text>
      {recent.map((i) => (
        <PressableScale key={i.id} onPress={() => confirm(draftFromItem(i))} style={styles.result} depth={0.98}>
          <CoverArt uri={i.coverUrl} title={i.title} category={i.category} width={48} aspect={2 / 3} radius={radii.xs} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.resultTitle} numberOfLines={1}>
              {i.title}
            </Text>
            <Text style={type.small} numberOfLines={1}>
              {itemMeta(i) || t(`categories.${i.category}`)}
            </Text>
          </View>
          <Icon name="refresh" size={18} color={palette.inkSoft} />
        </PressableScale>
      ))}
    </View>
  );
}

function draftFromItem(i: PalaceItem): LogDraft {
  const draft: LogDraft = {
    category: i.category,
    title: i.title,
    creator: i.creator,
    year: i.year,
    coverUrl: i.coverUrl,
    source: i.source,
  };
  if (i.category === 'series') {
    const p = getSeriesProgress(i);
    draft.season = p.seasonNumber;
    draft.episodeCount = p.total;
  }
  return draft;
}

// ------------------------------------------------------------------ Confirm
function ConfirmPane({ draft }: { draft: LogDraft }) {
  const { t, i18n } = useTranslation();
  const pathname = usePathname();
  const haptics = useHaptics();
  const back = useUiStore((s) => s.backToSearch);
  const closeLog = useUiStore((s) => s.closeLog);
  const showToast = useUiStore((s) => s.showToast);
  const store = usePalaceStore;
  const manual = !draft.source || draft.source.provider === 'manual';

  const [category, setCategory] = useState<CategoryId>(draft.category);
  const [title, setTitle] = useState(draft.title);
  const [creator, setCreator] = useState(draft.creator ?? '');
  const [year, setYear] = useState(draft.year ? String(draft.year) : '');
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState('');
  const [daysAgo, setDaysAgo] = useState(0);
  const [season, setSeason] = useState(draft.season ?? 1);
  const [episodes, setEpisodes] = useState(draft.episodeCount ?? DEFAULT_EPISODES);
  const [whole, setWhole] = useState<'whole' | 'watching'>('whole');

  const existing = store((s) => s.findExisting(category, title, draft.source));
  const existingLogs = store((s) => (existing ? s.events.filter((e) => e.itemId === existing.id && e.kind !== 'episode').length : 0));

  const spec = CATEGORY_SPECS[category];
  const dateLabel =
    daysAgo === 0
      ? t('log.today')
      : daysAgo === 1
        ? t('log.yesterday')
        : new Intl.DateTimeFormat(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(Date.now() - daysAgo * DAY));

  const submit = () => {
    if (!title.trim()) return;
    const s = store.getState();
    const onPalace = pathname === '/palace';
    const date = daysAgo === 0 ? Date.now() : startOfDay(Date.now() - daysAgo * DAY) + 20 * 3_600_000;
    const id = s.logItem(
      category,
      { title, creator, year: year ? Number(year) : undefined, rating, note, coverUrl: draft.coverUrl },
      {
        date,
        source: manual ? { provider: 'manual', id: '' } : draft.source,
        season,
        episodeCount: episodes,
        seasonComplete: whole === 'whole',
        animate: onPalace && !existing,
      },
    );
    if (existing) {
      // A relog can still carry a fresh rating/note, and for series a new season.
      if (rating || note.trim()) s.updateItem(id, { ...(rating ? { rating } : {}), ...(note.trim() ? { note } : {}) });
      if (category === 'series') s.markSeason(id, season, episodes, whole === 'whole');
    }
    if (onPalace) s.setFocus(category);
    haptics.success();
    closeLog();
    showToast(t(existing ? 'toast.relogged' : 'toast.logged', { title: title.trim() }), onPalace ? undefined : id);
  };

  return (
    <>
      <View style={styles.confirmHead}>
        <PressableScale onPress={back} accessibilityLabel={t('log.back')} style={styles.roundBtn} hitSlop={8}>
          <Icon name="back" size={18} />
        </PressableScale>
        <Text style={type.label}>{t(existing ? 'log.logAgainTitle' : 'log.confirmTitle')}</Text>
        <PressableScale onPress={closeLog} accessibilityLabel={t('log.cancel')} style={styles.roundBtn} hitSlop={8}>
          <Icon name="close" size={18} />
        </PressableScale>
      </View>

      <View style={styles.hero}>
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
      </View>

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

      {existing && (
        <View style={styles.banner}>
          <Icon name="refresh" size={16} color={palette.inkSoft} />
          <Text style={[type.small, { flex: 1 }]}>{t('log.alreadyLogged', { count: existingLogs })}</Text>
        </View>
      )}

      <View style={styles.block}>
        <Text style={type.label}>{t('log.when')}</Text>
        <View style={styles.whenRow}>
          {[0, 1].map((d) => (
            <PressableScale key={d} onPress={() => setDaysAgo(d)} style={[styles.chip, daysAgo === d && styles.chipActive]}>
              <Text style={[styles.chipText, daysAgo === d && styles.chipTextActive]}>{d === 0 ? t('log.today') : t('log.yesterday')}</Text>
            </PressableScale>
          ))}
          <View style={[styles.dateStepper, daysAgo > 1 && styles.chipActive]}>
            <PressableScale onPress={() => setDaysAgo((d) => Math.min(3650, d + 1))} hitSlop={6} accessibilityLabel="−">
              <Icon name="back" size={16} color={daysAgo > 1 ? palette.onInk : palette.inkSoft} strokeWidth={2} />
            </PressableScale>
            <Icon name="calendar" size={15} color={daysAgo > 1 ? palette.onInk : palette.inkSoft} />
            <Text style={[styles.chipText, daysAgo > 1 && styles.chipTextActive]}>{daysAgo > 1 ? dateLabel : t('log.earlier')}</Text>
            {daysAgo > 1 && (
              <PressableScale onPress={() => setDaysAgo((d) => Math.max(0, d - 1))} hitSlop={6} accessibilityLabel="+">
                <View style={{ transform: [{ rotate: '180deg' }] }}>
                  <Icon name="back" size={16} color={palette.onInk} strokeWidth={2} />
                </View>
              </PressableScale>
            )}
          </View>
        </View>
      </View>

      {category === 'series' && (
        <View style={styles.block}>
          <Segmented<'whole' | 'watching'>
            value={whole}
            onChange={setWhole}
            options={[
              { value: 'whole', label: t('log.wholeSeason') },
              { value: 'watching', label: t('log.stillWatching') },
            ]}
          />
          <View style={styles.rowBetween}>
            <Text style={type.bodyMedium}>{t('series.season', { season })}</Text>
            <Stepper value={season} onChange={setSeason} min={1} max={60} />
          </View>
          <View style={styles.rowBetween}>
            <Text style={type.bodyMedium}>{t('series.episodesLabel')}</Text>
            <Stepper value={episodes} onChange={setEpisodes} />
          </View>
        </View>
      )}

      <View style={styles.rowBetween}>
        <Text style={type.label}>{t('log.rating')}</Text>
        <RatingStars value={rating} onChange={setRating} size={30} />
      </View>

      <Field value={note} onChangeText={setNote} placeholder={t('log.notePlaceholder')} multiline maxLength={600} style={styles.note} />

      <Button label={existing ? t('log.logAgain') : t('log.submit')} icon="check" onPress={submit} disabled={!title.trim()} />
    </>
  );
}

const startOfDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const styles = StyleSheet.create({
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
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: palette.field,
  },
  chipActive: { backgroundColor: palette.ink },
  chipText: { fontFamily: fonts.semibold, fontSize: 13.5, color: palette.inkSoft },
  chipTextActive: { color: palette.onInk },
  center: { textAlign: 'center', paddingVertical: 20 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  resultTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20, color: palette.ink, letterSpacing: -0.2 },
  inPalace: { fontFamily: fonts.displayItalic, fontSize: 14, color: palette.inkSoft },
  manual: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  manualIcon: { width: 48, height: 48, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.field },
  confirmHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hero: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  catPill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 4 },
  catPillText: { fontFamily: fonts.semibold, fontSize: 12 },
  titleInput: { ...(noOutline as object), fontFamily: fonts.bold, fontSize: 24, lineHeight: 28, letterSpacing: -0.7, color: palette.ink, padding: 0 },
  metaInput: { ...(noOutline as object), fontFamily: fonts.medium, fontSize: 15, color: palette.inkSoft, padding: 0, paddingVertical: 2 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: palette.field, borderRadius: radii.md, padding: 12 },
  block: { gap: 12 },
  whenRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  dateStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: palette.field,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  note: { minHeight: 76, textAlignVertical: 'top' },
});
