import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Sheet from './Sheet';
import Icon from './Icon';
import PressableScale from './PressableScale';
import { Button, CategoryChip, RatingStars, Ring, Stepper } from './Controls';
import { fonts, palette, radii, type } from '@/constants/theme';
import { CATEGORY_SPECS } from '@/lib/itemVisuals';
import { formatDate } from '@/lib/format';
import { PalaceItem, SeriesItem } from '@/lib/types';
import { DEFAULT_EPISODES, getSeriesProgress, usePalaceStore } from '@/store/usePalaceStore';

interface Props {
  onEpisode: (id: string) => void;
}

/**
 * Detail of the object floating in front of you. Every field edits in place and is
 * saved when you leave it; nothing to "submit".
 */
export default function ItemSheet({ onEpisode }: Props) {
  const selectedId = usePalaceStore((s) => s.selectedId);
  const item = usePalaceStore((s) => (s.selectedId ? s.items[s.selectedId] : undefined));
  const selectItem = usePalaceStore((s) => s.selectItem);
  // Keep the last item while the sheet animates out.
  const [shown, setShown] = useState<PalaceItem | undefined>(item);
  useEffect(() => {
    if (item) setShown(item);
  }, [item]);

  return (
    <Sheet visible={!!selectedId && !!item} onClose={() => selectItem(null)} maxHeight={0.58} backdrop="clear">
      {shown && <ItemBody key={shown.id} item={item ?? shown} onEpisode={onEpisode} />}
    </Sheet>
  );
}

function ItemBody({ item, onEpisode }: { item: PalaceItem; onEpisode: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const updateItem = usePalaceStore((s) => s.updateItem);
  const deleteItem = usePalaceStore((s) => s.deleteItem);
  const selectItem = usePalaceStore((s) => s.selectItem);
  const spec = CATEGORY_SPECS[item.category];

  const [title, setTitle] = useState(item.title);
  const [creator, setCreator] = useState(item.creator ?? '');
  const [year, setYear] = useState(item.year ? String(item.year) : '');
  const [note, setNote] = useState(item.note ?? '');
  const [confirming, setConfirming] = useState(false);

  const commit = () =>
    updateItem(item.id, { title, creator, year: year ? Number(year) : undefined, note });

  return (
    <>
      <View style={styles.head}>
        <CategoryChip icon={item.category} label={t(`categories.${item.category}`)} tint={spec.tint} accent={spec.accent} />
        <PressableScale onPress={() => selectItem(null)} accessibilityLabel={t('item.close')} style={styles.close} hitSlop={8}>
          <Icon name="close" size={18} />
        </PressableScale>
      </View>

      <View style={{ gap: 6 }}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          onEndEditing={commit}
          onBlur={commit}
          style={styles.title}
          multiline
          blurOnSubmit
          maxLength={120}
          accessibilityLabel={t('log.titleLabel')}
        />
        <View style={styles.metaRow}>
          <TextInput
            value={creator}
            onChangeText={setCreator}
            onBlur={commit}
            placeholder={t(`creator.${item.category}`)}
            placeholderTextColor={palette.inkFaint}
            style={[styles.meta, { flex: 1 }]}
            maxLength={80}
          />
          <TextInput
            value={year}
            onChangeText={(v) => setYear(v.replace(/[^0-9]/g, '').slice(0, 4))}
            onBlur={commit}
            placeholder={t('item.yearPlaceholder')}
            placeholderTextColor={palette.inkFaint}
            keyboardType="number-pad"
            style={[styles.meta, styles.year]}
            maxLength={4}
          />
        </View>
      </View>

      <RatingStars value={item.rating ?? 0} onChange={(rating) => updateItem(item.id, { rating })} size={30} />

      {item.category === 'series' && <SeriesBlock item={item} onEpisode={onEpisode} />}

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

      <View style={styles.footer}>
        <Text style={type.small}>{t('item.added', { date: formatDate(item.createdAt, i18n.language) })}</Text>
        {!confirming && (
          <PressableScale onPress={() => setConfirming(true)} style={styles.remove} accessibilityLabel={t('item.remove')}>
            <Icon name="trash" size={17} color={palette.danger} />
          </PressableScale>
        )}
      </View>

      {confirming && (
        <View style={styles.confirm}>
          <Text style={[type.bodyMedium, { flex: 1 }]}>{t('item.removeConfirm', { title: item.title })}</Text>
          <View style={styles.confirmActions}>
            <Button label={t('item.keep')} tone="soft" compact onPress={() => setConfirming(false)} />
            <Button label={t('item.removeYes')} tone="danger" compact onPress={() => deleteItem(item.id)} />
          </View>
        </View>
      )}
    </>
  );
}

function SeriesBlock({ item, onEpisode }: { item: SeriesItem; onEpisode: (id: string) => void }) {
  const { t } = useTranslation();
  const addSeason = usePalaceStore((s) => s.addSeason);
  const [next, setNext] = useState(DEFAULT_EPISODES);
  const spec = CATEGORY_SPECS.series;
  const progress = getSeriesProgress(item);
  return (
    <View style={styles.series}>
      <View style={styles.seasons}>
        {item.seasons.map((s, i) => (
          <View key={i} style={styles.season}>
            <Ring fraction={s.watched / s.episodeCount} color={spec.accent} size={48}>
              <Text style={styles.ringText}>{i + 1}</Text>
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
            label={t('series.newSeason', { season: item.seasons.length + 1 })}
            tone="soft"
            compact
            onPress={() => addSeason(item.id, next)}
          />
        </View>
      ) : (
        <Button
          label={`${t('series.logEpisode')} · ${t('series.progress', {
            season: progress.seasonIndex + 1,
            watched: progress.watched + 1,
            total: progress.total,
          })}`}
          icon="plus"
          tone="accent"
          accent={spec.accent}
          onPress={() => onEpisode(item.id)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.field },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.5, color: palette.ink, padding: 0 },
  metaRow: { flexDirection: 'row', gap: 10 },
  meta: { fontFamily: fonts.medium, fontSize: 15, color: palette.inkSoft, paddingVertical: 4, padding: 0 },
  year: { width: 64, textAlign: 'right', fontVariant: ['tabular-nums'] },
  note: {
    fontFamily: fonts.displayItalic,
    fontSize: 17,
    lineHeight: 24,
    color: palette.ink,
    backgroundColor: palette.field,
    borderRadius: radii.md,
    padding: 14,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  remove: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.dangerTint },
  confirm: { gap: 12, backgroundColor: palette.dangerTint, borderRadius: radii.md, padding: 14 },
  confirmActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  series: { gap: 14 },
  seasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  season: { alignItems: 'center', gap: 4 },
  ringText: { fontFamily: fonts.semibold, fontSize: 14, color: palette.ink },
  seasonMeta: { fontFamily: fonts.medium, fontSize: 11.5, color: palette.inkSoft, fontVariant: ['tabular-nums'] },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
});
