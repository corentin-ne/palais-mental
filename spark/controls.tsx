/**
 * Spark UI kit · native/controls.tsx
 * Buttons, chips, segmented control and switch: components/buttons.css, chips.css, segmented.css and
 * forms.css (.switch) on a phone. Same variants and states; phone sizes (44 pt by default, see tokens.phone).
 */
import { ReactNode, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, LayoutChangeEvent, Pressable, ScrollView, StyleProp, StyleSheet, Switch as RNSwitch, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Icon } from './Icon';
import { Press } from './surfaces';
import { sparkStyles, useSpark } from './theme';

// ------------------------------------------------------------------ Button
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerSolid' | 'success';
export type ButtonSize = 'lg' | 'md' | 'sm' | 'xs';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  /** Icon-only square button: `label` stays the accessible name. */
  iconOnly?: boolean;
  /** Busy (`aria-busy`): a spinner replaces the icon, presses are ignored. */
  busy?: boolean;
  disabled?: boolean;
  /** Full width. */
  block?: boolean;
  style?: StyleProp<ViewStyle>;
}

const RADIUS: Record<ButtonSize, number> = { lg: 16, md: 14, sm: 12, xs: 10 };
const FONT: Record<ButtonSize, number> = { lg: 15, md: 15, sm: 14, xs: 13 };

/**
 * Primary: the accent gradient with a light sweep on press (peak-end delight). Secondary: glass with a
 * firm border. Ghost: text only. Danger / dangerSolid / success: the state colours, never the accent.
 */
export function Button({ label, onPress, variant = 'secondary', size = 'md', icon, iconOnly, busy, disabled, block, style }: ButtonProps) {
  const t = useSpark();
  const s = useButtonStyles();
  const h = t.phone.control[size];
  const solid = variant === 'primary' || variant === 'dangerSolid' || variant === 'success';
  const fg =
    variant === 'primary' ? t.color.onAccent : variant === 'dangerSolid' || variant === 'success' ? '#ffffff' : variant === 'danger' ? t.color.criticalText : variant === 'ghost' ? t.color.textSecondary : t.color.textPrimary;
  const gradient: [string, string] | undefined =
    variant === 'primary' ? t.color.primaryGradient : variant === 'dangerSolid' ? [t.color.critical, '#b8325f'] : variant === 'success' ? ['#0a8a0a', '#087008'] : undefined;
  const sweep = useRef(new Animated.Value(0)).current;
  const onIn = () => {
    if (!solid || !t.motion.loops) return;
    sweep.setValue(0);
    Animated.timing(sweep, { toValue: 1, duration: 750, easing: Easing.bezier(...t.motion.ease), useNativeDriver: true }).start();
  };
  const iconSize = size === 'lg' ? 20 : size === 'xs' ? 15 : 18;
  return (
    <Press
      onPress={busy ? undefined : onPress}
      onPressIn={onIn}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      style={[
        s.base,
        { height: h, minWidth: iconOnly ? h : undefined, paddingHorizontal: iconOnly ? 0 : size === 'xs' ? 10 : size === 'sm' ? 14 : 18, borderRadius: RADIUS[size] },
        variant === 'secondary' && s.secondary,
        variant === 'danger' && s.danger,
        variant === 'ghost' && s.ghost,
        variant === 'primary' && t.shadow.glow,
        block && s.block,
        style,
      ]}
    >
      {gradient && (
        <View style={[StyleSheet.absoluteFill, { borderRadius: RADIUS[size], overflow: 'hidden' }]} pointerEvents="none">
          <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={s.solidHighlight} />
          <Animated.View
            style={[s.sweep, { transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-220, 420] }) }, { skewX: '-20deg' }] }]}
          />
        </View>
      )}
      {busy ? <ActivityIndicator size="small" color={fg} /> : icon ? <Icon name={icon} size={iconSize} color={fg} strokeWidth={2.2} /> : null}
      {!iconOnly && (
        <Text style={[s.label, { color: fg, fontSize: FONT[size] }]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Press>
  );
}

const useButtonStyles = sparkStyles((t) => ({
  // No alignSelf: a button follows its container (centred in an empty state, stretched in a form column).
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  block: { alignSelf: 'stretch' },
  secondary: { backgroundColor: t.color.glassSubtle, borderWidth: 1, borderColor: t.color.glassBorderStrong },
  danger: { backgroundColor: t.color.criticalSoft },
  ghost: { backgroundColor: 'transparent' },
  label: { fontWeight: '600', letterSpacing: -0.1 },
  solidHighlight: { position: 'absolute', left: 0, right: 0, top: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.28)' },
  sweep: { position: 'absolute', top: 0, bottom: 0, width: 60, backgroundColor: 'rgba(255,255,255,0.22)' },
}));

// ------------------------------------------------------------------ Chip
export interface ChipProps {
  label: string;
  active?: boolean;
  count?: number;
  icon?: string;
  /** A red count (alarms): the critical state colour. */
  critical?: boolean;
  onPress?: () => void;
}

/** Filter chip with a count (chips.css). Toggle semantics: `accessibilityState.selected`. */
export function Chip({ label, active, count, icon, critical, onPress }: ChipProps) {
  const t = useSpark();
  const s = useChipStyles();
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!active }} accessibilityLabel={count != null ? `${label}, ${count}` : label} style={[s.chip, active && s.active]}>
      {!!icon && <Icon name={icon} size={15} color={active ? t.color.accentText : t.color.textSecondary} />}
      <Text style={[s.label, active && s.labelActive]}>{label}</Text>
      {count != null && (
        <View style={[s.count, active && s.countActive, critical && s.countCritical]}>
          <Text style={[s.countText, active && { color: t.color.onAccent }, critical && { color: '#ffffff' }]}>{count}</Text>
        </View>
      )}
    </Press>
  );
}

/** A row of chips that scrolls sideways past the screen edges (`inset` = the screen gutter). */
export function ChipRow({ children, inset = 0, style }: { children: ReactNode; inset?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[{ marginHorizontal: -inset, flexGrow: 0 }, style]} contentContainerStyle={{ paddingHorizontal: inset, gap: 8 }}>
      {children}
    </ScrollView>
  );
}

const useChipStyles = sparkStyles((t) => ({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: t.phone.control.sm,
    paddingHorizontal: 14,
    borderRadius: t.radius.full,
    backgroundColor: t.color.glass,
    borderWidth: 1,
    borderColor: t.color.glassBorder,
  },
  active: { backgroundColor: t.color.accentSoft, borderColor: t.color.accentRing },
  label: { fontSize: 14, fontWeight: '600', color: t.color.textSecondary },
  labelActive: { color: t.color.textPrimary },
  count: { minWidth: 22, height: 20, paddingHorizontal: 6, borderRadius: t.radius.full, backgroundColor: t.color.surface3, alignItems: 'center', justifyContent: 'center' },
  countActive: { backgroundColor: t.color.accent },
  countCritical: { backgroundColor: t.color.critical },
  countText: { fontSize: 11.5, fontWeight: '700', color: t.color.textSecondary, fontVariant: ['tabular-nums'] },
}));

// ------------------------------------------------------------------ Segmented
export interface SegmentedProps<V extends string> {
  value: V;
  options: { value: V; label: string; icon?: string }[];
  onChange: (v: V) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Segmented control (radio group). Phone version: full width, equal segments, and the active thumb
 * slides between them (transform only) instead of jumping.
 */
export function Segmented<V extends string>({ value, options, onChange, style }: SegmentedProps<V>) {
  const t = useSpark();
  const s = useSegStyles();
  const [w, setW] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useRef(new Animated.Value(index)).current;
  useEffect(() => {
    Animated.spring(x, { toValue: index, useNativeDriver: true, ...t.motion.spring }).start();
  }, [index, x, t.motion.spring]);
  const seg = w / options.length;
  return (
    <View style={[s.track, style]} accessibilityRole="radiogroup" onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width - 6)}>
      {w > 0 && <Animated.View style={[s.thumb, { width: seg, transform: [{ translateX: Animated.multiply(x, seg) }] }]} />}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={o.label} style={s.segment}>
            {!!o.icon && <Icon name={o.icon} size={15} color={on ? t.color.textPrimary : t.color.textSecondary} />}
            <Text style={[s.label, on && s.labelOn]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useSegStyles = sparkStyles((t) => ({
  track: { flexDirection: 'row', padding: 3, borderRadius: 14, backgroundColor: t.color.glassSubtle, borderWidth: 1, borderColor: t.color.glassBorder, minHeight: 42 },
  thumb: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: 11,
    backgroundColor: t.dark ? t.color.glassActive : '#ffffff',
    borderWidth: 1,
    borderColor: t.color.glassBorder,
    ...t.shadow.glass,
    shadowOpacity: t.dark ? 0.3 : 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segment: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 36, paddingHorizontal: 6 },
  label: { fontSize: 13.5, fontWeight: '600', color: t.color.textSecondary },
  labelOn: { color: t.color.textPrimary },
}));

// ------------------------------------------------------------------ Switch
/** Switch (`role="switch"`): the platform control in kit colours, accent when on. */
export function Switch({ value, onValueChange, label, disabled }: { value: boolean; onValueChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  const t = useSpark();
  return (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityLabel={label}
      trackColor={{ true: t.color.accent, false: t.color.surface3 }}
      thumbColor="#ffffff"
      ios_backgroundColor={t.color.surface3}
      // react-native-web paints its own teal thumb when on unless told otherwise.
      {...({ activeThumbColor: '#ffffff' } as object)}
    />
  );
}
