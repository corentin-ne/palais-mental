import { Text, View } from 'react-native';

import { makeStyles } from '@/constants/theme';

const HUES = ['#E8833A', '#8A5CF6', '#2F9E6A', '#0B63CE', '#E0518C', '#C2410C', '#0E9F9A', '#B45309'];

/** A member's initial on their own colour: the same name, the same colour, on every phone. */
export default function Avatar({ name, size = 32 }: { name?: string; size?: number }) {
  const styles = useStyles();
  const label = name?.trim() || '?';
  let h = 0;
  for (const c of label.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: HUES[h % HUES.length] }]}>
      <Text style={[styles.letter, { fontSize: size * 0.44 }]}>{[...label][0].toLocaleUpperCase()}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ fonts }) => ({
  circle: { alignItems: 'center', justifyContent: 'center' },
  letter: { ...fonts.bold, color: '#FFFFFF' },
}));
