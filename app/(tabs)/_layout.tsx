import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';

import TabBar from '@/components/ui/TabBar';
import { useTheme } from '@/constants/theme';

/** The app opens on Up next, whatever the order of the bar. */
export const unstable_settings = { initialRouteName: 'index' };

/** Up next at the centre, two places on each side; search lives inside the screens. */
export default function TabsLayout() {
  const { palette } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: palette.screen }, animation: 'shift' }}
      >
        <Tabs.Screen name="calendar" />
        <Tabs.Screen name="library" />
        <Tabs.Screen name="index" />
        <Tabs.Screen name="social" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
