import { useEffect } from 'react';
import { useLocales } from 'expo-localization';

import i18n, { resolveLanguage } from '@/locales/i18n';
import { usePalaceStore } from '@/store/usePalaceStore';

/** Applies the persisted override, or follows the device locale live when set to 'system'. */
export function useLanguageSync() {
  const preference = usePalaceStore((s) => s.language);
  const locales = useLocales(); // re-renders when the OS language changes

  useEffect(() => {
    const lng = resolveLanguage(preference);
    if (i18n.language !== lng) i18n.changeLanguage(lng);
  }, [preference, locales]);
}
