import Constants from 'expo-constants';
import { useCallback, useEffect, useState } from 'react';
import { AppState as AppLifecycle, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { actions, useAppState, type ThemeMode } from '../data/store';
import { askForNotifications, notificationsAllowed, postNotification } from '../notifications';
import { TestIds } from '../testIds';
import { Button, Dialog, DialogActions, Screen, TopBar } from '../ui/components';
import { useSnack } from '../ui/snackbar';
import { MONOSPACE, Space, Type, useTheme } from '../ui/theme';

export const SPEC_VERSION = '1.0';
export const NOTIFICATIONS_NOT_ALLOWED = 'Not allowed. Turn this on to be asked.';
export const NOTIFICATIONS_OFF = 'Off';
export const NOTIFICATIONS_ON = "On: we'll tell you when an order is placed.";

const THEMES: readonly { mode: ThemeMode; id: string; label: string }[] = [
  { mode: 'system', id: TestIds.SETTINGS_THEME_SYSTEM, label: 'Follow the system' },
  { mode: 'light', id: TestIds.SETTINGS_THEME_LIGHT, label: 'Light' },
  { mode: 'dark', id: TestIds.SETTINGS_THEME_DARK, label: 'Dark' },
];

/**
 * Settings. SPEC.md §5 asks Android and iOS for their classic toolkit here; React Native has one toolkit, so this
 * screen is built like the others, from React Native's core components, as §12 allows. It holds the app's one
 * system permission prompt (notifications) and its own confirm dialog, whose buttons carry the spec's ids.
 */
export function SettingsScreen({ onOrders }: { onOrders: () => void }) {
  const { colors } = useTheme();
  const snack = useSnack();
  const email = useAppState((s) => s.signedInEmail);
  const themeMode = useAppState((s) => s.themeMode);
  const slowLoading = useAppState((s) => s.slowLoading);
  const failFirstLoad = useAppState((s) => s.failFirstLoad);
  const orderUpdates = useAppState((s) => s.orderUpdates);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [resetting, setResetting] = useState(false);

  // Reads the permission when the screen opens and whenever the app comes back (it may have changed in system settings).
  const readPermission = useCallback(async () => {
    const granted = await notificationsAllowed();
    if (!granted) actions.setOrderUpdates(false);
    setAllowed(granted);
  }, []);
  useEffect(() => {
    void readPermission();
    const sub = AppLifecycle.addEventListener('change', (state) => {
      if (state === 'active') void readPermission();
    });
    return () => sub.remove();
  }, [readPermission]);

  async function toggleNotifications(wantsOn: boolean) {
    if (wantsOn && !allowed) {
      const granted = await askForNotifications();
      setAllowed(granted);
      actions.setOrderUpdates(granted);
    } else {
      actions.setOrderUpdates(wantsOn);
    }
  }

  const status = !allowed ? NOTIFICATIONS_NOT_ALLOWED : orderUpdates ? NOTIFICATIONS_ON : NOTIFICATIONS_OFF;
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen>
      <TopBar title="Settings" />
      <ScrollView testID={TestIds.SETTINGS_SCREEN} contentContainerStyle={styles.page}>
        <Section title="Account" />
        <Text testID={TestIds.SETTINGS_ACCOUNT_EMAIL} style={[Type.bodyLarge, { fontFamily: MONOSPACE, color: colors.onSurface, paddingVertical: Space.sm }]}>
          {email ?? 'Not signed in'}
        </Text>
        <View style={styles.buttons}>
          <Button label="Order history" variant="outlined" testID={TestIds.SETTINGS_ORDERS} onPress={onOrders} style={{ flex: 1 }} />
          <Button label="Sign out" variant="tonal" testID={TestIds.SETTINGS_SIGN_OUT} onPress={actions.signOut} style={{ flex: 1 }} />
        </View>

        <Section title="Appearance" />
        {/* a plain view, so each radio keeps its own id */}
        <View testID={TestIds.SETTINGS_THEME} accessibilityRole="radiogroup" accessibilityLabel="Theme">
          {THEMES.map((theme) => (
            <Radio key={theme.mode} id={theme.id} label={theme.label} checked={themeMode === theme.mode} onPress={() => actions.setThemeMode(theme.mode)} />
          ))}
        </View>

        <Section title="Notifications" />
        <SwitchRow label="Order updates" id={TestIds.SETTINGS_NOTIFICATIONS} value={orderUpdates && allowed === true} onChange={(on) => void toggleNotifications(on)} />
        <Text testID={TestIds.SETTINGS_NOTIFICATIONS_STATUS} accessibilityLiveRegion="polite" style={[Type.body, { color: colors.onSurfaceVariant }]}>
          {status}
        </Text>
        <Button
          label="Send a test notification"
          variant="text"
          testID={TestIds.SETTINGS_SEND_NOTIFICATION}
          disabled={!(allowed && orderUpdates)}
          style={{ alignSelf: 'flex-start', marginLeft: -Space.md }}
          onPress={() => {
            void postNotification('Your order is packed', 'A test notification from Mossgrove.');
            snack('Notification sent');
          }}
        />

        <Section title="Testing" />
        <Text style={[Type.body, { color: colors.onSurfaceVariant }]}>{"These change how the shop's lists load. Nothing goes over the network."}</Text>
        <SwitchRow label="Slow loading (3 seconds)" id={TestIds.SETTINGS_SLOW_LOADING} value={slowLoading} onChange={actions.setSlowLoading} />
        <SwitchRow label="Fail the first load" id={TestIds.SETTINGS_FAIL_LOADING} value={failFirstLoad} onChange={actions.setFailFirstLoad} />

        <Section title="Data" />
        <Button label="Empty the cart and orders" variant="danger" testID={TestIds.SETTINGS_RESET} onPress={() => setResetting(true)} />

        <Text testID={TestIds.SETTINGS_VERSION} style={[Type.labelMedium, styles.version, { color: colors.onSurfaceVariant }]}>
          {`Mossgrove ${version} · spec ${SPEC_VERSION} · a sample app for NthCase`}
        </Text>
      </ScrollView>

      <Dialog visible={resetting} title="Empty the cart and orders?" body="You stay signed in. This can't be undone." onRequestClose={() => setResetting(false)}>
        <DialogActions>
          <Button label="Cancel" variant="text" testID={TestIds.SETTINGS_RESET_CANCEL} onPress={() => setResetting(false)} />
          <Button
            label="Empty"
            variant="dangerText"
            testID={TestIds.SETTINGS_RESET_CONFIRM}
            onPress={() => {
              actions.resetData();
              setResetting(false);
              snack('Cart and orders emptied');
            }}
          />
        </DialogActions>
      </Dialog>
    </Screen>
  );
}

function Section({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <Text accessibilityRole="header" style={[Type.titleSmall, { color: colors.primary, marginTop: Space.xl, marginBottom: Space.sm }]}>
      {title}
    </Text>
  );
}

/** A labelled switch: React Native's own Switch carries the id, so Appium reads a real switch with its value. */
function SwitchRow({ label, id, value, onChange }: { label: string; id: string; value: boolean; onChange: (on: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.switchRow}>
      <Text style={[Type.bodyLarge, { flex: 1, color: colors.onSurface }]} onPress={() => onChange(!value)} accessible={false}>
        {label}
      </Text>
      <Switch
        testID={id}
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.surfaceContainerHighest, true: colors.primary }}
        thumbColor={value ? colors.onPrimary : colors.outline}
        ios_backgroundColor={colors.surfaceContainerHighest}
      />
    </View>
  );
}

function Radio({ id, label, checked, onPress }: { id: string; label: string; checked: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable testID={id} onPress={onPress} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked, selected: checked }} style={styles.radioRow}>
      <View style={[styles.radioOuter, { borderColor: checked ? colors.primary : colors.onSurfaceVariant }]}>
        {checked ? <View style={[styles.radioInner, { backgroundColor: colors.primary }]} /> : null}
      </View>
      <Text style={[Type.bodyLarge, { color: colors.onSurface }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: Space.lg, paddingBottom: Space.xl },
  buttons: { flexDirection: 'row', gap: Space.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  radioRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: Space.lg },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  version: { textAlign: 'center', marginTop: Space.xl },
});
