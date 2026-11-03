import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TestIds } from '../testIds';
import { Icon, Screen, TopBar } from '../ui/components';
import { Space, Type, useTheme } from '../ui/theme';

export type BenchRoute = '/form' | '/gestures' | '/webview' | '/slow' | '/orders' | '/gift-cards';

const BENCHES: readonly { id: string; route: BenchRoute; title: string; body: string }[] = [
  { id: TestIds.LAB_FORM, route: '/form', title: 'Join the club', body: 'A form: text, email, number, password, picker, date, switch, slider, checkbox' },
  { id: TestIds.LAB_GESTURES, route: '/gestures', title: 'Gestures', body: 'Tap, double tap, long press, swipe, drag and drop, pinch, rotate, scroll, shake' },
  { id: TestIds.LAB_WEBVIEW, route: '/webview', title: 'Care guide', body: 'A web page inside the app, bundled with it' },
  { id: TestIds.LAB_SLOW, route: '/slow', title: 'Delivery slots', body: 'Loads for 3 seconds, then shows its content' },
  { id: TestIds.LAB_ORDERS, route: '/orders', title: 'Orders', body: 'An empty state, and an error state with retry' },
  { id: TestIds.LAB_GIFT_CARDS, route: '/gift-cards', title: 'Gift cards', body: 'No test ids at all: find things by their text' },
];

/** The Lab: Mossgrove's second cabinet, one drawer per test bench. It says plainly what each one is for. */
export function LabScreen({ onOpen }: { onOpen: (route: BenchRoute) => void }) {
  const { colors } = useTheme();
  return (
    <Screen testID={TestIds.LAB_SCREEN}>
      <TopBar title="Lab" />
      <ScrollView>
        <Text style={[Type.body, styles.intro, { color: colors.onSurfaceVariant }]}>
          Screens for testing. Each one exercises verbs that NthCase records and replays.
        </Text>
        {BENCHES.map((bench) => (
          <View key={bench.id}>
            <Pressable
              testID={bench.id}
              onPress={() => onOpen(bench.route)}
              accessibilityRole="button"
              accessibilityHint={`Open ${bench.title}`}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceContainer }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[Type.bodyLarge, { color: colors.onSurface }]}>{bench.title}</Text>
                <Text style={[Type.body, { color: colors.onSurfaceVariant }]}>{bench.body}</Text>
              </View>
              <Icon name="chevron" />
            </Pressable>
            <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { paddingHorizontal: Space.lg, paddingVertical: Space.sm },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 72, paddingHorizontal: Space.lg, paddingVertical: Space.md, gap: Space.lg },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: Space.lg },
});
