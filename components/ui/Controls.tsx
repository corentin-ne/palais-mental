import { ReactNode, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import Icon, { IconName } from './Icon';
import PressableScale from './PressableScale';
import { noOutline, makeStyles, useTheme } from '@/constants/theme';
import { mix } from '@/lib/color';
import { useSvgId } from '@/lib/svgId';
import { Gel, Sheen } from './aero/Gloss';

// ------------------------------------------------------------------ Buttons
interface ButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  tone?: 'ink' | 'accent' | 'soft' | 'danger';
  accent?: string;
  disabled?: boolean;
  compact?: boolean;
}

export function Button({ label, onPress, icon, tone = 'ink', accent, disabled, compact }: ButtonProps) {
  const { palette, type, aero } = useTheme();
  const styles = useStyles();
  const base =
    tone === 'ink' ? palette.primary : tone === 'accent' ? accent ?? palette.primary : tone === 'danger' ? palette.danger : null;
  const fg = tone === 'soft' ? palette.ink : palette.onInk;
  // Aero: every solid button is a gel — gradient body, specular top, glow at the base.
  const gel = aero && base ? { from: mix(base, '#FFFFFF', 0.28), to: tone === 'ink' ? palette.primaryDeep : mix(base, '#000000', 0.18) } : null;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, compact && styles.buttonCompact, { backgroundColor: gel ? undefined : base ?? palette.field }]}
    >
      {gel && <Gel from={gel.from} to={gel.to} />}
      {aero && !base && <Sheen strength={0.6} />}
      <View style={styles.buttonContent}>
        {icon && <Icon name={icon} size={18} color={fg} strokeWidth={2} />}
        <Text style={[type.button, { color: fg }, gel && styles.gelText]}>{label}</Text>
      </View>
    </PressableScale>
  );
}

export function IconButton({ icon, onPress, label, size = 44 }: { icon: IconName; onPress: () => void; label: string; size?: number }) {
  const styles = useStyles();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      style={[styles.iconButton, { width: size, height: size, borderRadius: size / 2 }]}
      hitSlop={8}
    >
      <Icon name={icon} size={20} />
    </PressableScale>
  );
}

// ------------------------------------------------------------------ Fields
interface FieldProps extends TextInputProps {
  label?: string;
  large?: boolean;
}

export function Field({ label, large, style, ...rest }: FieldProps) {
  const { palette, type } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.fieldWrap}>
      {label && <Text style={type.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={palette.inkFaint}
        style={[styles.field, large && styles.fieldLarge, style]}
        {...rest}
      />
    </View>
  );
}

// ------------------------------------------------------------------ Rating
/** Five stars; tap a star to set, tap the current one again to halve, tap again to clear. */
export function RatingStars({ value = 0, onChange, size = 28 }: { value?: number; onChange?: (v: number) => void; size?: number }) {
  const styles = useStyles();
  return (
    <View style={styles.stars} accessibilityRole="adjustable" accessibilityValue={{ min: 0, max: 5, now: value }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = value >= n ? 1 : value >= n - 0.5 ? 0.5 : 0;
        const next = value === n ? n - 0.5 : value === n - 0.5 ? 0 : n;
        return (
          <Pressable key={n} disabled={!onChange} onPress={() => onChange?.(next)} hitSlop={4}>
            <Star size={size} fill={fill} />
          </Pressable>
        );
      })}
    </View>
  );
}

const STAR = 'M12 3.2l2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.5l-5.4 2.9 1.2-5.9L3.4 9.4l6-.7z';
function Star({ size, fill }: { size: number; fill: number }) {
  const { palette } = useTheme();
  const id = useSvgId('star');
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id={id} x1="0" x2="1" y1="0" y2="0">
          <Stop offset="0.5" stopColor={palette.star} />
          <Stop offset="0.5" stopColor={palette.star} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path
        d={STAR}
        fill={fill === 1 ? palette.star : fill === 0.5 ? `url(#${id})` : 'none'}
        stroke={fill > 0 ? palette.star : palette.inkFaint}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ------------------------------------------------------------------ Stepper
export function Stepper({ value, onChange, min = 1, max = 64 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const styles = useStyles();
  return (
    <View style={styles.stepper}>
      <PressableScale accessibilityLabel="−" style={styles.stepBtn} onPress={() => onChange(Math.max(min, value - 1))}>
        <Icon name="minus" size={18} />
      </PressableScale>
      <Text style={styles.stepValue}>{value}</Text>
      <PressableScale accessibilityLabel="+" style={styles.stepBtn} onPress={() => onChange(Math.min(max, value + 1))}>
        <Icon name="plus" size={18} />
      </PressableScale>
    </View>
  );
}

// ------------------------------------------------------------------ Segmented control
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ------------------------------------------------------------------ Toggle
export function Toggle({ value, onChange, label, hint }: { value: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  const { palette, type } = useTheme();
  const styles = useStyles();
  const x = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(x, { toValue: value ? 1 : 0, useNativeDriver: false, damping: 18, stiffness: 260 }).start();
  }, [value, x]);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={styles.toggleRow}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={type.bodyMedium}>{label}</Text>
        {hint && <Text style={type.small}>{hint}</Text>}
      </View>
      <Animated.View
        style={[
          styles.track,
          { backgroundColor: x.interpolate({ inputRange: [0, 1], outputRange: [palette.fieldActive, palette.ink] }) },
        ]}
      >
        <Animated.View style={[styles.knob, { transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [2, 20] }) }] }]} />
      </Animated.View>
    </Pressable>
  );
}

// ------------------------------------------------------------------ Progress ring (season disc)
export function Ring({ fraction, size = 40, color, children }: { fraction: number; size?: number; color: string; children?: ReactNode }) {
  const { palette } = useTheme();
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={palette.hairline} strokeWidth={4} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * Math.max(0.0001, fraction)} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

// ------------------------------------------------------------------ Category chip
export function CategoryChip({ icon, label, tint, accent }: { icon: IconName; label: string; tint: string; accent: string }) {
  const styles = useStyles();
  return (
    <View style={[styles.chip, { backgroundColor: tint }]}>
      <Icon name={icon} size={15} color={accent} strokeWidth={2} />
      <Text style={[styles.chipText, { color: accent }]}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ palette, fonts, radii, aero }) => ({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    paddingHorizontal: 22,
    borderRadius: radii.pill,
    overflow: 'hidden',
    ...(aero ? { borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' } : {}),
  },
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 1 },
  gelText: { textShadowColor: 'rgba(0,40,80,0.35)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  buttonCompact: { height: 42, paddingHorizontal: 16 },
  iconButton: { alignItems: 'center', justifyContent: 'center', backgroundColor: palette.field },
  fieldWrap: { gap: 8 },
  field: { ...(noOutline as object),
    fontFamily: fonts.body,
    fontSize: 16,
    color: palette.ink,
    backgroundColor: palette.field,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldLarge: { fontFamily: fonts.display, fontSize: 24, paddingVertical: 12, letterSpacing: -0.3 },
  stars: { flexDirection: 'row', gap: 6 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.field,
  },
  stepValue: { fontFamily: fonts.semibold, fontSize: 18, color: palette.ink, minWidth: 30, textAlign: 'center', fontVariant: ['tabular-nums'] },
  segmented: { flexDirection: 'row', backgroundColor: palette.field, borderRadius: radii.pill, padding: 4 },
  segment: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: radii.pill },
  segmentActive: {
    backgroundColor: palette.glassStrong,
    shadowColor: palette.shadow,
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentText: { fontFamily: fonts.medium, fontSize: 14, color: palette.inkSoft },
  segmentTextActive: { color: palette.ink, fontFamily: fonts.semibold },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 4 },
  track: { width: 46, height: 28, borderRadius: 14, justifyContent: 'center' },
  knob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: palette.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 11, paddingVertical: 6, borderRadius: radii.pill },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 0.2 },
}));
