import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';

import ItemSheet from '@/components/ui/ItemSheet';
import LogFlow from '@/components/ui/LogFlow';
import TabBar from '@/components/ui/TabBar';
import Toast from '@/components/ui/Toast';
import { useTheme } from '@/constants/theme';
import { startReleaseSync } from '@/lib/releases';

/** Four places, one add button. Sheets and toasts live above every tab. */
export default function TabsLayout() {
  const { palette } = useTheme();
  useEffect(() => startReleaseSync(), []);
  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: palette.screen }, animation: 'fade' }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="library" />
        <Tabs.Screen name="soon" />
        <Tabs.Screen name="profile" />
      </Tabs>
      <Toast />
      <LogFlow />
      <ItemSheet />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
