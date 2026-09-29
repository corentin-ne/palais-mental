import { useRef } from 'react';
import { GestureResponderEvent, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import MentalPalace from '@/components/3d/MentalPalace';
import SafeBoundary from '@/components/ui/SafeBoundary';
import FocusCard from '@/components/ui/FocusCard';
import Glass from '@/components/ui/Glass';
import HeroCaption from '@/components/ui/HeroCaption';
import { FadeIn } from '@/components/ui/Motion';
import { roomProgress } from '@/lib/milestones';
import { useUiStore } from '@/store/useUiStore';
import Icon, { IconName } from '@/components/ui/Icon';
import PressableScale from '@/components/ui/PressableScale';
import { makeStyles, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { CATEGORY_SPECS } from '@/lib/itemVisuals';
import { ZONE_SEQUENCE } from '@/lib/palaceLayout';
import { sceneSignals, wakeAmbient } from '@/lib/sceneSignals';
import { CameraFocus } from '@/lib/types';
import { usePalaceStore } from '@/store/usePalaceStore';

const SWIPE_DISTANCE = 56;

/**
 * Your collection as a place. The camera stands in the room at eye level; the chips,
 * a swipe, or a tap on a niche turns it toward a collection. Tap an object to lift it
 * out and open it.
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

  const goTo = (next: CameraFocus) => {
    if (next === focus) return;
    haptics.select();
    setFocus(next);
  };

  // ---- Swipe to turn your head; while inspecting, the same drag spins the object.
  const touch = useRef({ x: 0, y: 0, t: 0, lastX: 0 });
  const onTouchStart = (e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    touch.current = { x: pageX, y: pageY, t: Date.now(), lastX: pageX };
    wakeAmbient(5);
  };
  const onTouchMove = (e: GestureResponderEvent) => {
    if (!usePalaceStore.getState().inspectId) return;
    const { pageX } = e.nativeEvent;
    sceneSignals.inspectSpin += (pageX - touch.current.lastX) * 0.012;
    touch.current.lastX = pageX;
    sceneSignals.requestFrame?.();
  };
  const onTouchEnd = (e: GestureResponderEvent) => {
    if (usePalaceStore.getState().inspectId) return;
    const dx = e.nativeEvent.pageX - touch.current.x;
    const dy = e.nativeEvent.pageY - touch.current.y;
    if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.6 || Date.now() - touch.current.t > 700) return;
    const i = ZONE_SEQUENCE.indexOf(focus);
    const n = ZONE_SEQUENCE.length;
    goTo(ZONE_SEQUENCE[(i + (dx < 0 ? 1 : -1) + n) % n]);
  };

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <SafeBoundary label="palace" fallback={null}>
          <MentalPalace />
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

        <View pointerEvents="none" style={styles.caption}>
          <HeroCaption />
        </View>

        <View pointerEvents="box-none" style={styles.bottom}>
          {focus === 'window' && !selectedId && <WindowCard />}
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

/** At the window: how big the palace is and how close the next room is (goal gradient). */
function WindowCard() {
  const { t } = useTranslation();
  const { palette, type } = useTheme();
  const styles = useStyles();
  const total = usePalaceStore((s) => Object.keys(s.items).length);
  const openSearch = useUiStore((s) => s.openSearch);
  const room = roomProgress(total);
  return (
    <FadeIn delay={400}>
      <Glass radius={22} contentStyle={styles.windowCard}>
        {total === 0 ? (
          <PressableScale onPress={() => openSearch('all')} style={styles.windowRow} depth={0.98}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={type.heading}>{t('palace.emptyTitle')}</Text>
              <Text style={type.small}>{t('palace.emptyBody')}</Text>
            </View>
            <Icon name="chevronRight" size={20} color={palette.inkSoft} />
          </PressableScale>
        ) : (
          <View style={{ gap: 8 }}>
            <View style={styles.windowRow}>
              <Text style={type.heading}>{t('palace.objects', { count: total })}</Text>
              <Text style={type.small}>{t('you.room', { level: room.level + 1 })}</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.max(3, room.fraction * 100)}%` }]} />
            </View>
            <Text style={type.small}>{room.to === null ? t('you.roomMax') : t('you.roomNext', { count: room.remaining })}</Text>
          </View>
        )}
      </Glass>
    </FadeIn>
  );
}

const useStyles = makeStyles(({ palette, fonts }) => ({
  windowCard: { padding: 14 },
  windowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  track: { height: 5, borderRadius: 3, backgroundColor: palette.field, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3, backgroundColor: palette.ink },
  root: { flex: 1, backgroundColor: palette.bg },
  chips: { paddingHorizontal: 16, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14 },
  chipText: { fontFamily: fonts.semibold, fontSize: 13.5, color: palette.inkSoft },
  caption: { paddingTop: 16, alignItems: 'center' },
  bottom: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
}));
