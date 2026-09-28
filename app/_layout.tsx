import '@/locales/i18n';

import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Fraunces_300Light, Fraunces_400Regular_Italic, Fraunces_500Medium } from '@expo-google-fonts/fraunces';
import { Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold } from '@expo-google-fonts/figtree';

import { palette } from '@/constants/theme';
import { useLanguageSync } from '@/hooks/useLanguageSync';

export default function RootLayout() {
  useLanguageSync();
  const [loaded, error] = useFonts({
    Fraunces_300Light,
    Fraunces_400Regular_Italic,
    Fraunces_500Medium,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
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
