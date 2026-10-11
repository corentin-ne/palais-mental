import { ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import PressableScale from '@/components/ui/PressableScale';
import { makeStyles, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { useLayout } from '@/hooks/useLayout';
import { hasAired, seasonsOf } from '@/lib/progress';

/** The seasons, side by side: a dot on the ones you have seen in full. */
export default function SeasonChips({
  seasons,
  current,
  watched,
  onPick,
}: {
  seasons: ReturnType<typeof seasonsOf>;
  current?: number;
  watched: Record<string, number>;
  onPick: (season: number) => void;
}) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const haptics = useHaptics();
  const { gutter } = useLayout();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ paddingHorizontal: gutter, gap: 8 }}>
      {seasons.map((s) => {
        const active = s.season === current;
        const aired = s.episodes.filter((e) => hasAired(e));
        const done = aired.length > 0 && aired.every((e) => watched[e.id]);
        return (
          <PressableScale
            key={s.season}
            depth={0.92}
            onPress={() => {
              haptics.select();
              onPick(s.season);
            }}
            style={[styles.seasonChip, active && styles.seasonChipActive]}
          >
            <Text style={[styles.seasonChipText, active && { color: palette.ink }]}>{t('show.season', { n: s.season })}</Text>
            {done && <View style={[styles.doneDot, active && { backgroundColor: palette.screen }]} />}
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles(({ palette, fonts }) => ({
  seasonChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 15, borderRadius: 18, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  seasonChipActive: { backgroundColor: palette.primaryTint, borderColor: palette.primaryRing },
  seasonChipText: { ...fonts.semibold, fontSize: 13.5, color: palette.ink },
  doneDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.success },
}));
