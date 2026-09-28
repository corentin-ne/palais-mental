import { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { BottomTabBarProps } from 'expo-router/tabs';

import Glass from './Glass';
import Icon, { IconName } from './Icon';
import PressableScale from './PressableScale';
import { makeStyles, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { getUpcoming } from '@/lib/releases';
import { usePalaceStore } from '@/store/usePalaceStore';
import { useUiStore } from '@/store/useUiStore';

const TABS: Record<string, { icon: IconName; label: string }> = {
  index: { icon: 'window', label: 'tabs.palace' },
  library: { icon: 'grid', label: 'tabs.library' },
  soon: { icon: 'bell', label: 'tabs.soon' },
  profile: { icon: 'user', label: 'tabs.you' },
};
const TAB_W = 66;
const ADD_W = 64;

/**
 * Floating glass tab bar with the add button at its heart (thumb zone, largest target).
 * A soft pill slides under the active tab so the eye follows the move.
 */
export default function TabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const { palette, motion } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const openSearch = useUiStore((s) => s.openSearch);
  const focus = usePalaceStore((s) => s.focus);
  const upcomingCount = usePalaceStore((s) => getUpcoming(s.items).length);

  const routes = state.routes.filter((r) => TABS[r.name]);
  const half = Math.ceil(routes.length / 2);
  const activeName = state.routes[state.index]?.name;
  const visualIndex = Math.max(0, routes.findIndex((r) => r.name === activeName));
  const pillX = visualIndex * TAB_W + (visualIndex >= half ? ADD_W : 0);

  const x = useRef(new Animated.Value(pillX)).current;
  useEffect(() => {
    Animated.spring(x, { toValue: pillX, useNativeDriver: true, ...motion.spring }).start();
  }, [pillX, x, motion.spring]);

  // The + bounces once at launch: a hint of where the action is (signifier, not a tutorial).
  const [bar, setBar] = useState(0);
  const hint = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(900),
      Animated.spring(hint, { toValue: 1, useNativeDriver: true, damping: 6, stiffness: 260 }),
      Animated.spring(hint, { toValue: 0, useNativeDriver: true, damping: 12, stiffness: 200 }),
    ]).start();
  }, [hint]);

  const renderTab = (route: (typeof routes)[number]) => {
    const index = state.routes.indexOf(route);
    const active = state.index === index;
    const tab = TABS[route.name];
    return (
      <PressableScale
        key={route.key}
        depth={0.88}
        accessibilityLabel={t(tab.label)}
        accessibilityState={{ selected: active }}
        style={styles.tab}
        onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!active && !event.defaultPrevented) {
            haptics.select();
            navigation.navigate(route.name);
          }
        }}
      >
        <View>
          <Icon name={tab.icon} size={22} color={active ? palette.ink : palette.inkFaint} strokeWidth={active ? 2 : 1.7} />
          {route.name === 'soon' && upcomingCount > 0 && <View style={styles.dot} />}
        </View>
        <Text style={[styles.label, active && styles.labelActive]}>{t(tab.label)}</Text>
      </PressableScale>
    );
  };

  const onPalace = activeName === 'index';

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + 8 }]} pointerEvents="box-none">
      <Glass radius={30} contentStyle={styles.bar} strong>
        <View style={styles.row} onLayout={(e: LayoutChangeEvent) => setBar(e.nativeEvent.layout.width)}>
          {bar > 0 && <Animated.View style={[styles.pill, { transform: [{ translateX: x }] }]} />}
          {routes.slice(0, half).map(renderTab)}
          <View style={styles.addSlot} />
          {routes.slice(half).map(renderTab)}
        </View>
      </Glass>
      <View style={styles.addWrap} pointerEvents="box-none">
        <Animated.View style={{ transform: [{ translateY: hint.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] }}>
          <PressableScale
            onPress={() => {
              haptics.tap();
              openSearch(onPalace && focus !== 'window' ? focus : 'all');
            }}
            accessibilityLabel={t('nav.add')}
            style={styles.add}
            depth={0.88}
          >
            <Icon name="plus" size={26} color={palette.onInk} strokeWidth={2.3} />
          </PressableScale>
        </Animated.View>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ palette, fonts, shadow }) => ({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: 16 },
  bar: { paddingHorizontal: 8, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  pill: { position: 'absolute', left: 0, top: 0, width: TAB_W, height: 52, borderRadius: 18, backgroundColor: palette.field },
  tab: { width: TAB_W, height: 52, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontFamily: fonts.medium, fontSize: 10.5, color: palette.inkFaint, letterSpacing: 0.1 },
  labelActive: { color: palette.ink, fontFamily: fonts.semibold },
  dot: { position: 'absolute', top: -1, right: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: palette.danger, borderWidth: 1.5, borderColor: palette.surface },
  addSlot: { width: ADD_W },
  addWrap: { position: 'absolute', top: -12, left: 0, right: 0, alignItems: 'center' },
  add: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.lifted,
  },
}));
