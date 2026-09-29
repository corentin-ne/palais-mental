import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';

import CoverArt from '@/components/ui/CoverArt';
import Icon from '@/components/ui/Icon';
import PressableScale from '@/components/ui/PressableScale';
import { Button, Segmented, Toggle } from '@/components/ui/Controls';
import { FadeIn, useCountUp } from '@/components/ui/Motion';
import { makeStyles, useTheme } from '@/constants/theme';
import { CATEGORY_SPECS } from '@/lib/itemVisuals';
import { CATEGORIES, CategoryId } from '@/lib/types';
import type { LanguagePreference } from '@/locales/i18n';
import { usePalaceStore } from '@/store/usePalaceStore';

/** Your palace as a whole: its collections, what you love most, and settings. */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const { type } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const items = usePalaceStore((s) => s.items);
  const order = usePalaceStore((s) => s.order);
  const selectItem = usePalaceStore((s) => s.selectItem);
  const total = Object.keys(items).length;

  const favourites = useMemo(
    () =>
      Object.values(items)
        .filter((i) => (i.rating ?? 0) >= 4)
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.title.localeCompare(b.title))
        .slice(0, 12),
    [items],
  );
  const rated = Object.values(items).filter((i) => i.rating);
  const avg = rated.length ? rated.reduce((s, i) => s + (i.rating ?? 0), 0) / rated.length : 0;
  const shownTotal = Math.round(useCountUp(total));

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 }]}>
      <View style={{ gap: 2 }}>
        <Text style={type.serif}>{t('you.subtitle')}</Text>
        <Text style={type.display}>{t('you.title')}</Text>
      </View>

      <FadeIn style={styles.card}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.big}>{shownTotal}</Text>
            <Text style={type.small}>{t('you.objects', { count: total })}</Text>
          </View>
          {avg > 0 && <Text style={type.small}>{t('you.avg', { avg: avg.toFixed(1) })}</Text>}
        </View>
      </FadeIn>

      <View style={{ gap: 10 }}>
        <Text style={type.label}>{t('you.collections')}</Text>
        {CATEGORIES.map((c, i) => (
          <FadeIn key={c} index={i + 1}>
            <CollectionRow category={c} count={order[c].length} />
          </FadeIn>
        ))}
      </View>

      {favourites.length > 0 && (
        <View style={{ gap: 12 }}>
          <Text style={type.label}>{t('you.favourites')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
            {favourites.map((i, n) => (
              <FadeIn key={i.id} index={n}>
                <PressableScale onPress={() => selectItem(i.id)} depth={0.95}>
                  <CoverArt uri={i.coverUrl} title={i.title} category={i.category} width={96} aspect={2 / 3} />
                </PressableScale>
              </FadeIn>
            ))}
          </ScrollView>
        </View>
      )}

      <Settings />
    </ScrollView>
  );
}

function CollectionRow({ category, count }: { category: CategoryId; count: number }) {
  const { t } = useTranslation();
  const { type } = useTheme();
  const styles = useStyles();
  const spec = CATEGORY_SPECS[category];
  const shown = Math.round(useCountUp(count));
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: spec.tint }]}>
        <Icon name={category} size={20} color={spec.accent} strokeWidth={2} />
      </View>
      <Text style={[type.bodyMedium, { flex: 1 }]}>{t(`categories.${category}`)}</Text>
      <Text style={styles.rowCount}>{shown}</Text>
    </View>
  );
}

function Settings() {
  const { t } = useTranslation();
  const { type } = useTheme();
  const styles = useStyles();
  const language = usePalaceStore((s) => s.language);
  const setLanguage = usePalaceStore((s) => s.setLanguage);
  const settings = usePalaceStore((s) => s.settings);
  const setSetting = usePalaceStore((s) => s.setSetting);
  const resetPalace = usePalaceStore((s) => s.resetPalace);
  const [confirming, setConfirming] = useState(false);
  return (
    <View style={{ gap: 14 }}>
      <Text style={type.title}>{t('settings.title')}</Text>
      <View style={{ gap: 10 }}>
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
        <Toggle label={t('settings.notifications')} hint={t('settings.notificationsHint')} value={settings.notifications} onChange={(v) => setSetting('notifications', v)} />
        <View style={styles.divider} />
        <Toggle label={t('settings.ambient')} hint={t('settings.ambientHint')} value={settings.ambient} onChange={(v) => setSetting('ambient', v)} />
        <View style={styles.divider} />
        <Toggle label={t('settings.haptics')} value={settings.haptics} onChange={(v) => setSetting('haptics', v)} />
      </View>
      {confirming ? (
        <FadeIn style={styles.confirm}>
          <Text style={type.bodyMedium}>{t('settings.resetConfirm')}</Text>
          <View style={styles.confirmActions}>
            <Button label={t('settings.cancel')} tone="soft" compact onPress={() => setConfirming(false)} />
            <Button
              label={t('settings.resetYes')}
              tone="danger"
              compact
              onPress={() => {
                resetPalace();
                setConfirming(false);
              }}
            />
          </View>
        </FadeIn>
      ) : (
        <Button label={t('settings.reset')} tone="soft" icon="trash" onPress={() => setConfirming(true)} />
      )}
      <Text style={[type.small, { textAlign: 'center' }]}>{t('settings.version', { version: Constants.expoConfig?.version ?? '—' })}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii }) => ({
  root: { flex: 1, backgroundColor: palette.screen },
  content: { paddingHorizontal: 20, gap: 22, maxWidth: 720, width: '100%', alignSelf: 'center' },
  card: { backgroundColor: palette.surface, borderRadius: radii.lg, padding: 16, gap: 12, borderWidth: 1, borderColor: palette.hairline },
  rowBetween: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  big: { fontFamily: fonts.bold, fontSize: 44, letterSpacing: -1.8, color: palette.ink, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: palette.surface, borderRadius: radii.lg, padding: 14, borderWidth: 1, borderColor: palette.hairline },
  rowIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  rowCount: { fontFamily: fonts.bold, fontSize: 17, color: palette.ink, fontVariant: ['tabular-nums'] },
  divider: { height: 1, backgroundColor: palette.hairline },
  confirm: { gap: 12, backgroundColor: palette.dangerTint, borderRadius: radii.md, padding: 14 },
  confirmActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
}));
