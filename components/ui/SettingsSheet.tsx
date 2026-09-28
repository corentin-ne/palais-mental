import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';

import Sheet from './Sheet';
import Icon from './Icon';
import { Button, Segmented, Toggle } from './Controls';
import { fonts, palette, radii, type } from '@/constants/theme';
import { CATEGORY_SPECS } from '@/lib/itemVisuals';
import { CATEGORIES } from '@/lib/types';
import type { LanguagePreference } from '@/locales/i18n';
import { selectRoomLevel, usePalaceStore } from '@/store/usePalaceStore';

export default function SettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const language = usePalaceStore((s) => s.language);
  const setLanguage = usePalaceStore((s) => s.setLanguage);
  const settings = usePalaceStore((s) => s.settings);
  const setSetting = usePalaceStore((s) => s.setSetting);
  const order = usePalaceStore((s) => s.order);
  const level = usePalaceStore(selectRoomLevel);
  const resetPalace = usePalaceStore((s) => s.resetPalace);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!visible) setConfirming(false);
  }, [visible]);

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={type.title}>{t('settings.title')}</Text>

      <View style={styles.section}>
        <Text style={type.label}>{t('settings.language')}</Text>
        <Segmented<LanguagePreference>
          value={language}
          onChange={setLanguage}
          options={[
            { value: 'system', label: t('language.system') },
            { value: 'en', label: t('language.en') },
            { value: 'fr', label: t('language.fr') },
          ]}
        />
      </View>

      <View style={styles.card}>
        <Toggle label={t('settings.ambient')} hint={t('settings.ambientHint')} value={settings.ambient} onChange={(v) => setSetting('ambient', v)} />
        <View style={styles.divider} />
        <Toggle label={t('settings.haptics')} value={settings.haptics} onChange={(v) => setSetting('haptics', v)} />
      </View>

      <View style={styles.section}>
        <View style={styles.rowBetween}>
          <Text style={type.label}>{t('settings.palace')}</Text>
          <Text style={type.small}>{t('settings.level', { level: level + 1 })}</Text>
        </View>
        <View style={styles.stats}>
          {[0, 3].map((row) => (
            <View key={row} style={styles.statsRow}>
          {CATEGORIES.slice(row, row + 3).map((c) => (
            <View key={c} style={[styles.stat, { backgroundColor: CATEGORY_SPECS[c].tint }]}>
              <Icon name={c} size={18} color={CATEGORY_SPECS[c].accent} strokeWidth={2} />
              <Text style={styles.statValue}>{order[c].length}</Text>
              <Text style={styles.statLabel} numberOfLines={1}>
                {t(`categories.${c}`)}
              </Text>
            </View>
          ))}
            </View>
          ))}
        </View>
      </View>

      {confirming ? (
        <View style={styles.confirm}>
          <Text style={type.bodyMedium}>{t('settings.resetConfirm')}</Text>
          <View style={styles.confirmActions}>
            <Button label={t('settings.cancel')} tone="soft" compact onPress={() => setConfirming(false)} />
            <Button
              label={t('settings.resetYes')}
              tone="danger"
              compact
              onPress={() => {
                resetPalace();
                onClose();
              }}
            />
          </View>
        </View>
      ) : (
        <Button label={t('settings.reset')} tone="soft" icon="trash" onPress={() => setConfirming(true)} />
      )}

      <Text style={[type.small, styles.version]}>
        {t('settings.version', { version: Constants.expoConfig?.version ?? '—' })}
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  card: { backgroundColor: palette.field, borderRadius: radii.lg, padding: 16, gap: 14 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: palette.hairline },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stats: { gap: 8 },
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderRadius: radii.md, padding: 12, gap: 6 },
  statValue: { fontFamily: fonts.display, fontSize: 24, color: palette.ink, fontVariant: ['tabular-nums'] },
  statLabel: { fontFamily: fonts.medium, fontSize: 12, color: palette.inkSoft },
  confirm: { gap: 12, backgroundColor: palette.dangerTint, borderRadius: radii.md, padding: 14 },
  confirmActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  version: { textAlign: 'center' },
});
