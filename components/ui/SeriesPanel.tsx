import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import Stepper from './Stepper';
import { theme } from '@/constants/theme';
import { CATEGORY_SPECS } from '@/lib/itemVisuals';
import { SeriesItem } from '@/lib/types';
import { getSeriesProgress, usePalaceStore } from '@/store/usePalaceStore';

const ACCENT = CATEGORY_SPECS.series.accent;

/** Episode logging for the focused TV Series zone. */
export default function SeriesPanel() {
  const { t } = useTranslation();
  const series = usePalaceStore(
    useShallow((s) => s.order.series.map((id) => s.items[id]).filter((i): i is SeriesItem => i?.category === 'series')),
  );
  const logEpisode = usePalaceStore((s) => s.logEpisode);
  const addSeason = usePalaceStore((s) => s.addSeason);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nextSeasonEpisodes, setNextSeasonEpisodes] = useState(10);

  // Default to the most recently logged series.
  useEffect(() => {
    if (!series.length) return setSelectedId(null);
    if (!selectedId || !series.some((s) => s.id === selectedId)) setSelectedId(series[series.length - 1].id);
  }, [series, selectedId]);

  if (!series.length) {
    return (
      <View style={styles.panel}>
        <Text style={styles.empty}>{t('series.empty')}</Text>
      </View>
    );
  }

  const selected = series.find((s) => s.id === selectedId) ?? series[series.length - 1];
  const progress = getSeriesProgress(selected);

  return (
    <View style={styles.panel}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {series.map((s) => {
          const active = s.id === selected.id;
          return (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              onPress={() => setSelectedId(s.id)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text numberOfLines={1} style={[styles.chipText, active && styles.chipTextActive]}>
                {s.title}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          {progress.allComplete
            ? t('series.completed')
            : t('series.progress', { season: progress.seasonIndex + 1, watched: progress.watched, total: progress.total })}
        </Text>
      </View>
      {/* Mirrors the 3D disc: one segment per episode slice. */}
      <View style={styles.segments}>
        {Array.from({ length: progress.total }, (_, i) => (
          <View
            key={i}
            style={[styles.segment, { backgroundColor: i < progress.watched ? ACCENT : theme.glassBorder }]}
          />
        ))}
      </View>

      {progress.allComplete ? (
        <View style={styles.seasonRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{t('series.newSeasonEpisodes', { season: selected.seasons.length + 1 })}</Text>
            <Stepper value={nextSeasonEpisodes} onChange={setNextSeasonEpisodes} />
          </View>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            onPress={() => addSeason(selected.id, nextSeasonEpisodes)}
          >
            <Text style={styles.secondaryText}>{t('series.newSeason')}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => logEpisode(selected.id)}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>{t('series.logEpisode')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: theme.glass,
    borderRadius: theme.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.glassBorder,
    padding: 14,
    gap: 10,
    shadowColor: theme.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  empty: { color: theme.textDim, fontSize: 14, lineHeight: 20 },
  chips: { gap: 8 },
  chip: {
    maxWidth: 180,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.glassBorder,
  },
  chipActive: { backgroundColor: 'rgba(167,139,218,0.16)', borderColor: ACCENT },
  chipText: { color: theme.textDim, fontSize: 13 },
  chipTextActive: { color: theme.text },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { color: theme.text, fontSize: 15, fontVariant: ['tabular-nums'], fontWeight: '500' },
  segments: { flexDirection: 'row', gap: 2, height: 4 },
  segment: { flex: 1, borderRadius: 2 },
  seasonRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  label: { color: theme.textDim, fontSize: 12, marginBottom: 6 },
  primary: { backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  secondary: { borderWidth: 1, borderColor: ACCENT, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 16 },
  secondaryText: { color: theme.text, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
