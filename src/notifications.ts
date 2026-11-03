import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Local notifications only: nothing is pushed from a server, no push token is ever asked for, and nothing is posted
 * when the permission is refused. This is the app's one system permission prompt (SPEC.md §5, Settings).
 */
const CHANNEL = 'orders';

let ready = false;

/** Shows notifications while the app is open too, and creates Android's "Order updates" channel. */
export async function setUpNotifications() {
  if (ready) return;
  ready = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Order updates',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function notificationsAllowed(): Promise<boolean> {
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

/** Shows the system prompt (Android 13+ POST_NOTIFICATIONS, iOS authorization) and says whether it was allowed. */
export async function askForNotifications(): Promise<boolean> {
  const { granted } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: false },
  });
  return granted;
}

export async function postNotification(title: string, body: string) {
  if (!(await notificationsAllowed())) return;
  await setUpNotifications();
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
  });
}
