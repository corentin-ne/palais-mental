import { useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import CoverArt from '@/components/ui/CoverArt';
import Icon from '@/components/ui/Icon';
import PressableScale from '@/components/ui/PressableScale';
import { RatingStars, Segmented } from '@/components/ui/Controls';
import { FadeIn, animateLayout } from '@/components/ui/Motion';
import { makeStyles, noOutline, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { isAwaited } from '@/lib/releases';
import { CATEGORIES, CategoryId, PalaceItem } from '@/lib/types';
import { usePalaceStore } from '@/store/usePalaceStore';
import { useUiStore } from '@/store/useUiStore';

type Sort = 'added' | 'rating' | 'alpha';
type Scope = CategoryId | 'all';

const COLUMNS = 3;
const GAP = 14;

/** The whole collection as a wall of covers. */
export default function LibraryScreen() {
  const { t } = useTranslation();
  const { palette, type } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ c?: string }>();
  const items = usePalaceStore((s) => s.items);
  const selectItem = usePalaceStore((s) => s.selectItem);
  const openSearch = useUiStore((s) => s.openSearch);
  const [scope, setScope] = useState<Scope>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('added');

  useEffect(() => {
    if (params.c && (CATEGORIES as readonly string[]).includes(params.c)) setScope(params.c as CategoryId);
  }, [params.c]);

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: 0 };
    Object.values(items).forEach((i) => {
      out.all += 1;
      out[i.category] = (out[i.category] ?? 0) + 1;
    });
    return out;
  }, [items]);

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const list = Object.values(items).filter(
      (i) =>
        (scope === 'all' || i.category === scope) &&
        (!q || [i.title, i.creator, i.note, i.year?.toString()].some((f) => f?.toLocaleLowerCase().includes(q))),
    );
    list.sort((a, b) =>
      sort === 'alpha'
        ? a.title.localeCompare(b.title)
        : sort === 'rating'
          ? (b.rating ?? 0) - (a.rating ?? 0) || a.title.localeCompare(b.title)
          : b.createdAt - a.createdAt,
    );
    return list;
  }, [items, scope, query, sort]);

  const contentWidth = Math.min(width, 720) - 40;
  const cell = (contentWidth - GAP * (COLUMNS - 1)) / COLUMNS;
  const change = <T,>(fn: (v: T) => void) => (v: T) => {
    haptics.select();
    animateLayout();
    fn(v);
  };

  return (
    <FlatList
      style={styles.root}
      data={rows}
      key={`${scope}-${sort}`}
      numColumns={COLUMNS}
      keyExtractor={(i) => i.id}
      columnWrapperStyle={styles.columns}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 }]}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={type.display}>{t('library.title')}</Text>
            <Text style={styles.count}>{counts.all}</Text>
          </View>
          <View style={styles.search}>
            <Icon name="search" size={18} color={palette.inkSoft} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('library.search')}
              placeholderTextColor={palette.inkFaint}
              style={styles.searchInput}
              returnKeyType="search"
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroller} contentContainerStyle={styles.chips}>
            {(['all', ...CATEGORIES] as Scope[]).map((s) => {
              const active = s === scope;
              return (
                <PressableScale key={s} onPress={() => change(setScope)(s)} style={[styles.chip, active && styles.chipActive]}>
                  {s !== 'all' && <Icon name={s} size={15} color={active ? palette.onInk : palette.inkSoft} strokeWidth={2} />}
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{s === 'all' ? t('library.all') : t(`categories.${s}`)}</Text>
                  <Text style={[styles.chipCount, active && styles.chipTextActive]}>{counts[s] ?? 0}</Text>
                </PressableScale>
              );
            })}
          </ScrollView>
          <Segmented<Sort>
            value={sort}
            onChange={change(setSort)}
            options={[
              { value: 'added', label: t('library.sortAdded') },
              { value: 'rating', label: t('library.sortRating') },
              { value: 'alpha', label: t('library.sortAlpha') },
            ]}
          />
          {rows.length === 0 && (
            <FadeIn style={styles.empty}>
              <Text style={[type.serif, { textAlign: 'center' }]}>{query ? t('library.noResults', { q: query }) : t('library.empty')}</Text>
              {!query && (
                <PressableScale onPress={() => openSearch(scope === 'all' ? 'all' : scope)} style={styles.emptyCta}>
                  <Icon name="plus" size={16} color={palette.onInk} strokeWidth={2.2} />
                  <Text style={styles.emptyCtaText}>{t('library.addFirst')}</Text>
                </PressableScale>
              )}
            </FadeIn>
          )}
        </View>
      }
      renderItem={({ item, index }) => (
        <FadeIn index={index} distance={18}>
          <Cell item={item} width={cell} onPress={() => selectItem(item.id)} />
        </FadeIn>
      )}
    />
  );
}

function Cell({ item, width, onPress }: { item: PalaceItem; width: number; onPress: () => void }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const awaited = isAwaited(item);
  return (
    <PressableScale onPress={onPress} style={{ width, gap: 7 }} depth={0.95}>
      <View>
        <CoverArt uri={item.coverUrl} title={item.title} category={item.category} width={width} aspect={2 / 3} />
        {awaited && (
          <View style={styles.soonBadge}>
            <Icon name="bell" size={11} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={styles.soonText}>{t('library.soon')}</Text>
          </View>
        )}
      </View>
      <View style={{ gap: 3 }}>
        <Text style={styles.cellTitle} numberOfLines={1}>
          {item.title}
        </Text>
        {item.rating ? (
          <RatingStars value={item.rating} size={11} />
        ) : (
          <Text style={styles.cellMeta} numberOfLines={1}>
            {item.creator ?? item.year ?? ''}
          </Text>
        )}
      </View>
    </PressableScale>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii }) => ({
  root: { flex: 1, backgroundColor: palette.screen },
  content: { paddingHorizontal: 20, gap: 22, maxWidth: 760, width: '100%', alignSelf: 'center' },
  columns: { gap: GAP },
  header: { gap: 16, paddingBottom: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  count: { fontFamily: fonts.displayItalic, fontSize: 24, color: palette.inkFaint },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: palette.field, borderRadius: radii.pill, paddingHorizontal: 16, height: 46 },
  searchInput: { ...(noOutline as object), flex: 1, fontFamily: fonts.medium, fontSize: 16, color: palette.ink, height: 46 },
  chipsScroller: { marginHorizontal: -20, flexGrow: 0 },
  chips: { paddingHorizontal: 20, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: radii.pill, backgroundColor: palette.field },
  chipActive: { backgroundColor: palette.primary },
  chipText: { fontFamily: fonts.semibold, fontSize: 13.5, color: palette.inkSoft },
  chipCount: { fontFamily: fonts.medium, fontSize: 12, color: palette.inkFaint, fontVariant: ['tabular-nums'] },
  chipTextActive: { color: palette.onInk },
  empty: { alignItems: 'center', gap: 16, paddingVertical: 40 },
  emptyCta: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: palette.primary, borderRadius: radii.pill, paddingHorizontal: 18, height: 44 },
  emptyCtaText: { fontFamily: fonts.semibold, fontSize: 14.5, color: palette.onInk },
  soonBadge: {
    position: 'absolute',
    left: 6,
    top: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(22,20,18,0.78)',
    borderRadius: radii.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  soonText: { fontFamily: fonts.semibold, fontSize: 10.5, color: '#FFFFFF' },
  cellTitle: { fontFamily: fonts.semibold, fontSize: 13.5, color: palette.ink, letterSpacing: -0.1 },
  cellMeta: { fontFamily: fonts.body, fontSize: 12, color: palette.inkSoft },
}));
