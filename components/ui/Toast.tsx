import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { Button, ToastCard } from '@/spark';
import { Toast as ToastModel, useUi } from '@/store/useUi';

/**
 * Short confirmation in the kit's toast (strong glass, an accent edge, a countdown line), with Undo when
 * the action can be taken back: nothing asks "are you sure?".
 */
export default function Toast() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const { motion } = useTheme();
  const toast = useUi((s) => s.toast);
  const hide = useUi((s) => s.hideToast);
  const y = useRef(new Animated.Value(0)).current;
  const left = useRef(new Animated.Value(1)).current;
  const [shown, setShown] = useState<ToastModel | null>(null);

  useEffect(() => {
    if (!toast) {
      Animated.timing(y, { toValue: 0, duration: motion.fast, useNativeDriver: true }).start(() => setShown(null));
      return;
    }
    setShown(toast);
    const ms = toast.undo ? 5500 : 3200;
    y.setValue(0);
    left.setValue(1);
    Animated.spring(y, { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 240 }).start();
    Animated.timing(left, { toValue: 0, duration: ms, easing: Easing.linear, useNativeDriver: true }).start();
    const timer = setTimeout(hide, ms);
    return () => clearTimeout(timer);
  }, [toast, hide, y, left, motion.fast]);

  if (!shown) return null;
  const undo = shown.undo;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: insets.bottom + 96,
        alignItems: 'center',
        opacity: y,
        transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }, { scale: y.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
      }}
    >
      <ToastCard
        message={shown.message}
        level="success"
        progress={left}
        action={
          undo ? (
            <Button
              label={t('common.undo')}
              icon="undo"
              variant="ghost"
              size="sm"
              onPress={() => {
                hide();
                undo();
                haptics.tap();
              }}
            />
          ) : undefined
        }
      />
    </Animated.View>
  );
}
