/*
 * Jest stands in for the three native modules the app talks to. Each fake keeps just enough state (test/fakes.ts)
 * for the tests to drive it: the notification permission and what was posted, the accelerometer's listener, and a
 * web view that reports a finished load.
 */
import { accelerometerFake, notificationFake } from './fakes';

jest.mock('expo-notifications', () => {
  const fake = (jest.requireActual('./fakes') as typeof import('./fakes')).notificationFake;
  return {
    AndroidImportance: { DEFAULT: 3 },
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(async () => null),
    getPermissionsAsync: jest.fn(async () => ({ granted: fake.granted })),
    requestPermissionsAsync: jest.fn(async () => {
      fake.asked += 1;
      fake.granted = fake.askAnswer;
      return { granted: fake.granted };
    }),
    scheduleNotificationAsync: jest.fn(async ({ content }: { content: { title: string; body: string } }) => {
      fake.posted.push(content);
      return 'id';
    }),
  };
});

jest.mock('expo-sensors', () => {
  const fake = (jest.requireActual('./fakes') as typeof import('./fakes')).accelerometerFake;
  return {
    Accelerometer: {
      setUpdateInterval: jest.fn(),
      addListener: (listener: (r: { x: number; y: number; z: number }) => void) => {
        fake.listener = listener;
        return { remove: () => (fake.listener = null) };
      },
    },
  };
});

jest.mock('react-native-webview', () => {
  const { useEffect, createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  function WebView(props: { onLoadEnd?: () => void } & Record<string, unknown>) {
    useEffect(() => {
      props.onLoadEnd?.();
    }, []);
    return createElement(View, { ...props, collapsable: false });
  }
  return { WebView, default: WebView };
});

beforeEach(() => {
  notificationFake.granted = false;
  notificationFake.askAnswer = true;
  notificationFake.asked = 0;
  notificationFake.posted = [];
  accelerometerFake.listener = null;
});
