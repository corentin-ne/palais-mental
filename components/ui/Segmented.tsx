import { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, Text, View } from 'react-native';

import { makeStyles, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}

/** Segmented control with a sliding thumb. */
export default function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  const { motion } = useTheme();
  const styles = useStyles();
  const haptics = useHaptics();
  const [w, setW] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const seg = w / options.length;
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(x, { toValue: index * seg, useNativeDriver: true, ...motion.spring }).start();
  }, [index, seg, x, motion.spring]);
  return (
    <View style={styles.wrap} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width - 8)}>
      {w > 0 && <Animated.View style={[styles.thumb, { width: seg, transform: [{ translateX: x }] }]} />}
      {options.map((o) => (
        <Pressable
          key={o.value}
          style={styles.option}
          accessibilityRole="tab"
          accessibilityState={{ selected: o.value === value }}
          onPress={() => {
            if (o.value === value) return;
            haptics.select();
            onChange(o.value);
          }}
        >
          <Text style={[styles.label, o.value === value && styles.labelActive]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = makeStyles(({ palette, fonts, shadow }) => ({
  wrap: { flexDirection: 'row', width: '100%', maxWidth: 460, backgroundColor: palette.field, borderRadius: 16, padding: 4 },
  thumb: { position: 'absolute', top: 4, left: 4, bottom: 4, borderRadius: 12, backgroundColor: palette.surface, ...shadow.cover, shadowOpacity: 0.08 },
  option: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.medium, fontSize: 14, color: palette.inkSoft },
  labelActive: { fontFamily: fonts.semibold, color: palette.ink },
}));
