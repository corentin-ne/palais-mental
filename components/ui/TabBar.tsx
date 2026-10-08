import { ReactNode, useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { BottomTabBarProps } from 'expo-router/tabs';

import Glass from './Glass';
import Icon, { IconName } from './Icon';
import PressableScale from './PressableScale';
import { makeStyles, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { useRouter } from 'expo-router';
import { useLibrary } from '@/store/useLibrary';

const TABS: Record<string, { icon: IconName; label: string }> = {
  index: { icon: 'play', label: 'tabs.upNext' },
  calendar: { icon: 'calendar', label: 'tabs.calendar' },
  library: { icon: 'grid', label: 'tabs.library' },
  profile: { icon: 'user', label: 'tabs.you' },
};
const TAB_W = 68;
const DAY = 86_400_000;
const ADD_W = 64;

/**
 * Floating glass tab bar with search at its heart (thumb zone, largest target).
 * The active tab is all accent: its icon (bolder, a touch larger) and its label in bold.
 */
export default function TabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const { palette, motion, spark } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const router = useRouter();
  // A dot on the calendar when something you follow comes out within a day.
  const soon = useLibrary((s) => {
    const now = Date.now();
    const inDay = (d?: number) => !!d && d > now - DAY / 2 && d < now + DAY;
    return (
      Object.values(s.shows).some((sh) => !sh.droppedAt && sh.episodes.some((e) => inDay(e.airstamp))) ||
      Object.values(s.movies).some((m) => !m.watchedAt && inDay(m.releaseDate))
    );
  });

  const routes = state.routes.filter((r) => TABS[r.name]);
  const half = Math.ceil(routes.length / 2);

  // The + bounces once at launch: a hint of where the action is (signifier, not a tutorial).
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
        <TabIcon active={active} spring={motion.spring}>
          <Icon name={tab.icon} size={22} color={active ? palette.primaryText : palette.inkSoft} strokeWidth={active ? 2.5 : 1.8} />
          {route.name === 'calendar' && soon && <View style={styles.dot} />}
        </TabIcon>
        <Text style={[styles.label, active && styles.labelActive]}>{t(tab.label)}</Text>
      </PressableScale>
    );
  };

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + 8 }]} pointerEvents="box-none">
      {/* The page fades out under the floating bar: nothing scrolls visibly around or beneath it. */}
      <LinearGradient pointerEvents="none" colors={[palette.scrimClear, palette.bg]} locations={[0, 0.55]} style={[styles.fade, { height: insets.bottom + 96 }]} />
      <Glass radius={30} contentStyle={styles.bar} strong>
        <View style={styles.row}>
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
              router.push('/search');
            }}
            accessibilityLabel={t('search.title')}
            style={[styles.add, spark.shadow.glow]}
            depth={0.9}
          >
            <LinearGradient colors={spark.color.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 29 }]} />
            <Icon name="search" size={24} color={palette.onInk} strokeWidth={2.3} />
          </PressableScale>
        </Animated.View>
      </View>
    </View>
  );
}

/** The active icon grows a little with a spring, the one you leave settles back. */
function TabIcon({ active, spring, children }: { active: boolean; spring: object; children: ReactNode }) {
  const scale = useRef(new Animated.Value(active ? 1.1 : 1)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: active ? 1.1 : 1, useNativeDriver: true, ...spring }).start();
  }, [active, scale, spring]);
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

const useStyles = makeStyles(({ palette, fonts }) => ({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: 16 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bar: { paddingHorizontal: 8, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  tab: { width: TAB_W, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { ...fonts.medium, fontSize: 10.5, color: palette.inkSoft, letterSpacing: 0.1 },
  labelActive: { color: palette.primaryText, ...fonts.bold },
  dot: { position: 'absolute', top: -1, right: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: palette.primary, borderWidth: 1.5, borderColor: palette.bg },
  addSlot: { width: ADD_W },
  addWrap: { position: 'absolute', top: -12, left: 0, right: 0, alignItems: 'center' },
  add: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
}));
