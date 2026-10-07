import '@/locales/i18n';

import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
} from '@expo-google-fonts/instrument-sans';
import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';

import SafeBoundary from '@/components/ui/SafeBoundary';
import Toast from '@/components/ui/Toast';
import { useTheme } from '@/constants/theme';
import { useLanguageSync } from '@/hooks/useLanguageSync';
import { startSync } from '@/lib/sync';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Tapping a release notification opens that show or film. */
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

export default function RootLayout() {
  const { palette, dark } = useTheme();
  useLanguageSync();
  useNotificationRouting();
  useEffect(() => startSync(), []);
  const [loaded, error] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded, error]);

  // Hold on the background colour until the type is ready; on failure, system fonts take over.
  if (!loaded && !error) return <View style={{ flex: 1, backgroundColor: palette.bg }} />;

  return (
    <SafeBoundary>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="search" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="show/[id]" />
        <Stack.Screen name="movie/[id]" />
        <Stack.Screen name="history" />
      </Stack>
      <Toast />
    </SafeBoundary>
  );
}
