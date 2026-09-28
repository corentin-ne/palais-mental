import { useIsFocused } from 'expo-router';
import { useTheme } from '@/constants/theme';

/**
 * Aero screens are transparent so the shared sky shows through; that also lets
 * inactive tabs show through each other. Hide a screen entirely while it is not the
 * focused tab (a no-op for opaque Editorial screens).
 */
export function useSceneVisibility() {
  const focused = useIsFocused();
  const { aero } = useTheme();
  return aero && !focused ? ({ display: 'none' } as const) : null;
}
