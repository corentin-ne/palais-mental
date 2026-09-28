import { useEffect, useRef, useState } from 'react';
import { Animated, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import Glass from './Glass';
import Icon from './Icon';
import PressableScale from './PressableScale';
import { makeStyles, useTheme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { Toast as ToastModel, useUiStore } from '@/store/useUiStore';
import { usePalaceStore } from '@/store/usePalaceStore';

/**
 * Quiet confirmation with at most one follow-up: "See it" (jump to the object in the
 * palace) or "Undo" (reversible actions need no confirmation dialogs).
 */
export default function Toast() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const { palette } = useTheme();
  const styles = useStyles();
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
    y.setValue(0);
    Animated.spring(y, { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 240 }).start();
    const timer = setTimeout(hide, toast.action?.kind === 'undo' ? 5500 : 4200);
    return () => clearTimeout(timer);
  }, [toast, hide, y]);

  if (!shown) return null;
  const action = shown.action;

  const onAction = () => {
    hide();
    if (!action) return;
    if (action.kind === 'undo') {
      usePalaceStore.getState().undoDelete();
      haptics.tap();
      return;
    }
    const item = usePalaceStore.getState().items[action.itemId];
    if (!item) return;
    usePalaceStore.getState().setFocus(item.category);
    router.navigate('/');
    // Let the camera start turning, then lift the object out to present it.
    setTimeout(() => usePalaceStore.getState().selectItem(item.id, { inspect: true }), 350);
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          bottom: insets.bottom + 96,
          opacity: y,
          transform: [
            { translateY: y.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
            { scale: y.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
          ],
        },
      ]}
    >
      <Glass radius={22} strong contentStyle={styles.inner}>
        <Icon name={action?.kind === 'undo' ? 'trash' : 'check'} size={18} strokeWidth={2.2} color={palette.ink} />
        <Text style={styles.text} numberOfLines={1}>
          {shown.message}
        </Text>
        {action && (
          <PressableScale onPress={onAction} style={styles.action}>
            {action.kind === 'undo' && <Icon name="undo" size={15} color={palette.onInk} strokeWidth={2.2} />}
            <Text style={styles.actionText}>{t(action.kind === 'undo' ? 'toast.undo' : 'toast.see')}</Text>
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
  action: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: palette.ink, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  actionText: { fontFamily: fonts.semibold, fontSize: 13, color: palette.onInk },
}));
