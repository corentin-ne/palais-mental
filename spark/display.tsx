/**
 * Spark UI kit · native/display.tsx
 * Cards, section heads, badges, status dots, stat tiles, meters, skeletons, empty states, alerts, toasts,
 * list rows and text fields: components/cards.css, page.css, badges.css, figures.css, feedback.css,
 * toasts.css, menus.css and forms.css on a phone.
 */
import { ReactNode, forwardRef, useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Icon } from './Icon';
import { Glass, Press } from './surfaces';
import { sparkStyles, useSpark } from './theme';
import type { SparkTokens } from './tokens';

export type Level = 'good' | 'warning' | 'serious' | 'critical';
export type Tone = Level | 'accent' | 'neutral';

const toneColors = (t: SparkTokens, tone: Tone) =>
  tone === 'accent'
    ? { fg: t.color.accentText, bg: t.color.accentSoft, solid: t.color.accent }
    : tone === 'neutral'
      ? { fg: t.color.textSecondary, bg: t.color.surface2, solid: t.color.textMuted }
      : { fg: t.color[`${tone}Text`], bg: t.color[`${tone}Soft`], solid: t.color[tone] };

// ------------------------------------------------------------------ Card
export interface CardProps {
  children?: ReactNode;
  title?: string;
  subtitle?: string;
  icon?: string;
  actions?: ReactNode;
  /** Tappable card: lifts the press feedback onto the whole card. */
  onPress?: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Glass card (cards.css): optional head with an icon tile, title, subtitle and actions; children gap 16. */
export function Card({ children, title, subtitle, icon, actions, onPress, compact, style }: CardProps) {
  const t = useSpark();
  const s = useCardStyles();
  const body = (
    <Glass style={[s.card, compact && s.compact, style]}>
      {(title || icon || actions) && (
        <View style={s.head}>
          {!!icon && (
            <View style={s.icon}>
              <Icon name={icon} size={18} color={t.color.textSecondary} />
            </View>
          )}
          <View style={{ flex: 1, gap: 1 }}>
            {!!title && <Text style={s.title}>{title}</Text>}
            {!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
          </View>
          {actions}
        </View>
      )}
      {children}
    </Glass>
  );
  return onPress ? (
    <Press onPress={onPress} depth={0.985} accessibilityLabel={title}>
      {body}
    </Press>
  ) : (
    body
  );
}

const useCardStyles = sparkStyles((t) => ({
  card: { padding: t.space[4], gap: t.space[4] },
  compact: { paddingVertical: t.space[3], gap: t.space[3] },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 36 },
  icon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: t.color.glassSubtle, borderWidth: 1, borderColor: t.color.glassBorder },
  title: { ...t.type.cardTitle, color: t.color.textPrimary },
  subtitle: { ...t.type.small, color: t.color.textMuted },
}));

// ------------------------------------------------------------------ Section head
/** Section title with an optional eyebrow, count and action (page.css .section-head, .eyebrow, .count-pill). */
export function SectionHead({ title, eyebrow, count, action, style }: { title: string; eyebrow?: string; count?: number; action?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useSectionStyles();
  return (
    <View style={[s.row, style]}>
      <View style={{ flex: 1, gap: 2 }}>
        {!!eyebrow && <Text style={s.eyebrow}>{eyebrow}</Text>}
        <View style={s.titleRow}>
          <Text style={s.title} accessibilityRole="header">
            {title}
          </Text>
          {count != null && (
            <View style={s.count}>
              <Text style={s.countText}>{count}</Text>
            </View>
          )}
        </View>
      </View>
      {action}
    </View>
  );
}

const useSectionStyles = sparkStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrow: { ...t.type.eyebrow, color: t.color.accentText },
  title: { ...t.type.section, color: t.color.textPrimary },
  count: { minWidth: 24, height: 22, paddingHorizontal: 7, borderRadius: t.radius.full, backgroundColor: t.color.surface3, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 12, fontWeight: '700', color: t.color.textSecondary, fontVariant: ['tabular-nums'] },
}));

/** Eyebrow label (11 px caps): the small heading above figures and fields. */
export function Eyebrow({ children, accent }: { children: ReactNode; accent?: boolean }) {
  const t = useSpark();
  return <Text style={{ ...t.type.eyebrow, color: accent ? t.color.accentText : t.color.textMuted }}>{children}</Text>;
}

// ------------------------------------------------------------------ Badge, status dot
/** Badge (badges.css): a level, the accent or neutral; a dot when the state needs one. */
export function Badge({ label, tone = 'neutral', dot, icon }: { label: string; tone?: Tone; dot?: boolean; icon?: string }) {
  const t = useSpark();
  const c = toneColors(t, tone);
  return (
    <View style={[badgeStyles.badge, { backgroundColor: c.bg, borderColor: tone === 'neutral' ? t.color.glassBorder : 'transparent' }]}>
      {dot && <View style={[badgeStyles.dot, { backgroundColor: c.fg }]} />}
      {!!icon && <Icon name={icon} size={13} color={c.fg} strokeWidth={2.4} />}
      <Text style={[badgeStyles.label, { color: c.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 24, paddingHorizontal: 9, borderRadius: 999, borderWidth: 1, alignSelf: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 12, fontWeight: '600' },
});

/**
 * Status dot: colour AND shape per level (§2.10), readable without colour vision. good = round,
 * warning = triangle, serious = diamond, critical = square (pulsing while loops are on), todo = empty ring.
 */
export function StatusDot({ level, size = 9 }: { level: Level | 'info' | 'todo'; size?: number }) {
  const t = useSpark();
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (level !== 'critical' || !t.motion.loops) return;
    const loop = Animated.loop(
      Animated.sequence([Animated.timing(pulse, { toValue: 0.35, duration: 700, useNativeDriver: true }), Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true })]),
    );
    loop.start();
    return () => loop.stop();
  }, [level, pulse, t.motion.loops]);
  if (level === 'warning')
    return <View style={{ width: 0, height: 0, borderLeftWidth: size / 1.7, borderRightWidth: size / 1.7, borderBottomWidth: size, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: t.color.warning }} />;
  const base = { width: size, height: size };
  if (level === 'serious') return <View style={[base, { backgroundColor: t.color.serious, borderRadius: 1, transform: [{ rotate: '45deg' }, { scale: 0.85 }] }]} />;
  if (level === 'critical') return <Animated.View style={[base, { backgroundColor: t.color.critical, borderRadius: 2, opacity: pulse }]} />;
  if (level === 'info' || level === 'todo') return <View style={[base, { borderRadius: size / 2, borderWidth: 2, borderColor: level === 'info' ? t.color.accent : t.color.textMuted }]} />;
  return <View style={[base, { borderRadius: size / 2, backgroundColor: t.color.good }]} />;
}

// ------------------------------------------------------------------ Tile, meter
/** Stat tile (figures.css): label, big tabular figure, unit and a sub line; a level or the accent tints it. */
export function Tile({ label, value, unit, sub, icon, tone, style }: { label: string; value: string; unit?: string; sub?: string; icon?: string; tone?: Tone; style?: StyleProp<ViewStyle> }) {
  const t = useSpark();
  const s = useTileStyles();
  const c = tone && tone !== 'neutral' ? toneColors(t, tone) : undefined;
  return (
    <Glass style={[s.tile, c && { borderColor: c.bg }, style]}>
      {c && <LinearGradient colors={[c.bg, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.7 }} style={[StyleSheet.absoluteFill, { borderRadius: t.radius.lg }]} pointerEvents="none" />}
      <View style={s.labelRow}>
        {!!icon && <Icon name={icon} size={14} color={t.color.textMuted} />}
        <Text style={s.label} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={s.figure}>
        <Text style={[s.value, c && { color: c.fg }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {!!unit && <Text style={s.unit}>{unit}</Text>}
      </View>
      {!!sub && (
        <Text style={s.sub} numberOfLines={1}>
          {sub}
        </Text>
      )}
    </Glass>
  );
}

const useTileStyles = sparkStyles((t) => ({
  tile: { paddingVertical: t.space[3], paddingHorizontal: t.space[4], gap: 2, minWidth: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 12.5, fontWeight: '600', color: t.color.textSecondary },
  figure: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  value: { ...t.type.figure, color: t.color.textPrimary, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 13, fontWeight: '600', color: t.color.textMuted },
  sub: { fontSize: 12, color: t.color.textMuted },
}));

/** Meter (figures.css): a 0–1 fill in a data colour (series 1 by default), done = good. */
export function Meter({ value, color, height = 6, style }: { value: number; color?: string; height?: number; style?: StyleProp<ViewStyle> }) {
  const t = useSpark();
  const v = Math.max(0, Math.min(1, value));
  const fill = color ?? (v >= 1 ? t.color.good : t.color.series[0]);
  return (
    <View style={[{ height, borderRadius: height / 2, backgroundColor: t.color.surface3, overflow: 'hidden' }, style]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}>
      <View style={{ width: `${v * 100}%`, height, borderRadius: height / 2, backgroundColor: fill }} />
    </View>
  );
}

// ------------------------------------------------------------------ Feedback
/** Skeleton (feedback.css): an opacity pulse, composited; still in lite and reduced motion. */
export function Skeleton({ width, height, radius = 8, style }: { width: number | `${number}%`; height: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const t = useSpark();
  const o = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!t.motion.loops) return;
    const loop = Animated.loop(Animated.sequence([Animated.timing(o, { toValue: 0.4, duration: 700, useNativeDriver: true }), Animated.timing(o, { toValue: 1, duration: 700, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [o, t.motion.loops]);
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: t.color.surface3, opacity: o }, style]} />;
}

export function Spinner({ size = 'small' }: { size?: 'small' | 'large' }) {
  const t = useSpark();
  return <ActivityIndicator size={size} color={t.color.accent} />;
}

/**
 * Empty state (feedback.css .empty-card): the accent tile with a glyph, a title, a sentence and an action.
 * The whole screen when there is nothing yet.
 */
export function EmptyState({ icon, title, body, action }: { icon: string; title: string; body?: string; action?: ReactNode }) {
  const t = useSpark();
  const s = useEmptyStyles();
  return (
    <View style={s.wrap}>
      <View style={[s.tile, t.shadow.glow]}>
        <LinearGradient colors={[t.color.accent, t.color.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 22 }]} />
        <Icon name={icon} size={30} color={t.color.onMark} strokeWidth={2} />
      </View>
      <Text style={s.title}>{title}</Text>
      {!!body && <Text style={s.body}>{body}</Text>}
      {action}
    </View>
  );
}

const useEmptyStyles = sparkStyles((t) => ({
  wrap: { alignItems: 'center', gap: t.space[3], paddingVertical: t.space[8], paddingHorizontal: t.space[4] },
  tile: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: t.space[3] },
  title: { ...t.type.heroTitle, color: t.color.textPrimary, textAlign: 'center' },
  body: { ...t.type.body, color: t.color.textSecondary, textAlign: 'center', maxWidth: 360 },
}));

/** Inline alert (feedback.css .alert): an icon and a sentence in a level or the accent. */
export function Alert({ tone = 'accent', icon, children }: { tone?: Tone; icon?: string; children: ReactNode }) {
  const t = useSpark();
  const c = toneColors(t, tone);
  const glyph = icon ?? (tone === 'good' ? 'good' : tone === 'warning' || tone === 'serious' ? 'warning' : tone === 'critical' ? 'critical' : 'info');
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 11, paddingHorizontal: 14, borderRadius: 14, backgroundColor: c.bg, borderWidth: 1, borderColor: c.bg }}>
      <Icon name={glyph} size={17} color={c.fg} />
      <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: c.fg }}>{children}</Text>
    </View>
  );
}

/**
 * Toast card (toasts.css, `.edge`): strong blurred glass, the level as a 3 px edge and icon colour, an
 * optional action (undo) and a progress line while it counts down (`progress` 1 → 0).
 */
export function ToastCard({ message, detail, level = 'info', action, progress }: { message: string; detail?: string; level?: 'info' | 'success' | 'warning' | 'error'; action?: ReactNode; progress?: Animated.Value }) {
  const t = useSpark();
  const s = useToastStyles();
  const tone = level === 'success' ? t.color.good : level === 'error' ? t.color.critical : level === 'warning' ? t.color.warning : t.color.accent;
  const iconColor = level === 'success' ? t.color.goodText : level === 'error' ? t.color.criticalText : level === 'warning' ? t.color.warningText : t.color.accentText;
  const glyph = level === 'success' ? 'good' : level === 'error' ? 'critical' : level === 'warning' ? 'warning' : 'info';
  return (
    <Glass tone="strong" blur elevated="lg" radius={t.radius.md} style={s.toast}>
      <View style={[s.edge, { backgroundColor: tone }]} />
      <Icon name={glyph} size={19} color={iconColor} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.msg}>{message}</Text>
        {!!detail && <Text style={s.detail}>{detail}</Text>}
      </View>
      {action}
      {progress && <Animated.View style={[s.progress, { backgroundColor: tone, transform: [{ scaleX: progress }] }]} />}
    </Glass>
  );
}

const useToastStyles = sparkStyles((t) => ({
  toast: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingLeft: 16, paddingRight: 10, overflow: 'hidden' },
  edge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  msg: { fontSize: 14.5, fontWeight: '600', color: t.color.textPrimary },
  detail: { fontSize: 12.5, color: t.color.textMuted },
  progress: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, opacity: 0.7, transformOrigin: 'left' },
}));

// ------------------------------------------------------------------ List row
export interface ListRowProps {
  title: string;
  detail?: string;
  icon?: string;
  /** Icon tile tinted with the accent (the selected or primary row). */
  accentIcon?: boolean;
  /** Right side: a value, a switch, a badge… */
  trailing?: ReactNode;
  /** Shows a chevron and makes the row a button. */
  onPress?: () => void;
  danger?: boolean;
  /** No separator above (the first row of a group). */
  first?: boolean;
}

/**
 * List row: the phone version of the menu item / nav item (menus.css, sidebar.css). Rows sit in a
 * `<Glass>` group, a hairline between them, 52 pt tall at least.
 */
export function ListRow({ title, detail, icon, accentIcon, trailing, onPress, danger, first }: ListRowProps) {
  const t = useSpark();
  const s = useRowStyles();
  const content = (
    <View style={[s.row, !first && s.sep]}>
      {!!icon && (
        <View style={[s.icon, accentIcon && { backgroundColor: t.color.accentSoft, borderColor: 'transparent' }]}>
          <Icon name={icon} size={17} color={danger ? t.color.criticalText : accentIcon ? t.color.accentText : t.color.textSecondary} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.title, danger && { color: t.color.criticalText }]}>{title}</Text>
        {!!detail && <Text style={s.detail}>{detail}</Text>}
      </View>
      {trailing}
      {onPress && !trailing && <Icon name="chevronRight" size={16} color={t.color.textMuted} />}
    </View>
  );
  return onPress ? (
    <Press onPress={onPress} depth={0.99} accessibilityLabel={title}>
      {content}
    </Press>
  ) : (
    content
  );
}

const useRowStyles = sparkStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 10, paddingHorizontal: t.space[4] },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.color.glassBorderStrong },
  icon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: t.color.glassSubtle, borderWidth: 1, borderColor: t.color.glassBorder },
  title: { fontSize: 15, fontWeight: '500', color: t.color.textPrimary },
  detail: { fontSize: 12.5, lineHeight: 17, color: t.color.textMuted },
}));

// ------------------------------------------------------------------ Field
/** Text field (forms.css): 44 pt, field fill and border, the accent ring when focused. */
export const Field = forwardRef<TextInput, TextInputProps & { icon?: string; invalid?: boolean }>(function Field({ icon, invalid, style, onFocus, onBlur, ...rest }, ref) {
  const t = useSpark();
  const s = useFieldStyles();
  const focus = useRef(new Animated.Value(0)).current;
  const set = (v: number) => Animated.timing(focus, { toValue: v, duration: t.motion.fast, useNativeDriver: false }).start();
  return (
    <Animated.View
      style={[
        s.wrap,
        { borderColor: invalid ? t.color.critical : focus.interpolate({ inputRange: [0, 1], outputRange: [t.color.fieldBorder, t.color.accentRing] }) },
      ]}
    >
      {!!icon && <Icon name={icon} size={17} color={t.color.textMuted} />}
      <TextInput
        ref={ref}
        placeholderTextColor={t.color.textMuted}
        selectionColor={t.color.accent}
        style={[s.input, { outlineWidth: 0 } as object, style]}
        onFocus={(e) => {
          set(1);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          set(0);
          onBlur?.(e);
        }}
        {...rest}
      />
    </Animated.View>
  );
});

const useFieldStyles = sparkStyles((t) => ({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: t.phone.control.md, paddingHorizontal: 12, borderRadius: 12, backgroundColor: t.color.field, borderWidth: 1.5 },
  input: { flex: 1, minHeight: t.phone.control.md - 4, fontSize: 15, color: t.color.textPrimary },
}));
