import { useEffect, useRef } from 'react';
import { Animated, Pressable } from 'react-native';

import Icon from './Icon';
import { useTheme } from '@/constants/theme';

interface Props {
  checked: boolean;
  onPress: () => void;
  size?: number;
  disabled?: boolean;
  label?: string;
  onLongPress?: () => void;
}

/** Round check that fills with a springy pop when ticked. */
export default function CheckButton({ checked, onPress, size = 34, disabled, label, onLongPress }: Props) {
  const { palette } = useTheme();
  const t = useRef(new Animated.Value(checked ? 1 : 0)).current;
  const press = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (checked) {
      t.setValue(0);
      Animated.spring(t, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 300 }).start();
    } else Animated.timing(t, { toValue: 0, duration: 160, useNativeDriver: true }).start();
  }, [checked, t]);
  const to = (v: number) => Animated.spring(press, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 8 }).start();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      onPressIn={() => to(0.86)}
      onPressOut={() => to(1)}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
    >
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.6,
          borderColor: checked ? 'transparent' : disabled ? palette.hairline : palette.checkRing,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: press }],
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: palette.primary,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: t,
            transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
          }}
        >
          <Icon name="check" size={size * 0.55} color={palette.onInk} strokeWidth={2.6} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}
