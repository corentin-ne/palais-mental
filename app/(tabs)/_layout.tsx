import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';

import ItemSheet from '@/components/ui/ItemSheet';
import LogFlow from '@/components/ui/LogFlow';
import TabBar from '@/components/ui/TabBar';
import Toast from '@/components/ui/Toast';
import BubbleBurst from '@/components/ui/aero/BubbleBurst';
import SkyBackdrop from '@/components/ui/aero/SkyBackdrop';
import { useTheme } from '@/constants/theme';

/** Four places, one log button. Sheets and toasts live above every tab. */
export default function TabsLayout() {
  const { palette, aero } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      {aero && <SkyBackdrop />}
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: palette.screen } }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="library" />
        <Tabs.Screen name="palace" />
        <Tabs.Screen name="profile" />
      </Tabs>
      {aero && <BubbleBurst />}
      <Toast />
      <LogFlow />
      <ItemSheet />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
