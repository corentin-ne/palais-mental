import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import Glass from './Glass';
import Icon from './Icon';
import PressableScale from './PressableScale';
import { makeStyles, useTheme } from '@/constants/theme';
import { Toast as ToastModel, useUiStore } from '@/store/useUiStore';
import { usePalaceStore } from '@/store/usePalaceStore';

/** Confirmation after a log, with a shortcut to see the object on its shelf. */
export default function Toast() {
  const styles = useStyles();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useUiStore((s) => s.toast);
  const hide = useUiStore((s) => s.hideToast);
  const y = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<ToastModel | null>(null);

  useEffect(() => {
    if (!toast) {
      Animated.timing(y, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setShown(null));
      return;
    }
    setShown(toast);
    Animated.spring(y, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 220 }).start();
    const timer = setTimeout(hide, 4200);
    return () => clearTimeout(timer);
  }, [toast, hide, y]);

  if (!shown) return null;
  const item = shown.itemId ? usePalaceStore.getState().items[shown.itemId] : undefined;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { bottom: insets.bottom + 96, opacity: y, transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] },
      ]}
    >
      <Glass radius={22} strong contentStyle={styles.inner}>
        <Icon name="check" size={18} strokeWidth={2.2} />
        <Text style={styles.text} numberOfLines={1}>
          {shown.message}
        </Text>
        {item && (
          <PressableScale
            onPress={() => {
              hide();
              const s = usePalaceStore.getState();
              s.setFocus(item.category);
              router.navigate('/palace');
              // Let the camera start turning, then lift the object out to present it.
              setTimeout(() => usePalaceStore.getState().selectItem(item.id, { inspect: true }), 350);
            }}
            style={styles.action}
          >
            <Text style={styles.actionText}>{t('toast.see')}</Text>
          </PressableScale>
        )}
      </Glass>
    </Animated.View>
  );
}

const useStyles = makeStyles(({ palette, fonts }) => ({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 6, paddingVertical: 6, minHeight: 48 },
  text: { fontFamily: fonts.medium, fontSize: 14.5, color: palette.ink, flexShrink: 1 },
  action: { backgroundColor: palette.ink, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  actionText: { fontFamily: fonts.semibold, fontSize: 13, color: palette.onInk },
}));
