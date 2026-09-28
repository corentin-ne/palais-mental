import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';

interface Props {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export default function Stepper({ value, onChange, min = 1, max = 64 }: Props) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="-"
        style={styles.btn}
        onPress={() => onChange(Math.max(min, value - 1))}
      >
        <Text style={styles.btnText}>−</Text>
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="+"
        style={styles.btn}
        onPress={() => onChange(Math.min(max, value + 1))}
      >
        <Text style={styles.btnText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  btn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: theme.text, fontSize: 20, lineHeight: 22 },
  value: { color: theme.text, fontSize: 18, fontVariant: ['tabular-nums'], minWidth: 28, textAlign: 'center' },
});
