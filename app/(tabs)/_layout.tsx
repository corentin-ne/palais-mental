import { Tabs } from 'expo-router';

import ItemSheet from '@/components/ui/ItemSheet';
import LogFlow from '@/components/ui/LogFlow';
import TabBar from '@/components/ui/TabBar';
import Toast from '@/components/ui/Toast';
import { palette } from '@/constants/theme';

/** Four places, one log button. Sheets and toasts live above every tab. */
export default function TabsLayout() {
  return (
    <>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: palette.bg } }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="library" />
        <Tabs.Screen name="palace" />
        <Tabs.Screen name="profile" />
      </Tabs>
      <Toast />
      <LogFlow />
      <ItemSheet />
    </>
  );
}
