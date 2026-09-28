import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { BottomTabBarProps } from 'expo-router/tabs';

import Glass from './Glass';
import Icon, { IconName } from './Icon';
import PressableScale from './PressableScale';
import { makeStyles, useTheme } from '@/constants/theme';
import { Gel, Sheen } from './aero/Gloss';
import { useHaptics } from '@/hooks/useHaptics';
import { usePalaceStore } from '@/store/usePalaceStore';
import { useUiStore } from '@/store/useUiStore';

const TABS: Record<string, { icon: IconName; label: string }> = {
  index: { icon: 'journal', label: 'tabs.journal' },
  library: { icon: 'grid', label: 'tabs.library' },
  palace: { icon: 'window', label: 'tabs.palace' },
  profile: { icon: 'chart', label: 'tabs.you' },
};

/**
 * Floating glass tab bar with the log button at its heart: whatever screen you are on,
 * logging is one tap away.
 */
export default function TabBar({ state, navigation }: BottomTabBarProps) {
  const { palette, aero } = useTheme();
  const styles = useStyles();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const openSearch = useUiStore((s) => s.openSearch);
  const focus = usePalaceStore((s) => s.focus);

  const routes = state.routes.filter((r) => TABS[r.name]);
  const half = Math.ceil(routes.length / 2);

  const renderTab = (route: (typeof routes)[number]) => {
    const index = state.routes.indexOf(route);
    const active = state.index === index;
    const tab = TABS[route.name];
    return (
      <PressableScale
        key={route.key}
        depth={0.9}
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
        <View style={[styles.iconWell, aero && active && styles.iconWellActive]}>
          {aero && active && <Sheen strength={0.8} />}
          <View style={{ zIndex: 1 }}>
            <Icon name={tab.icon} size={22} color={active ? (aero ? palette.primaryDeep : palette.ink) : palette.inkFaint} strokeWidth={active ? 2 : 1.7} />
          </View>
        </View>
        <Text style={[styles.label, active && styles.labelActive]}>{t(tab.label)}</Text>
      </PressableScale>
    );
  };

  const onPalace = state.routes[state.index]?.name === 'palace';

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + 8 }]} pointerEvents="box-none">
      <Glass radius={30} contentStyle={styles.bar} strong>
        {routes.slice(0, half).map(renderTab)}
        <View style={styles.addSlot} />
        {routes.slice(half).map(renderTab)}
      </Glass>
      <View style={styles.addWrap} pointerEvents="box-none">
        <PressableScale
          onPress={() => {
            haptics.tap();
            openSearch(onPalace && focus !== 'window' ? focus : 'all');
          }}
          accessibilityLabel={t('nav.add')}
          style={styles.add}
          depth={0.9}
        >
          {aero && <Gel from="#5CCBFF" to={palette.primaryDeep} />}
          <View style={{ zIndex: 1 }}>
            <Icon name="plus" size={26} color={palette.onInk} strokeWidth={2.3} />
          </View>
        </PressableScale>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ palette, fonts, shadow, aero }) => ({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: 16 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6 },
  tab: { width: 66, height: 52, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontFamily: fonts.medium, fontSize: 10.5, color: palette.inkFaint, letterSpacing: 0.1 },
  labelActive: { color: palette.ink, fontFamily: fonts.semibold },
  addSlot: { width: 64 },
  iconWell: { width: 40, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  iconWellActive: { backgroundColor: 'rgba(255,255,255,0.75)', borderWidth: 1, borderColor: '#FFFFFF' },
  addWrap: { position: 'absolute', top: -12, left: 0, right: 0, alignItems: 'center' },
  add: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: palette.primary,
    ...(aero ? { overflow: 'hidden' as const, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)' } : {}),
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.lifted,
  },
}));
