import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import MentalPalace from '@/components/3d/MentalPalace';
import LogSheet from '@/components/ui/LogSheet';
import SeriesPanel from '@/components/ui/SeriesPanel';
import { theme } from '@/constants/theme';
import { CATEGORY_SPECS } from '@/lib/itemVisuals';
import { CategoryId } from '@/lib/types';
import type { LanguagePreference } from '@/locales/i18n';
import { selectActiveHero, selectRoomLevel, selectTotalItems, usePalaceStore } from '@/store/usePalaceStore';

const LANGUAGE_CYCLE: LanguagePreference[] = ['system', 'en', 'fr'];

/**
 * Single screen: the R3F room fills the viewport and IS the navigation.
 * Native UI floats above it with `pointerEvents="box-none"` so taps fall through to 3D.
 */
export default function PalaceScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const focus = usePalaceStore((s) => s.focus);
  const setFocus = usePalaceStore((s) => s.setFocus);
  const logItem = usePalaceStore((s) => s.logItem);
  const total = usePalaceStore(selectTotalItems);
  const level = usePalaceStore(selectRoomLevel);
  const language = usePalaceStore((s) => s.language);
  const setLanguage = usePalaceStore((s) => s.setLanguage);
  const hero = usePalaceStore(selectActiveHero);
  const heroItem = usePalaceStore((s) => (hero ? s.items[hero.itemId] : undefined));

  const [sheetOpen, setSheetOpen] = useState(false);

  const cycleLanguage = () => setLanguage(LANGUAGE_CYCLE[(LANGUAGE_CYCLE.indexOf(language) + 1) % LANGUAGE_CYCLE.length]);

  const onSubmit = (category: CategoryId, title: string, episodeCount: number) => {
    setFocus(category); // camera lands first; the hero waits for it, then materializes
    logItem(category, title, { episodeCount });
    setSheetOpen(false);
  };

  const heroCaption =
    hero && heroItem
      ? hero.kind === 'episode'
        ? `${heroItem.title} · ${t('series.progress', {
            season: hero.seasonIndex + 1,
            watched: hero.episodeIndex + 1,
            total: hero.episodeCount,
          })}`
        : heroItem.title
      : null;

  return (
    <View style={styles.root}>
      <MentalPalace />

      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
        {/* ---- Top bar */}
        <View style={styles.topBar}>
          {focus === 'overview' ? (
            <View>
              <Text style={styles.title}>{t('app.title')}</Text>
              <Text style={styles.meta}>
                {t('app.items', { count: total })} · {t('app.level', { level: level + 1 })}
              </Text>
            </View>
          ) : (
            <View style={styles.focusHead}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setFocus('overview')}
                hitSlop={12}
                style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
              >
                <Text style={styles.pillText}>‹ {t('app.back')}</Text>
              </Pressable>
              <View style={[styles.dot, { backgroundColor: CATEGORY_SPECS[focus].accent }]} />
              <Text style={styles.focusTitle}>{t(`categories.${focus}`)}</Text>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={cycleLanguage}
            style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
          >
            <Text style={styles.pillText}>{t(`language.${language}`)}</Text>
          </Pressable>
        </View>

        {/* ---- Hero caption (center-screen reward) */}
        <View pointerEvents="none" style={styles.captionWrap}>
          {heroCaption && (
            <Text numberOfLines={2} style={styles.caption}>
              {heroCaption}
            </Text>
          )}
        </View>

        {/* ---- Bottom */}
        <View pointerEvents="box-none" style={styles.bottom}>
          {focus === 'series' && <SeriesPanel />}
          {focus === 'overview' && <Text style={styles.hint}>{t('app.hint')}</Text>}
          <Pressable
            accessibilityRole="button"
            onPress={() => setSheetOpen(true)}
            style={({ pressed }) => [styles.logButton, pressed && styles.pressed]}
          >
            <Text style={styles.logPlus}>+</Text>
            <Text style={styles.logText}>{t('log.button')}</Text>
          </Pressable>
        </View>
      </View>

      <LogSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCategory={setFocus}
        onSubmit={onSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20 },
  title: { color: theme.text, fontSize: 26, fontWeight: '700', letterSpacing: 0.3 },
  meta: { color: theme.textDim, fontSize: 13, marginTop: 4, fontVariant: ['tabular-nums'] },
  focusHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  focusTitle: { color: theme.text, fontSize: 20, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pill: {
    backgroundColor: theme.glass,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.glassBorder,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillText: { color: theme.text, fontSize: 13, fontWeight: '600', letterSpacing: 0.4 },
  captionWrap: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 32, paddingBottom: 12 },
  caption: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.3,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 12,
  },
  bottom: { paddingHorizontal: 16, gap: 12 },
  hint: { color: theme.textFaint, fontSize: 13, textAlign: 'center', letterSpacing: 0.3 },
  logButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.primary,
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  logPlus: { color: theme.onPrimary, fontSize: 20, fontWeight: '500', lineHeight: 22 },
  logText: { color: theme.onPrimary, fontSize: 16, fontWeight: '600', letterSpacing: 0.3 },
  pressed: { opacity: 0.7 },
});
