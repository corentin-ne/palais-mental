import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import Icon from './Icon';
import PressableScale from './PressableScale';
import { makeStyles, noOutline, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';

interface Props {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  /** A second, bigger step shown as a "+N" chip (pages read in one go). */
  bigStep?: number;
  max?: number;
  /** Text after the number ("of 412", "h", "%"). */
  suffix?: string;
  label: string;
}

/** − [number] + : tap to nudge, or type the exact value. */
export default function Stepper({ value, onChange, step = 1, bigStep, max, suffix, label }: Props) {
  const { palette } = useTheme();
  const styles = useStyles();
  const haptics = useHaptics();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const clamp = (v: number) => Math.max(0, max ? Math.min(max, v) : v);
  const nudge = (by: number) => {
    const next = clamp(value + by);
    if (next === value) return;
    haptics.select();
    onChange(next);
  };
  const commit = () => {
    const n = Number(draft.replace(',', '.'));
    if (Number.isFinite(n) && clamp(n) !== value) onChange(clamp(n));
    else setDraft(String(value));
  };
  return (
    <View style={styles.row} accessibilityLabel={label}>
      <PressableScale onPress={() => nudge(-step)} disabled={value <= 0} style={styles.btn} accessibilityLabel={`${label} −${step}`} hitSlop={6}>
        <Icon name="minus" size={16} color={palette.ink} strokeWidth={2.4} />
      </PressableScale>
      <View style={styles.field}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onEndEditing={commit}
          onSubmitEditing={commit}
          onBlur={commit}
          keyboardType="decimal-pad"
          selectTextOnFocus
          returnKeyType="done"
          accessibilityLabel={label}
          style={[styles.input, noOutline]}
        />
        {!!suffix && (
          <Text style={styles.suffix} numberOfLines={1}>
            {suffix}
          </Text>
        )}
      </View>
      <PressableScale onPress={() => nudge(step)} disabled={!!max && value >= max} style={[styles.btn, styles.plus]} accessibilityLabel={`${label} +${step}`} hitSlop={6}>
        <Icon name="plus" size={16} color={palette.onInk} strokeWidth={2.4} />
      </PressableScale>
      {!!bigStep && (
        <PressableScale onPress={() => nudge(bigStep)} disabled={!!max && value >= max} style={styles.big} accessibilityLabel={`${label} +${bigStep}`}>
          <Text style={styles.bigText}>{`+${bigStep}`}</Text>
        </PressableScale>
      )}
    </View>
  );
}

const useStyles = makeStyles(({ palette, fonts }) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.field },
  plus: { backgroundColor: palette.primary },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 38, paddingHorizontal: 12, borderRadius: 12, backgroundColor: palette.field, gap: 4 },
  input: { minWidth: 36, flexShrink: 1, height: 38, ...fonts.semibold, fontSize: 16, color: palette.ink },
  suffix: { flex: 1, ...fonts.medium, fontSize: 13.5, color: palette.inkSoft },
  big: { height: 38, paddingHorizontal: 12, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primaryTint },
  bigText: { ...fonts.semibold, fontSize: 13.5, color: palette.primaryText },
}));
