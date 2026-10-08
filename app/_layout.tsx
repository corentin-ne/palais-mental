import '@/locales/i18n';

import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';

import SafeBoundary from '@/components/ui/SafeBoundary';
import Toast from '@/components/ui/Toast';
import UpdatePrompt from '@/components/ui/UpdatePrompt';
import { useSparkOptions, useTheme } from '@/constants/theme';
import { useLanguageSync } from '@/hooks/useLanguageSync';
import { startSync } from '@/lib/sync';
import { SparkProvider } from '@/spark';
import { useLibrary } from '@/store/useLibrary';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Tapping a release notification opens that show, film, book or game. */
function useNotificationRouting() {
  const router = useRouter();
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (r: Notifications.NotificationResponse | null) => {
      const url = r?.notification.request.content.data?.url;
      if (typeof url === 'string') router.push(url as never);
    };
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [router]);
}

/** True once the saved library (and with it your theme and accent) is read back. */
function useHydrated() {
  const [done, setDone] = useState(() => useLibrary.persist.hasHydrated());
  useEffect(() => {
    if (done) return;
    const unsub = useLibrary.persist.onFinishHydration(() => setDone(true));
    if (useLibrary.persist.hasHydrated()) setDone(true);
    return unsub;
  }, [done]);
  return done;
}

export default function RootLayout() {
  const { palette, dark } = useTheme();
  const spark = useSparkOptions();
  const hydrated = useHydrated();
  useLanguageSync();
  useNotificationRouting();
  useEffect(() => startSync(), []);

  // System fonts (Spark UI kit): nothing to load, the splash waits only for your saved theme and accent.
  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync().catch(() => undefined);
  }, [hydrated]);

  // The window behind the app follows the theme: no light flash around transitions in dark mode.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(palette.bg).catch(() => undefined);
  }, [palette.bg]);

  if (!hydrated) return <View style={{ flex: 1, backgroundColor: palette.bg }} />;

  return (
    <SparkProvider scheme={spark.scheme} accent={spark.accent} lite={spark.lite}>
      <SafeBoundary>
        <StatusBar style={dark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg }, animation: 'slide_from_right' }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="search" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="show/[id]" />
          <Stack.Screen name="movie/[id]" />
          <Stack.Screen name="book/[id]" />
          <Stack.Screen name="game/[id]" />
          <Stack.Screen name="collection/[kind]/[key]" />
          <Stack.Screen name="history" />
          <Stack.Screen name="connections" />
          <Stack.Screen name="settings" />
        </Stack>
        <Toast />
        <UpdatePrompt />
      </SafeBoundary>
    </SparkProvider>
  );
}
