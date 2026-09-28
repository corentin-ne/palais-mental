import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Sheet from './Sheet';
import Icon from './Icon';
import PressableScale from './PressableScale';
import { Button, CategoryChip, Field, RatingStars, Stepper } from './Controls';
import { fonts, palette, radii, type } from '@/constants/theme';
import { CATEGORIES, CategoryId, ItemDetails } from '@/lib/types';
import { CATEGORY_SPECS } from '@/lib/itemVisuals';
import { DEFAULT_EPISODES, usePalaceStore } from '@/store/usePalaceStore';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Fired as soon as a category is picked, so the camera turns while the user types. */
  onCategory: (category: CategoryId) => void;
  onSubmit: (category: CategoryId, details: ItemDetails, episodeCount: number) => void;
  initialCategory?: CategoryId | null;
}

const EMPTY: ItemDetails = { title: '', creator: '', year: undefined, rating: 0, note: '' };

export default function LogSheet({ visible, onClose, onCategory, onSubmit, initialCategory }: Props) {
  const { t } = useTranslation();
  const counts = usePalaceStore((s) => s.order);
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [details, setDetails] = useState<ItemDetails>(EMPTY);
  const [yearText, setYearText] = useState('');
  const [episodes, setEpisodes] = useState(DEFAULT_EPISODES);

  useEffect(() => {
    if (visible) {
      setCategory(initialCategory ?? null);
    } else {
      setCategory(null);
      setDetails(EMPTY);
      setYearText('');
      setEpisodes(DEFAULT_EPISODES);
    }
  }, [visible, initialCategory]);

  const pick = (c: CategoryId) => {
    setCategory(c);
    onCategory(c);
  };
  const patch = (p: Partial<ItemDetails>) => setDetails((d) => ({ ...d, ...p }));
  const canSubmit = !!category && details.title.trim().length > 0;
  const submit = () => {
    if (!canSubmit) return;
    onSubmit(category!, { ...details, year: yearText ? Number(yearText) : undefined }, episodes);
  };

  return (
    <Sheet visible={visible} onClose={onClose} accessibilityLabel={t('log.cancel')}>
      {!category ? (
        <>
          <View style={styles.header}>
            <Text style={type.title}>{t('log.title')}</Text>
            <Text style={type.small}>{t('log.subtitle')}</Text>
          </View>
          <View style={styles.grid}>
            {[0, 2, 4].map((row) => (
              <View key={row} style={styles.gridRow}>
                {CATEGORIES.slice(row, row + 2).map((c) => {
              const spec = CATEGORY_SPECS[c];
              const n = counts[c].length;
              return (
                <PressableScale key={c} onPress={() => pick(c)} style={[styles.tile, { backgroundColor: spec.tint }]}>
                  <View style={styles.tileIcon}>
                    <Icon name={c} size={24} color={spec.accent} strokeWidth={1.9} />
                  </View>
                  <View style={{ gap: 2 }}>
                    <Text style={styles.tileTitle}>{t(`categories.${c}`)}</Text>
                    <Text style={styles.tileMeta}>{n === 0 ? t('log.kept_zero') : t('log.kept', { count: n })}</Text>
                  </View>
                </PressableScale>
                  );
                })}
              </View>
            ))}
          </View>
        </>
      ) : (
        <>
          <View style={styles.formHead}>
            <PressableScale onPress={() => setCategory(null)} accessibilityLabel={t('log.back')} style={styles.back} hitSlop={8}>
              <Icon name="back" size={20} />
            </PressableScale>
            <CategoryChip
              icon={category}
              label={t(`categories.${category}`)}
              tint={CATEGORY_SPECS[category].tint}
              accent={CATEGORY_SPECS[category].accent}
            />
          </View>

          <Field
            large
            autoFocus
            value={details.title}
            onChangeText={(title) => patch({ title })}
            placeholder={t('log.titlePlaceholder', { example: t(`examples.${category}`) })}
            returnKeyType="done"
            maxLength={120}
            accessibilityLabel={t('log.titleLabel')}
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field
                label={t(`creator.${category}`)}
                value={details.creator}
                onChangeText={(creator) => patch({ creator })}
                placeholder={t(`creatorExamples.${category}`)}
                maxLength={80}
              />
            </View>
            <View style={{ width: 96 }}>
              <Field
                label={t('log.year')}
                value={yearText}
                onChangeText={(v) => setYearText(v.replace(/[^0-9]/g, '').slice(0, 4))}
                placeholder="2024"
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
          </View>

          <View style={styles.rowBetween}>
            <Text style={type.label}>{t('log.rating')}</Text>
            <RatingStars value={details.rating} onChange={(rating) => patch({ rating })} />
          </View>

          {category === 'series' && (
            <View style={styles.rowBetween}>
              <Text style={type.label}>{t('log.episodes')}</Text>
              <Stepper value={episodes} onChange={setEpisodes} />
            </View>
          )}

          <Field
            label={t('log.note')}
            value={details.note}
            onChangeText={(note) => patch({ note })}
            placeholder={t('log.notePlaceholder')}
            multiline
            maxLength={600}
            style={styles.note}
          />

          <Button label={t('log.submit')} icon="sparkle" onPress={submit} disabled={!canSubmit} />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  grid: { gap: 10 },
  gridRow: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, borderRadius: radii.lg, padding: 16, gap: 18, minHeight: 116 },
  tileIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  tileMeta: { fontFamily: fonts.body, fontSize: 12.5, color: palette.inkSoft },
  formHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.field },
  row: { flexDirection: 'row', gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  note: { minHeight: 84, textAlignVertical: 'top' },
});
