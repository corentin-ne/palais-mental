import { useRef } from 'react';
import { GestureResponderEvent, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import OceanWorld from '@/components/3d/ocean/OceanWorld';
import SafeBoundary from '@/components/ui/SafeBoundary';
import FocusCard from '@/components/ui/FocusCard';
import Glass from '@/components/ui/Glass';
import Icon, { IconName } from '@/components/ui/Icon';
import PressableScale from '@/components/ui/PressableScale';
import { makeStyles, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { CATEGORY_SPECS } from '@/lib/itemVisuals';
import { ZONE_SEQUENCE } from '@/lib/palaceLayout';
import { tapWater } from '@/lib/oceanSignals';
import { CameraFocus } from '@/lib/types';
import { usePalaceStore } from '@/store/usePalaceStore';

const SWIPE_DISTANCE = 56;

/**
 * Your collection as a place: an open sea. You float just above the water; each collection is
 * an island on the horizon, and the chips or a swipe turn your head toward one. Tap the water
 * to ripple it. What you log falls into the sea as a drop.
 */
export default function PalaceScreen() {
  const { palette, radii } = useTheme();
  const styles = useStyles();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const focus = usePalaceStore((s) => s.focus);
  const setFocus = usePalaceStore((s) => s.setFocus);
  const logEpisode = usePalaceStore((s) => s.logEpisode);
  const selectedId = usePalaceStore((s) => s.selectedId);
  const screen = useWindowDimensions();

  const goTo = (next: CameraFocus) => {
    if (next === focus) return;
    haptics.select();
    setFocus(next);
  };

  // ---- Swipe to turn your head; a tap ripples the water under your finger.
  const touch = useRef({ x: 0, y: 0, t: 0 });
  const onTouchStart = (e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    touch.current = { x: pageX, y: pageY, t: Date.now() };
  };
  const onTouchEnd = (e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    const dx = pageX - touch.current.x;
    const dy = pageY - touch.current.y;
    if (Math.hypot(dx, dy) < 10 && Date.now() - touch.current.t < 400) {
      tapWater((pageX / screen.width) * 2 - 1, 1 - (pageY / screen.height) * 2);
      return;
    }
    if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.6 || Date.now() - touch.current.t > 700) return;
    const i = ZONE_SEQUENCE.indexOf(focus);
    const n = ZONE_SEQUENCE.length;
    goTo(ZONE_SEQUENCE[(i + (dx < 0 ? 1 : -1) + n) % n]);
  };

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <SafeBoundary label="palace" fallback={null}>
          <OceanWorld />
        </SafeBoundary>
      </View>

      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 104 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0 }}>
          {ZONE_SEQUENCE.map((z) => {
            const active = z === focus;
            const accent = z === 'window' ? palette.ink : CATEGORY_SPECS[z].accent;
            return (
              <PressableScale key={z} onPress={() => goTo(z)} depth={0.92}>
                <Glass radius={radii.pill} strong={active} contentStyle={styles.chip}>
                  <Icon name={z as IconName} size={16} color={active ? accent : palette.inkSoft} strokeWidth={active ? 2.2 : 1.8} />
                  <Text style={[styles.chipText, active && { color: palette.ink }]}>
                    {z === 'window' ? t('nav.window') : t(`categories.${z}`)}
                  </Text>
                </Glass>
              </PressableScale>
            );
          })}
        </ScrollView>

        <View pointerEvents="box-none" style={styles.bottom}>
          {focus !== 'window' && !selectedId && (
            <FocusCard
              category={focus}
              onEpisode={(id) => {
                const ev = logEpisode(id, { animate: true });
                if (ev) (ev.kind === 'episode' && ev.completesSeason ? haptics.success : haptics.tap)();
              }}
              onLibrary={() => router.navigate({ pathname: '/library', params: { c: focus } })}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ palette, fonts }) => ({
  root: { flex: 1, backgroundColor: palette.bg },
  chips: { paddingHorizontal: 16, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14 },
  chipText: { fontFamily: fonts.semibold, fontSize: 13.5, color: palette.inkSoft },
  bottom: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
}));
