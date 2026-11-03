import { Tabs } from 'expo-router/tabs';

import { TabBar } from '../../src/ui/TabBar';
import { useTheme } from '../../src/ui/theme';

/**
 * The four tabs. Back from Cart, Lab or Settings goes to the Shop (backBehavior firstRoute), as on Android. The
 * screens below a tab live on the root stack, so a tab never keeps a deeper screen to restore.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      backBehavior="firstRoute"
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.surface } }}
      tabBar={({ state, navigateToTab }) => (
        <TabBar
          active={state.routes[state.index].name}
          onSelect={(name) => {
            const route = state.routes.find((r) => r.name === name);
            if (route && state.routes[state.index].name !== name) navigateToTab(route.key);
          }}
        />
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="cart" />
      <Tabs.Screen name="lab" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
