import { useMemo } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useLibrary } from '@/store/useLibrary';

const quiet = () => undefined;

/** Haptic vocabulary of the app; silent on web or when the user turned haptics off. */
export function useHaptics() {
  const enabled = useLibrary((s) => s.settings.haptics) && Platform.OS !== 'web';
  return useMemo(
    () =>
      enabled
        ? {
            select: () => void Haptics.selectionAsync().catch(quiet),
            tap: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(quiet),
            success: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(quiet),
            warn: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(quiet),
          }
        : { select: quiet, tap: quiet, success: quiet, warn: quiet },
    [enabled],
  );
}
