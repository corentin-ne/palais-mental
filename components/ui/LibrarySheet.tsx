import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import Sheet from './Sheet';
import Icon from './Icon';
import PressableScale from './PressableScale';
import { RatingStars, Segmented } from './Controls';
import { fonts, palette, radii, type } from '@/constants/theme';
import { CATEGORY_SPECS, getItemColor } from '@/lib/itemVisuals';
import { itemMeta } from '@/lib/format';
import { CATEGORIES, CategoryId, PalaceItem } from '@/lib/types';
import { getSeriesProgress, usePalaceStore } from '@/store/usePalaceStore';

type Sort = 'recent' | 'alpha' | 'rating';
type Scope = CategoryId | 'all';

interface Props {
  visible: boolean;
  initialScope: Scope;
  onClose: () => void;
  onOpenItem: (item: PalaceItem) => void;
}

/** Every memory as a searchable list, the flat counterpart of the room. */
export default function LibrarySheet({ visible, initialScope, onClose, onOpenItem }: Props) {
  const { t } = useTranslation();
  const items = usePalaceStore((s) => s.items);
  const [scope, setScope] = useState<Scope>(initialScope);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('recent');

  useEffect(() => {
    if (visible) {
      setScope(initialScope);
      setQuery('');
    }
  }, [visible, initialScope]);

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
          ? (b.rating ?? 0) - (a.rating ?? 0) || b.createdAt - a.createdAt
          : b.createdAt - a.createdAt,
    );
    return list;
  }, [items, scope, query, sort]);

  const scopes: Scope[] = ['all', ...CATEGORIES];

  return (
    <Sheet visible={visible} onClose={onClose} maxHeight={0.9}>
      <Text style={type.title}>{scope === 'all' ? t('library.all') : t(`categories.${scope}`)}</Text>

      <View style={styles.search}>
        <Icon name="search" size={18} color={palette.inkSoft} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('library.search')}
          placeholderTextColor={palette.inkFaint}
          style={styles.searchInput}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scopes} style={styles.scopeScroller}>
        {scopes.map((s) => {
          const active = s === scope;
          const accent = s === 'all' ? palette.ink : CATEGORY_SPECS[s].accent;
          return (
            <PressableScale
              key={s}
              onPress={() => setScope(s)}
              accessibilityLabel={s === 'all' ? t('library.all') : t(`categories.${s}`)}
              style={[styles.scope, active && { backgroundColor: s === 'all' ? palette.fieldActive : CATEGORY_SPECS[s].tint }]}
            >
              {s === 'all' ? (
                <Text style={[styles.scopeText, active && { color: palette.ink }]}>{t('library.all')}</Text>
              ) : (
                <Icon name={s} size={19} color={active ? accent : palette.inkSoft} strokeWidth={active ? 2 : 1.7} />
              )}
            </PressableScale>
          );
        })}
      </ScrollView>

      <Segmented<Sort>
        value={sort}
        onChange={setSort}
        options={[
          { value: 'recent', label: t('library.sortRecent') },
          { value: 'alpha', label: t('library.sortAlpha') },
          { value: 'rating', label: t('library.sortRating') },
        ]}
      />

      <View style={styles.list}>
        {rows.length === 0 && (
          <Text style={[type.small, styles.empty]}>{query ? t('library.noResults', { q: query }) : t('library.empty')}</Text>
        )}
        {rows.map((item) => (
          <PressableScale key={item.id} onPress={() => onOpenItem(item)} style={styles.row} depth={0.98}>
            <View style={[styles.swatch, { backgroundColor: getItemColor(item) }]}>
              <Icon name={item.category} size={17} color="rgba(42,34,28,0.55)" strokeWidth={1.8} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={type.small} numberOfLines={1}>
                {item.category === 'series'
                  ? [itemMeta(item), seriesLine(item, t)].filter(Boolean).join(' · ')
                  : itemMeta(item) || t(`categories.${item.category}`)}
              </Text>
            </View>
            {!!item.rating && <RatingStars value={item.rating} size={13} />}
          </PressableScale>
        ))}
      </View>
    </Sheet>
  );
}

function seriesLine(item: PalaceItem, t: TFunction) {
  if (item.category !== 'series') return '';
  const p = getSeriesProgress(item);
  return p.allComplete ? t('series.completed') : t('series.progress', { season: p.seasonIndex + 1, watched: p.watched, total: p.total });
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: palette.field,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: palette.ink, paddingVertical: 12 },
  scopeScroller: { marginHorizontal: -22, flexGrow: 0 },
  scopes: { flexDirection: 'row', gap: 4, paddingHorizontal: 22 },
  scope: { height: 38, minWidth: 38, paddingHorizontal: 10, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  scopeText: { fontFamily: fonts.semibold, fontSize: 13, color: palette.inkSoft },
  list: { gap: 2 },
  empty: { textAlign: 'center', paddingVertical: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  swatch: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fonts.display, fontSize: 17, color: palette.ink },
});
