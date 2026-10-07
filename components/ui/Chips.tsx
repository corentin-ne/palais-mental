import { ScrollView, Text } from 'react-native';

import PressableScale from './PressableScale';
import { makeStyles } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';

interface Props<T extends string> {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  inset: number;
}

/** One-line filter chips that scroll sideways past the screen edge. */
export default function Chips<T extends string>({ options, value, onChange, inset }: Props<T>) {
  const styles = useStyles();
  const haptics = useHaptics();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: inset }} style={{ marginHorizontal: -inset, flexGrow: 0 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressableScale
            key={o.value}
            depth={0.92}
            accessibilityState={{ selected: active }}
            onPress={() => {
              haptics.select();
              onChange(o.value);
            }}
            style={[styles.chip, active && styles.active]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {o.label}
              {o.count != null && <Text style={[styles.count, active && styles.labelActive]}>{`  ${o.count}`}</Text>}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles(({ palette, fonts }) => ({
  chip: { height: 36, paddingHorizontal: 15, borderRadius: 18, justifyContent: 'center', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.hairline },
  active: { backgroundColor: palette.ink, borderColor: palette.ink },
  label: { fontFamily: fonts.medium, fontSize: 13.5, color: palette.ink },
  labelActive: { color: palette.onInk },
  count: { fontFamily: fonts.medium, fontSize: 12.5, color: palette.inkFaint },
}));
