import { ReactNode, useRef } from 'react';
import { Animated, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles, useTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';

interface Props {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}

/**
 * Tab screen: a large title that hands over to a frosted compact bar as you scroll,
 * content centred in a readable column on wide screens.
 */
export default function Screen({ title, subtitle, right, children, refreshing, onRefresh }: Props) {
  const { type, palette, glass } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { gutter, content } = useLayout();
  const y = useRef(new Animated.Value(0)).current;
  const barOpacity = y.interpolate({ inputRange: [40, 80], outputRange: [0, 1], extrapolate: 'clamp' });
  const titleScale = y.interpolate({ inputRange: [-120, 0], outputRange: [1.12, 1], extrapolate: 'clamp' });
  const titleShift = y.interpolate({ inputRange: [-120, 0, 80], outputRange: [10, 0, -12], extrapolate: 'clamp' });

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y } } }], { useNativeDriver: true })}
        contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: insets.bottom + 128, alignItems: 'center' }}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={palette.inkSoft} progressViewOffset={insets.top} /> : undefined}
      >
        <View style={{ width: content, paddingHorizontal: gutter }}>
          <Animated.View style={[styles.header, { transform: [{ translateY: titleShift }, { scale: titleScale }], transformOrigin: 'left' } as object]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={type.display} accessibilityRole="header">
                {title}
              </Text>
              {!!subtitle && <Text style={type.serif}>{subtitle}</Text>}
            </View>
            {right}
          </Animated.View>
          {children}
        </View>
      </Animated.ScrollView>
      <Animated.View pointerEvents="none" style={[styles.bar, { height: insets.top + 48, opacity: barOpacity }]}>
        <BlurView intensity={40} tint={glass.tint} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.glass }]} />
        <View style={[styles.barInner, { paddingTop: insets.top }]}>
          <Text style={type.heading} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={styles.barEdge} />
      </Animated.View>
    </View>
  );
}

/** Section heading inside a screen. */
export function Section({ title, action, children, style }: { title: string; action?: ReactNode; children: ReactNode; style?: object }) {
  const { type } = useTheme();
  return (
    <View style={[{ marginTop: 30, gap: 14 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={type.title}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

const useStyles = makeStyles(({ palette }) => ({
  root: { flex: 1, backgroundColor: palette.screen },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 8 },
  bar: { position: 'absolute', left: 0, right: 0, top: 0, overflow: 'hidden' },
  barInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  barEdge: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: palette.hairline },
}));
