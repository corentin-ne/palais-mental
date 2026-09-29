import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import Glass from './Glass';
import Icon from './Icon';
import PressableScale from './PressableScale';
import { Button } from './Controls';
import { makeStyles, useTheme } from '@/constants/theme';
import { CATEGORY_SPECS } from '@/lib/itemVisuals';
import { CategoryId, SeriesItem } from '@/lib/types';
import { getSeriesProgress, usePalaceStore } from '@/store/usePalaceStore';

interface Props {
  category: CategoryId;
  onLibrary: () => void;
  onEpisode: (id: string) => void;
}

/** What you are looking at: the collection's name and size, and for series, where you left off. */
export default function FocusCard({ category, onLibrary, onEpisode }: Props) {
  const { palette, type, radii } = useTheme();
  const styles = useStyles();
  const { t } = useTranslation();
  const spec = CATEGORY_SPECS[category];
  const count = usePalaceStore((s) => s.order[category].length);
  // Most recently touched series that still has episodes to watch.
  const current = usePalaceStore(
    useShallow((s) => {
      if (category !== 'series') return null;
      const open = s.order.series
        .map((id) => s.items[id])
        .filter((i): i is SeriesItem => i?.category === 'series' && !getSeriesProgress(i).allComplete)
        .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
      return open[0] ?? null;
    }),
  );
  const progress = current ? getSeriesProgress(current) : null;

  return (
    <Glass radius={radii.lg} contentStyle={styles.card}>
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: spec.tint }]}>
          <Icon name={category} size={20} color={spec.accent} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.heading}>{t(`categories.${category}`)}</Text>
          <Text style={type.small}>{t('focus.count', { count })}</Text>
        </View>
        {count > 0 && (
          <PressableScale onPress={onLibrary} style={styles.libraryBtn} accessibilityLabel={t('focus.open')}>
            <Icon name="library" size={17} />
            <Text style={styles.libraryText}>{t('focus.open')}</Text>
          </PressableScale>
        )}
      </View>

      {count === 0 && <Text style={type.small}>{t('focus.empty')}</Text>}

      {current && progress && (
        <View style={styles.series}>
          <View style={{ gap: 6 }}>
            <Text style={type.label}>{t('series.continue')}</Text>
            <Text style={styles.seriesTitle} numberOfLines={1}>
              {current.title}
            </Text>
            <View style={styles.segments}>
              {Array.from({ length: progress.total }, (_, i) => (
                <View key={i} style={[styles.segment, { backgroundColor: i < progress.watched ? spec.accent : palette.hairline }]} />
              ))}
            </View>
            <Text style={type.small}>
              {t('series.season', { season: progress.seasonIndex + 1 })} · {t('series.episodes', { watched: progress.watched, total: progress.total })}
            </Text>
          </View>
          <Button label={t('series.logEpisode')} icon="plus" tone="accent" accent={spec.accent} onPress={() => onEpisode(current.id)} compact />
        </View>
      )}
    </Glass>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii }) => ({
  card: { padding: 14, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  libraryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.field,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  libraryText: { fontFamily: fonts.semibold, fontSize: 13, color: palette.ink },
  series: { gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.hairline, paddingTop: 12 },
  seriesTitle: { fontFamily: fonts.display, fontSize: 17, color: palette.ink },
  segments: { flexDirection: 'row', gap: 3, height: 5 },
  segment: { flex: 1, borderRadius: 3 },
}));
