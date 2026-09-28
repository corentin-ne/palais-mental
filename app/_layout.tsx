import '@/locales/i18n';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { theme } from '@/constants/theme';
import { useLanguageSync } from '@/hooks/useLanguageSync';

export default function RootLayout() {
  useLanguageSync();
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }} />
    </>
  );
}
