import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';

import Sheet from './Sheet';
import Icon from './Icon';
import CoverArt from './CoverArt';
import PressableScale from './PressableScale';
import { Button, RatingStars, Ring, Stepper } from './Controls';
import { noOutline, makeStyles, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { CATEGORY_SPECS } from '@/lib/itemVisuals';
import { formatDate } from '@/lib/format';
import { PalaceItem, SeriesItem } from '@/lib/types';
import { DEFAULT_EPISODES, getSeriesProgress, seasonNumber, usePalaceStore } from '@/store/usePalaceStore';
import { useUiStore } from '@/store/useUiStore';

/**
 * Everything about one memory. Every field edits in place and saves when you leave it.
 * In the palace the sheet stays low and clear so the lifted object floats above it.
 */
export default function ItemSheet() {
  const selectedId = usePalaceStore((s) => s.selectedId);
  const inspecting = usePalaceStore((s) => !!s.selectedId && s.inspectId === s.selectedId);
  const item = usePalaceStore((s) => (s.selectedId ? s.items[s.selectedId] : undefined));
  const selectItem = usePalaceStore((s) => s.selectItem);
  // Keep the last item while the sheet animates out.
  const [shown, setShown] = useState<PalaceItem | undefined>(item);
  useEffect(() => {
    if (item) setShown(item);
  }, [item]);

  return (
    <Sheet
      visible={!!selectedId && !!item}
      onClose={() => selectItem(null)}
      maxHeight={inspecting ? 0.58 : 0.9}
      backdrop={inspecting ? 'clear' : 'dim'}
    >
      {shown && <ItemBody key={shown.id} item={item ?? shown} compact={inspecting} />}
    </Sheet>
  );
}

function ItemBody({ item, compact }: { item: PalaceItem; compact: boolean }) {
  const { palette, type } = useTheme();
  const styles = useStyles();
  const { t, i18n } = useTranslation();
  const haptics = useHaptics();
  const updateItem = usePalaceStore((s) => s.updateItem);
  const deleteItem = usePalaceStore((s) => s.deleteItem);
  const relogItem = usePalaceStore((s) => s.relogItem);
  const selectItem = usePalaceStore((s) => s.selectItem);
  const logs = usePalaceStore((s) => s.events.filter((e) => e.itemId === item.id && e.kind !== 'episode'));
  const showToast = useUiStore((s) => s.showToast);
  const spec = CATEGORY_SPECS[item.category];

  const [title, setTitle] = useState(item.title);
  const [creator, setCreator] = useState(item.creator ?? '');
  const [year, setYear] = useState(item.year ? String(item.year) : '');
  const [note, setNote] = useState(item.note ?? '');
  const [confirming, setConfirming] = useState(false);

  const commit = () => updateItem(item.id, { title, creator, year: year ? Number(year) : undefined, note });
  const last = logs.reduce((m, e) => Math.max(m, e.ts), 0) || item.createdAt;

  return (
    <>
      <View style={styles.head}>
        <View style={[styles.catPill, { backgroundColor: spec.tint }]}>
          <Icon name={item.category} size={13} color={spec.accent} strokeWidth={2.2} />
          <Text style={[styles.catPillText, { color: spec.accent }]}>{t(`categories.${item.category}`)}</Text>
        </View>
        <PressableScale onPress={() => selectItem(null)} accessibilityLabel={t('item.close')} style={styles.close} hitSlop={8}>
          <Icon name="close" size={18} />
        </PressableScale>
      </View>

      <View style={styles.hero}>
        {!compact && <CoverArt uri={item.coverUrl} title={item.title} category={item.category} width={112} />}
        <View style={{ flex: 1, gap: 4 }}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            onBlur={commit}
            style={styles.title}
            multiline
            blurOnSubmit
            maxLength={120}
            accessibilityLabel={t('log.titleLabel')}
          />
          <TextInput
            value={creator}
            onChangeText={setCreator}
            onBlur={commit}
            placeholder={t(`creator.${item.category}`)}
            placeholderTextColor={palette.inkFaint}
            style={styles.meta}
            maxLength={80}
          />
          <TextInput
            value={year}
            onChangeText={(v) => setYear(v.replace(/[^0-9]/g, '').slice(0, 4))}
            onBlur={commit}
            placeholder={t('item.yearPlaceholder')}
            placeholderTextColor={palette.inkFaint}
            keyboardType="number-pad"
            style={styles.meta}
            maxLength={4}
          />
          <View style={{ paddingTop: 6 }}>
            <RatingStars value={item.rating ?? 0} onChange={(rating) => updateItem(item.id, { rating })} size={26} />
          </View>
        </View>
      </View>

      <View style={styles.history}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.bodyMedium}>{t('item.loggedTimes', { count: Math.max(1, logs.length) })}</Text>
          <Text style={type.serif}>{t('item.lastLogged', { date: formatDate(last, i18n.language) })}</Text>
        </View>
        <Button
          label={t('log.logAgain')}
          icon="refresh"
          tone="soft"
          compact
          onPress={() => {
            relogItem(item.id);
            haptics.success();
            showToast(t('toast.relogged', { title: item.title }));
          }}
        />
      </View>

      {item.category === 'series' && <SeriesBlock item={item} />}

      <TextInput
        value={note}
        onChangeText={setNote}
        onBlur={commit}
        placeholder={t('item.notePlaceholder')}
        placeholderTextColor={palette.inkFaint}
        multiline
        maxLength={600}
        style={styles.note}
      />

      {confirming ? (
        <View style={styles.confirm}>
          <Text style={type.bodyMedium}>{t('item.removeConfirm', { title: item.title })}</Text>
          <View style={styles.confirmActions}>
            <Button label={t('item.keep')} tone="soft" compact onPress={() => setConfirming(false)} />
            <Button label={t('item.removeYes')} tone="danger" compact onPress={() => deleteItem(item.id)} />
          </View>
        </View>
      ) : (
        <PressableScale onPress={() => setConfirming(true)} style={styles.remove} accessibilityLabel={t('item.remove')}>
          <Icon name="trash" size={16} color={palette.danger} />
          <Text style={styles.removeText}>{t('item.remove')}</Text>
        </PressableScale>
      )}
    </>
  );
}

function SeriesBlock({ item }: { item: SeriesItem }) {
  const { type } = useTheme();
  const styles = useStyles();
  const { t } = useTranslation();
  const pathname = usePathname();
  const haptics = useHaptics();
  const addSeason = usePalaceStore((s) => s.addSeason);
  const logEpisode = usePalaceStore((s) => s.logEpisode);
  const [next, setNext] = useState(DEFAULT_EPISODES);
  const spec = CATEGORY_SPECS.series;
  const progress = getSeriesProgress(item);
  return (
    <View style={styles.series}>
      <View style={styles.seasons}>
        {item.seasons.map((s, i) => (
          <View key={i} style={styles.season}>
            <Ring fraction={s.watched / s.episodeCount} color={spec.accent} size={48}>
              <Text style={styles.ringText}>{seasonNumber(item, i)}</Text>
            </Ring>
            <Text style={styles.seasonMeta}>
              {s.watched}/{s.episodeCount}
            </Text>
          </View>
        ))}
      </View>
      {progress.allComplete ? (
        <View style={styles.rowBetween}>
          <View style={{ gap: 6 }}>
            <Text style={type.label}>{t('series.episodesLabel')}</Text>
            <Stepper value={next} onChange={setNext} />
          </View>
          <Button
            label={t('series.newSeason', { season: seasonNumber(item, item.seasons.length) })}
            tone="soft"
            compact
            onPress={() => addSeason(item.id, next)}
          />
        </View>
      ) : (
        <Button
          label={`${t('series.logEpisode')} · ${t('series.progress', {
            season: progress.seasonNumber,
            watched: progress.watched + 1,
            total: progress.total,
          })}`}
          icon="plus"
          tone="accent"
          accent={spec.accent}
          onPress={() => {
            const e = logEpisode(item.id, { animate: pathname === '/palace' });
            if (e) (e.kind === 'episode' && e.completesSeason ? haptics.success : haptics.tap)();
          }}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii }) => ({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 5 },
  catPillText: { fontFamily: fonts.semibold, fontSize: 12.5 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.field },
  hero: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  title: { ...(noOutline as object), fontFamily: fonts.bold, fontSize: 26, lineHeight: 30, letterSpacing: -0.9, color: palette.ink, padding: 0 },
  meta: { ...(noOutline as object), fontFamily: fonts.medium, fontSize: 15, color: palette.inkSoft, padding: 0, paddingVertical: 1 },
  history: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
  },
  note: { ...(noOutline as object),
    fontFamily: fonts.displayItalic,
    fontSize: 18,
    lineHeight: 24,
    color: palette.ink,
    backgroundColor: palette.field,
    borderRadius: radii.md,
    padding: 14,
    minHeight: 76,
    textAlignVertical: 'top',
  },
  remove: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  removeText: { fontFamily: fonts.semibold, fontSize: 14, color: palette.danger },
  confirm: { gap: 12, backgroundColor: palette.dangerTint, borderRadius: radii.md, padding: 14 },
  confirmActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  series: { gap: 14 },
  seasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  season: { alignItems: 'center', gap: 4 },
  ringText: { fontFamily: fonts.semibold, fontSize: 14, color: palette.ink },
  seasonMeta: { fontFamily: fonts.medium, fontSize: 11.5, color: palette.inkSoft, fontVariant: ['tabular-nums'] },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
}));
