import { useMemo } from 'react';
import { ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import CoverArt from '@/components/ui/CoverArt';
import Icon from '@/components/ui/Icon';
import PressableScale from '@/components/ui/PressableScale';
import { RatingStars } from '@/components/ui/Controls';
import { fonts, palette, radii, shadow, type } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { CATEGORY_SPECS } from '@/lib/itemVisuals';
import { itemMeta } from '@/lib/format';
import { groupByDay, startOfDay } from '@/lib/stats';
import { CATEGORIES, JournalEvent, SeriesItem } from '@/lib/types';
import { getSeriesProgress, usePalaceStore } from '@/store/usePalaceStore';
import { useUiStore } from '@/store/useUiStore';

const DAY = 86_400_000;

/** The diary: what you watched, read, heard and played, day by day. */
export default function JournalScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const events = usePalaceStore((s) => s.events);
  const items = usePalaceStore((s) => s.items);
  const openSearch = useUiStore((s) => s.openSearch);

  const sections = useMemo(
    () => groupByDay(events.filter((e) => items[e.itemId])).map((g) => ({ ...g, key: String(g.day) })),
    [events, items],
  );

  const dayLabel = (day: number) => {
    const today = startOfDay(Date.now());
    if (day === today) return t('journal.today');
    if (day === today - DAY) return t('journal.yesterday');
    return new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(day));
  };
  const todayLong = new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  return (
    <SectionList
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 }}
      sections={sections}
      keyExtractor={(e) => e.id}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={{ gap: 2 }}>
            <Text style={type.serif}>{todayLong}</Text>
            <Text style={type.display}>{t('journal.title')}</Text>
          </View>

          <PressableScale onPress={() => openSearch('all')} style={styles.searchPill} depth={0.98}>
            <Icon name="search" size={19} color={palette.inkSoft} />
            <Text style={styles.searchText}>{t('journal.searchPlaceholder')}</Text>
          </PressableScale>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shortcutsScroller} contentContainerStyle={styles.shortcuts}>
            {CATEGORIES.map((c) => (
              <PressableScale key={c} onPress={() => openSearch(c)} style={styles.shortcut} depth={0.94}>
                <View style={[styles.shortcutIcon, { backgroundColor: CATEGORY_SPECS[c].tint }]}>
                  <Icon name={c} size={22} color={CATEGORY_SPECS[c].accent} strokeWidth={1.9} />
                </View>
                <Text style={styles.shortcutText} numberOfLines={1}>
                  {t(`categories.${c}`)}
                </Text>
              </PressableScale>
            ))}
          </ScrollView>

          <ContinueWatching />

          {sections.length === 0 && (
            <View style={styles.empty}>
              <Text style={type.title}>{t('journal.emptyTitle')}</Text>
              <Text style={[type.serif, { textAlign: 'center' }]}>{t('journal.emptyBody')}</Text>
            </View>
          )}
        </View>
      }
      renderSectionHeader={({ section }) => (
        <View style={styles.dayHeader}>
          <Text style={styles.dayText}>{dayLabel(section.day)}</Text>
          <Text style={type.small}>{t('journal.entries', { count: section.data.length })}</Text>
        </View>
      )}
      renderItem={({ item }) => <JournalRow event={item} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

function JournalRow({ event }: { event: JournalEvent }) {
  const { t } = useTranslation();
  const item = usePalaceStore((s) => s.items[event.itemId]);
  const selectItem = usePalaceStore((s) => s.selectItem);
  if (!item) return null;
  const spec = CATEGORY_SPECS[item.category];
  const badge =
    event.kind === 'episode'
      ? event.completesSeason
        ? t('series.seasonComplete', { season: event.season })
        : t('journal.episode', { season: event.season, episode: event.episode })
      : event.kind === 'relog'
        ? t('journal.again')
        : null;
  return (
    <PressableScale onPress={() => selectItem(item.id)} style={styles.row} depth={0.985}>
      <CoverArt uri={item.coverUrl} title={item.title} category={item.category} width={56} aspect={2 / 3} radius={radii.xs} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.rowMeta}>
          <Icon name={item.category} size={13} color={spec.accent} strokeWidth={2.1} />
          <Text style={type.small} numberOfLines={1}>
            {itemMeta(item) || t(`categories.${item.category}`)}
          </Text>
        </View>
        <View style={styles.rowFoot}>
          {!!item.rating && <RatingStars value={item.rating} size={13} />}
          {badge && (
            <View style={[styles.badge, { backgroundColor: spec.tint }]}>
              <Text style={[styles.badgeText, { color: spec.accent }]}>{badge}</Text>
            </View>
          )}
        </View>
        {!!item.note && event.kind !== 'episode' && (
          <Text style={styles.note} numberOfLines={2}>
            “{item.note}”
          </Text>
        )}
      </View>
    </PressableScale>
  );
}

/** Series in progress: the most frequent log of all, one tap each. */
function ContinueWatching() {
  const { t } = useTranslation();
  const haptics = useHaptics();
  const showToast = useUiStore((s) => s.showToast);
  const logEpisode = usePalaceStore((s) => s.logEpisode);
  const selectItem = usePalaceStore((s) => s.selectItem);
  const series = usePalaceStore(
    useShallow((s) =>
      s.order.series
        .map((id) => s.items[id])
        .filter((i): i is SeriesItem => i?.category === 'series' && !getSeriesProgress(i).allComplete)
        .sort((a, b) => (b.lastLoggedAt ?? b.createdAt) - (a.lastLoggedAt ?? a.createdAt)),
    ),
  );
  if (!series.length) return null;
  const accent = CATEGORY_SPECS.series.accent;
  return (
    <View style={{ gap: 10 }}>
      <Text style={type.label}>{t('series.continue')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shortcutsScroller} contentContainerStyle={styles.cwList}>
        {series.map((s) => {
          const p = getSeriesProgress(s);
          return (
            <PressableScale key={s.id} onPress={() => selectItem(s.id)} style={styles.cwCard} depth={0.97}>
              <CoverArt uri={s.coverUrl} title={s.title} category="series" width={52} radius={radii.xs} />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.cwTitle} numberOfLines={1}>
                  {s.title}
                </Text>
                <Text style={type.small}>{t('series.progress', { season: p.seasonNumber, watched: p.watched, total: p.total })}</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${p.fraction * 100}%`, backgroundColor: accent }]} />
                </View>
              </View>
              <PressableScale
                onPress={() => {
                  const e = logEpisode(s.id);
                  if (!e) return;
                  haptics.tap();
                  showToast(t('toast.episode', { title: s.title, episode: p.watched + 1 }));
                }}
                accessibilityLabel={t('series.logEpisode')}
                style={[styles.cwAdd, { backgroundColor: accent }]}
                hitSlop={6}
              >
                <Icon name="plus" size={18} color={palette.onInk} strokeWidth={2.4} />
              </PressableScale>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  header: { paddingHorizontal: 20, gap: 22, paddingBottom: 6 },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
    ...shadow.soft,
  },
  searchText: { fontFamily: fonts.medium, fontSize: 16, color: palette.inkFaint },
  shortcutsScroller: { marginHorizontal: -20, flexGrow: 0 },
  shortcuts: { paddingHorizontal: 20, gap: 14 },
  shortcut: { width: 76, alignItems: 'center', gap: 6 },
  shortcutIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  shortcutText: { fontFamily: fonts.medium, fontSize: 11.5, color: palette.inkSoft },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36, paddingHorizontal: 12 },
  dayHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 26, paddingBottom: 10 },
  dayText: { fontFamily: fonts.bold, fontSize: 19, letterSpacing: -0.5, color: palette.ink, textTransform: 'capitalize' },
  row: { flexDirection: 'row', gap: 14, paddingHorizontal: 20, paddingVertical: 10 },
  rowText: { flex: 1, gap: 4, paddingTop: 2 },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 16.5, lineHeight: 21, letterSpacing: -0.3, color: palette.ink },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11.5 },
  note: { fontFamily: fonts.displayItalic, fontSize: 15.5, lineHeight: 20, color: palette.inkSoft },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: palette.hairline, marginLeft: 90, marginRight: 20 },
  cwList: { paddingHorizontal: 20, gap: 10 },
  cwCard: {
    width: 280,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: radii.lg,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
  },
  cwTitle: { fontFamily: fonts.semibold, fontSize: 15, color: palette.ink },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: palette.hairline, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  cwAdd: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
