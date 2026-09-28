import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';

import CoverArt from '@/components/ui/CoverArt';
import Icon from '@/components/ui/Icon';
import PressableScale from '@/components/ui/PressableScale';
import { Button, Segmented, Toggle } from '@/components/ui/Controls';
import { fonts, palette, radii, type } from '@/constants/theme';
import { CATEGORY_SPECS } from '@/lib/itemVisuals';
import { averageRating, byMonth, countsByCategory, currentStreak, eventsInYear } from '@/lib/stats';
import { CATEGORIES } from '@/lib/types';
import type { LanguagePreference } from '@/locales/i18n';
import { usePalaceStore } from '@/store/usePalaceStore';

/** Your year in numbers, your favourites, and the app's few settings. */
export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const events = usePalaceStore((s) => s.events);
  const items = usePalaceStore((s) => s.items);
  const selectItem = usePalaceStore((s) => s.selectItem);
  const year = new Date().getFullYear();

  const stats = useMemo(() => {
    const yearEvents = eventsInYear(events, year);
    const list = Object.values(items);
    return {
      total: yearEvents.length,
      byCat: countsByCategory(yearEvents, items),
      months: byMonth(yearEvents),
      streak: currentStreak(events),
      avg: averageRating(list),
      favourites: list
        .filter((i) => (i.rating ?? 0) >= 4)
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.lastLoggedAt ?? 0) - (a.lastLoggedAt ?? 0))
        .slice(0, 12),
    };
  }, [events, items, year]);

  const maxMonth = Math.max(1, ...stats.months);
  const month = new Date().getMonth();
  const monthLetters = Array.from({ length: 12 }, (_, m) =>
    new Intl.DateTimeFormat(i18n.language, { month: 'narrow' }).format(new Date(year, m, 1)),
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 }]}>
      <View style={{ gap: 2 }}>
        <Text style={type.serif}>{t('you.subtitle', { year })}</Text>
        <Text style={type.display}>{t('you.title')}</Text>
      </View>

      <View style={styles.bigRow}>
        <Big value={String(stats.total)} label={t('you.logs', { count: stats.total })} />
        <Big value={String(stats.streak)} label={t('you.streak', { count: stats.streak })} />
        <Big value={stats.avg ? stats.avg.toFixed(1) : '–'} label={t('you.avg')} />
      </View>

      <View style={styles.card}>
        <Text style={type.label}>{t('you.byCategory')}</Text>
        <View style={styles.stack}>
          {CATEGORIES.map((c) =>
            stats.byCat[c] ? (
              <View key={c} style={{ flex: stats.byCat[c], backgroundColor: CATEGORY_SPECS[c].accent }} />
            ) : null,
          )}
          {stats.total === 0 && <View style={{ flex: 1, backgroundColor: palette.hairline }} />}
        </View>
        <View style={styles.legend}>
          {CATEGORIES.map((c) => (
            <View key={c} style={styles.legendItem}>
              <Icon name={c} size={16} color={CATEGORY_SPECS[c].accent} strokeWidth={2} />
              <Text style={styles.legendValue}>{stats.byCat[c]}</Text>
              <Text style={styles.legendLabel} numberOfLines={1}>
                {t(`categories.${c}`)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={type.label}>{t('you.byMonth')}</Text>
        <View style={styles.bars}>
          {stats.months.map((v, m) => (
            <View key={m} style={styles.barCol}>
              <Text style={styles.barValue}>{v || ''}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height: `${(v / maxMonth) * 100}%`, backgroundColor: m === month ? palette.ink : palette.fieldActive }]} />
              </View>
              <Text style={[styles.barLabel, m === month && { color: palette.ink }]}>{monthLetters[m]}</Text>
            </View>
          ))}
        </View>
      </View>

      {stats.favourites.length > 0 && (
        <View style={{ gap: 12 }}>
          <Text style={type.label}>{t('you.favourites')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
            {stats.favourites.map((i) => (
              <PressableScale key={i.id} onPress={() => selectItem(i.id)} depth={0.95}>
                <CoverArt uri={i.coverUrl} title={i.title} category={i.category} width={96} aspect={2 / 3} />
              </PressableScale>
            ))}
          </ScrollView>
        </View>
      )}

      <Settings />
    </ScrollView>
  );
}

function Big({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.big}>
      <Text style={styles.bigValue}>{value}</Text>
      <Text style={styles.bigLabel}>{label}</Text>
    </View>
  );
}

function Settings() {
  const { t } = useTranslation();
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
        <Toggle label={t('settings.ambient')} hint={t('settings.ambientHint')} value={settings.ambient} onChange={(v) => setSetting('ambient', v)} />
        <View style={styles.divider} />
        <Toggle label={t('settings.haptics')} value={settings.haptics} onChange={(v) => setSetting('haptics', v)} />
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
                setConfirming(false);
              }}
            />
          </View>
        </View>
      ) : (
        <Button label={t('settings.reset')} tone="soft" icon="trash" onPress={() => setConfirming(true)} />
      )}
      <Text style={[type.small, { textAlign: 'center' }]}>{t('settings.version', { version: Constants.expoConfig?.version ?? '—' })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  content: { paddingHorizontal: 20, gap: 22, maxWidth: 720, width: '100%', alignSelf: 'center' },
  bigRow: { flexDirection: 'row', gap: 10 },
  big: { flex: 1, backgroundColor: palette.surface, borderRadius: radii.lg, padding: 14, gap: 2, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.hairline },
  bigValue: { fontFamily: fonts.bold, fontSize: 32, letterSpacing: -1.2, color: palette.ink, fontVariant: ['tabular-nums'] },
  bigLabel: { fontFamily: fonts.medium, fontSize: 12.5, color: palette.inkSoft },
  card: { backgroundColor: palette.surface, borderRadius: radii.lg, padding: 16, gap: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.hairline },
  stack: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  legendItem: { width: '33.33%', gap: 2 },
  legendValue: { fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.6, color: palette.ink, fontVariant: ['tabular-nums'] },
  legendLabel: { fontFamily: fonts.medium, fontSize: 12, color: palette.inkSoft },
  bars: { flexDirection: 'row', gap: 6, height: 130 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barValue: { fontFamily: fonts.medium, fontSize: 10, color: palette.inkSoft, height: 13, fontVariant: ['tabular-nums'] },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 4, minHeight: 3 },
  barLabel: { fontFamily: fonts.semibold, fontSize: 11, color: palette.inkFaint, textTransform: 'uppercase' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: palette.hairline },
  confirm: { gap: 12, backgroundColor: palette.dangerTint, borderRadius: radii.md, padding: 14 },
  confirmActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
});
