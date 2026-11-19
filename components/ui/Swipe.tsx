import { ReactNode, useMemo, useRef } from 'react';
import { Animated, PanResponder, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import Icon, { IconName } from './Icon';
import { makeStyles, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';

interface Props {
  children: ReactNode;
  /** Swiping right past the threshold: what it does, its glyph and its word. */
  onSwipe: () => void;
  icon: IconName;
  label: string;
  disabled?: boolean;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** How far (of the card's width) a swipe has to go to count. */
const THRESHOLD = 0.32;

/**
 * Swipe right to act: the card slides over an accent fill that grows its glyph as you pull, a click of
 * haptics when the swipe will count, a spring home either way. Only a clearly sideways drag is taken,
 * so the page keeps scrolling under a thumb going down.
 */
export default function Swipe({ children, onSwipe, icon, label, disabled, radius = 20, style }: Props) {
  const { palette } = useTheme();
  const styles = useStyles();
  const haptics = useHaptics();
  const x = useRef(new Animated.Value(0)).current;
  const width = useRef(1);
  const armed = useRef(false);
  const latest = useRef({ onSwipe, haptics, disabled });
  latest.current = { onSwipe, haptics, disabled };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => !latest.current.disabled && g.dx > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => {
          const dx = Math.max(0, g.dx);
          x.setValue(dx);
          const over = dx > width.current * THRESHOLD;
          if (over !== armed.current) {
            armed.current = over;
            latest.current.haptics.select();
          }
        },
        onPanResponderRelease: (_, g) => {
          const go = Math.max(0, g.dx) > width.current * THRESHOLD || g.vx > 1.2;
          armed.current = false;
          if (go) {
            Animated.timing(x, { toValue: width.current, duration: 160, useNativeDriver: true }).start(() => {
              latest.current.onSwipe();
              x.setValue(0);
            });
          } else Animated.spring(x, { toValue: 0, useNativeDriver: true, damping: 16, stiffness: 260 }).start();
        },
        onPanResponderTerminate: () => {
          armed.current = false;
          Animated.spring(x, { toValue: 0, useNativeDriver: true, damping: 16, stiffness: 260 }).start();
        },
      }),
    [x],
  );

  const reveal = x.interpolate({ inputRange: [0, 40, 140], outputRange: [0, 0.6, 1], extrapolate: 'clamp' });
  const grow = x.interpolate({ inputRange: [0, 140], outputRange: [0.6, 1.15], extrapolate: 'clamp' });

  return (
    <View style={style} onLayout={(e) => (width.current = e.nativeEvent.layout.width || 1)}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.under, { borderRadius: radius, opacity: reveal }]} importantForAccessibility="no-hide-descendants">
        <Animated.View style={[styles.hint, { transform: [{ scale: grow }] }]}>
          <Icon name={icon} size={22} color={palette.onInk} strokeWidth={2.6} />
          <Text style={styles.label}>{label}</Text>
        </Animated.View>
      </Animated.View>
      <Animated.View {...responder.panHandlers} style={{ transform: [{ translateX: x }] }}>
        {children}
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles(({ palette, fonts }) => ({
  under: { backgroundColor: palette.primary, justifyContent: 'center', paddingLeft: 22 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  label: { ...fonts.bold, fontSize: 15, color: palette.onInk },
}));
