import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { actions, useAppState } from '../src/data/store';
import { setUpNotifications } from '../src/notifications';
import { SnackbarProvider } from '../src/ui/snackbar';
import { TAB_BAR_HEIGHT } from '../src/ui/TabBar';
import { DARK_THEME, LIGHT_THEME, ThemeContext } from '../src/ui/theme';

/**
 * The root: one stack. Signed out, only the sign-in screen exists; signed in, the four tabs and every screen below
 * them. Screens below a tab sit on this stack above the tabs, so the tab bar is hidden there, and a tab always opens
 * at its first screen (SPEC.md §4). Signing out flips the guard, which clears the stack back to sign-in.
 */
export default function RootLayout() {
  const signedIn = useAppState((s) => s.signedInEmail !== null);
  const themeMode = useAppState((s) => s.themeMode);
  const pendingItemId = useAppState((s) => s.pendingItemId);
  const router = useRouter();
  const segments = useSegments();

  // Settings › Appearance applies to the whole app at once, native views (switches, the web page) included.
  useEffect(() => {
    try {
      Appearance.setColorScheme(themeMode === 'system' ? 'unspecified' : themeMode);
    } catch {
      // no native appearance module (tests): the palette below still follows the choice
    }
  }, [themeMode]);
  const system = useColorScheme();
  const dark = (themeMode === 'system' ? system : themeMode) === 'dark';
  const theme = dark ? DARK_THEME : LIGHT_THEME;

  useEffect(() => {
    void setUpNotifications();
  }, []);

  // A deep link opens its item as soon as someone is signed in: at once, or right after the sign-in screen. It waits
  // until the signed-in screens are in front, so the guard's swap from sign-in to the tabs cannot swallow it.
  const front = segments[0];
  useEffect(() => {
    if (signedIn && pendingItemId !== null && front !== undefined && front !== 'sign-in') {
      actions.setPendingItemId(null);
      router.push({ pathname: '/item/[id]', params: { id: pendingItemId } });
    }
  }, [signedIn, pendingItemId, front, router]);

  const onTabs = front === '(tabs)';
  return (
    <ThemeContext.Provider value={theme}>
      <SnackbarProvider bottomOffset={onTabs ? TAB_BAR_HEIGHT : 0}>
        <StatusBar style={dark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.surface } }}>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="sign-in" />
          </Stack.Protected>
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="item/[id]" />
            <Stack.Screen name="form" />
            <Stack.Screen name="gestures" />
            <Stack.Screen name="webview" />
            <Stack.Screen name="slow" />
            <Stack.Screen name="orders" />
            <Stack.Screen name="gift-cards" />
          </Stack.Protected>
        </Stack>
      </SnackbarProvider>
    </ThemeContext.Provider>
  );
}
