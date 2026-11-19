import { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import PressableScale from '@/components/ui/PressableScale';
import { FadeIn, useCountUp } from '@/components/ui/Motion';
import { makeStyles, useTheme } from '@/constants/theme';
import { CriticScore, criticScores, scoreUrl } from '@/lib/scores';
import { Meter } from '@/spark';

const NAMES = { rt: 'Rotten Tomatoes', mc: 'Metacritic', imdb: 'IMDb' } as const;

/** Critics and audiences in three tiles: the score as each site writes it, a bar that fills to it. */
export default function CriticScores({ title, imdbId, wikidataId }: { title: string; imdbId?: string; wikidataId?: string }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const [scores, setScores] = useState<CriticScore[]>([]);
  useEffect(() => {
    let live = true;
    setScores([]);
    if (imdbId || wikidataId) criticScores({ imdbId, wikidataId }).then((s) => live && setScores(s));
    return () => {
      live = false;
    };
  }, [imdbId, wikidataId]);
  if (!scores.length) return null;
  return (
    <FadeIn style={{ marginTop: 30, gap: 14 }}>
      <Text style={styles.heading}>{t('scores.title')}</Text>
      <View style={styles.row}>
        {scores.map((s, i) => (
          <Tile key={s.source} score={s} index={i} onPress={() => Linking.openURL(scoreUrl(s.source, title, imdbId)).catch(() => undefined)} />
        ))}
      </View>
      <Text style={styles.credit}>{t('scores.credit')}</Text>
    </FadeIn>
  );
}

function Tile({ score, onPress, index }: { score: CriticScore; onPress: () => void; index: number }) {
  const styles = useStyles();
  const { palette } = useTheme();
  const f = score.fraction ?? 0;
  const shown = useCountUp(f, 900 + index * 150);
  // Fixed verdict colours, as review sites use them: good, mixed, poor.
  const color = f >= 0.75 ? palette.success : f >= 0.55 ? palette.warning : palette.danger;
  return (
    <PressableScale depth={0.97} onPress={onPress} style={styles.tile} accessibilityLabel={`${NAMES[score.source]} ${score.value}`} accessibilityRole="link">
      <Text style={styles.source} numberOfLines={2}>
        {NAMES[score.source]}
      </Text>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {score.value}
      </Text>
      {score.fraction != null && <Meter value={shown} color={color} height={4} />}
    </PressableScale>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  heading: { ...type.title },
  row: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, padding: 12, gap: 6, borderRadius: radii.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  source: { ...type.label, fontSize: 10, lineHeight: 12, minHeight: 24 },
  value: { ...fonts.bold, fontSize: 20, letterSpacing: -0.5, color: palette.ink, fontVariant: ['tabular-nums'] },
  credit: { ...type.small, fontSize: 11 },
}));
