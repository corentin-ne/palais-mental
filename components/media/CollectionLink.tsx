import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import Icon from '@/components/ui/Icon';
import PressableScale from '@/components/ui/PressableScale';
import { makeStyles, useTheme } from '@/constants/theme';
import { CollectionItem, collectionHref, seriesOf } from '@/lib/collections';
import type { SeriesKind } from '@/lib/series';

/** "Part of One Piece · #3": opens the whole series, each entry with its tick. */
export default function CollectionLink({ kind, item }: { kind: SeriesKind; item: CollectionItem }) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const s = seriesOf(item);
  if (!s) return null;
  return (
    <PressableScale depth={0.98} style={styles.row} onPress={() => router.push(collectionHref(kind, s, item.wikidataId) as never)} accessibilityLabel={t('collection.open', { name: s.name })}>
      <View style={styles.icon}>
        <Icon name="library" size={18} color={palette.primaryText} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={styles.label}>{t('collection.partOf')}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {[s.name, s.ordinal != null ? `#${s.ordinal}` : undefined].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Text style={styles.all}>{t('collection.seeAll')}</Text>
      <Icon name="chevronRight" size={16} color={palette.inkFaint} />
    </PressableScale>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, type }) => ({
  row: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radii.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primaryTint },
  label: { ...type.label },
  name: { ...fonts.semibold, fontSize: 14.5, color: palette.ink },
  all: { ...fonts.semibold, fontSize: 13, color: palette.primaryText },
}));
