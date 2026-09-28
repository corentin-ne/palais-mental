import '@/locales/i18n';

import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
} from '@expo-google-fonts/instrument-sans';
import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import {
  OpenSans_300Light,
  OpenSans_400Regular,
  OpenSans_400Regular_Italic,
  OpenSans_500Medium,
  OpenSans_600SemiBold,
} from '@expo-google-fonts/open-sans';

import { makeStyles, useTheme } from '@/constants/theme';
import { useLanguageSync } from '@/hooks/useLanguageSync';

export default function RootLayout() {
  const { palette } = useTheme();
  useLanguageSync();
  const [loaded, error] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    OpenSans_300Light,
    OpenSans_400Regular,
    OpenSans_400Regular_Italic,
    OpenSans_500Medium,
    OpenSans_600SemiBold,
  });

  // Hold on the room's ground colour until the type is ready; on failure, system fonts take over.
  if (!loaded && !error) return <View style={{ flex: 1, backgroundColor: palette.bg }} />;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg } }} />
    </>
  );
}
