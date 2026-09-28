import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Glass from './Glass';
import Icon from './Icon';
import PressableScale from './PressableScale';
import { fonts, palette, type } from '@/constants/theme';
import { CameraFocus } from '@/lib/types';

interface Props {
  focus: CameraFocus;
  total: number;
  level: number;
  onSearch: () => void;
  onSettings: () => void;
}

/** Wordmark and quiet counters at rest; a round glass pair of actions on the right. */
export default function TopBar({ focus, total, level, onSearch, onSettings }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.row} pointerEvents="box-none">
      <View style={styles.titleBlock} pointerEvents="none">
        {focus === 'window' ? (
          <>
            <Text style={styles.wordmark}>{t('app.title')}</Text>
            <Text style={styles.meta}>
              {t('app.items', { count: total })}  ·  {t('app.level', { level: level + 1 })}
            </Text>
          </>
        ) : (
          <Text style={styles.wordmarkSmall}>{t('app.title')}</Text>
        )}
      </View>
      <View style={styles.actions}>
        <RoundGlass icon="search" label={t('nav.library')} onPress={onSearch} />
        <RoundGlass icon="settings" label={t('nav.settings')} onPress={onSettings} />
      </View>
    </View>
  );
}

function RoundGlass({ icon, label, onPress }: { icon: 'search' | 'settings'; label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} hitSlop={6}>
      <Glass radius={22} contentStyle={styles.round}>
        <Icon name={icon} size={20} />
      </Glass>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20 },
  titleBlock: { flexShrink: 1, gap: 2, paddingTop: 2 },
  wordmark: { ...type.hero, textShadowColor: 'rgba(255,250,244,0.9)', textShadowRadius: 16 },
  wordmarkSmall: { fontFamily: fonts.displayItalic, fontSize: 17, color: palette.inkSoft, paddingTop: 10 },
  meta: { ...type.small, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: 10 },
  round: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
