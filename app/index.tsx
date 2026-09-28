import { useRef, useState } from 'react';
import { GestureResponderEvent, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import MentalPalace from '@/components/3d/MentalPalace';
import Dock from '@/components/ui/Dock';
import FocusCard from '@/components/ui/FocusCard';
import HeroCaption from '@/components/ui/HeroCaption';
import ItemSheet from '@/components/ui/ItemSheet';
import LibrarySheet from '@/components/ui/LibrarySheet';
import LogSheet from '@/components/ui/LogSheet';
import SettingsSheet from '@/components/ui/SettingsSheet';
import TopBar from '@/components/ui/TopBar';
import { palette, type } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { ZONE_SEQUENCE } from '@/lib/palaceLayout';
import { sceneSignals, wakeAmbient } from '@/lib/sceneSignals';
import { CameraFocus, CategoryId, ItemDetails, PalaceItem } from '@/lib/types';
import { selectRoomLevel, selectTotalItems, usePalaceStore } from '@/store/usePalaceStore';

const SWIPE_DISTANCE = 56;

/**
 * Single screen: the R3F room fills the viewport and IS the navigation. At rest the
 * camera stands in the room gazing at the sunlit window; the dock, a swipe, or a tap
 * on a niche turns it toward a collection. Native UI floats above with
 * `pointerEvents="box-none"` so taps fall through to the 3D scene.
 */
export default function PalaceScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();

  const focus = usePalaceStore((s) => s.focus);
  const setFocus = usePalaceStore((s) => s.setFocus);
  const logItem = usePalaceStore((s) => s.logItem);
  const logEpisode = usePalaceStore((s) => s.logEpisode);
  const selectItem = usePalaceStore((s) => s.selectItem);
  const selectedId = usePalaceStore((s) => s.selectedId);
  const total = usePalaceStore(selectTotalItems);
  const level = usePalaceStore(selectRoomLevel);

  const [sheet, setSheet] = useState<null | 'log' | 'library' | 'settings'>(null);
  const [libraryScope, setLibraryScope] = useState<CategoryId | 'all'>('all');

  const goTo = (next: CameraFocus) => {
    if (next === focus) return;
    haptics.select();
    setFocus(next);
  };

  const onSubmit = (category: CategoryId, details: ItemDetails, episodeCount: number) => {
    setFocus(category); // camera lands first; the hero waits for it, then materializes
    logItem(category, details, { episodeCount });
    setSheet(null);
    haptics.success();
  };

  const onEpisode = (id: string) => {
    const event = logEpisode(id);
    if (event) (event.kind === 'episode' && event.completesSeason ? haptics.success : haptics.tap)();
  };

  const openItem = (item: PalaceItem) => {
    setSheet(null);
    setFocus(item.category);
    selectItem(item.id);
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
    if (usePalaceStore.getState().inspectId || sheet) return;
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
        <MentalPalace />
      </View>

      <View
        pointerEvents="box-none"
        style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 10 }]}
      >
        <TopBar
          focus={focus}
          total={total}
          level={level}
          onSearch={() => {
            setLibraryScope(focus === 'window' ? 'all' : focus);
            setSheet('library');
          }}
          onSettings={() => setSheet('settings')}
        />

        <View pointerEvents="none" style={styles.caption}>
          <HeroCaption />
        </View>

        <View pointerEvents="box-none" style={styles.bottom}>
          {focus !== 'window' && !selectedId && (
            <View style={styles.cardWrap} pointerEvents="box-none">
              <FocusCard
                category={focus}
                onEpisode={onEpisode}
                onLibrary={() => {
                  setLibraryScope(focus);
                  setSheet('library');
                }}
              />
            </View>
          )}
          {focus === 'window' && (
            <Text style={styles.hint} pointerEvents="none">
              {total === 0 ? t('app.hintEmpty') : t('app.hint')}
            </Text>
          )}
          <Dock focus={focus} onFocus={goTo} onAdd={() => setSheet('log')} />
        </View>
      </View>

      <LogSheet
        visible={sheet === 'log'}
        onClose={() => setSheet(null)}
        onCategory={setFocus}
        onSubmit={onSubmit}
        initialCategory={focus === 'window' ? null : focus}
      />
      <LibrarySheet visible={sheet === 'library'} initialScope={libraryScope} onClose={() => setSheet(null)} onOpenItem={openItem} />
      <SettingsSheet visible={sheet === 'settings'} onClose={() => setSheet(null)} />
      <ItemSheet onEpisode={onEpisode} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  caption: { paddingTop: 18, alignItems: 'center' },
  bottom: { flex: 1, justifyContent: 'flex-end', gap: 12 },
  cardWrap: { paddingHorizontal: 16, width: '100%', maxWidth: 520, alignSelf: 'center' },
  hint: { ...type.small, textAlign: 'center', paddingHorizontal: 32, textShadowColor: 'rgba(255,250,244,0.9)', textShadowRadius: 10 },
});
