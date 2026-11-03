import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { TemplateIds, TestIds } from '../testIds';
import { Button, Loading, Screen, StateMessage, TopBar } from '../ui/components';
import { Space, Type, useTheme } from '../ui/theme';
import { useLoad } from '../ui/useLoad';

/** The five delivery slots the slow screen shows, in order. Fixed text, so a check can name any of them. */
export const DELIVERY_SLOTS = [
  'Monday · 8:00–10:00',
  'Monday · 18:00–20:00',
  'Wednesday · 12:00–14:00',
  'Friday · 8:00–10:00',
  'Saturday · 10:00–12:00',
] as const;

/** Always slow: a 3 s spinner, then the slots. Reload starts the wait again. */
export function SlowScreen({ onBack }: { onBack: () => void }) {
  const [round, setRound] = useState(0);
  return (
    <Screen testID={TestIds.SLOW_SCREEN}>
      <TopBar title="Delivery slots" onBack={onBack} />
      <Slots key={round} onReload={() => setRound((r) => r + 1)} />
    </Screen>
  );
}

function Slots({ onReload }: { onReload: () => void }) {
  const { colors } = useTheme();
  const load = useLoad(true);
  if (load.status === 'loading') return <Loading text="Finding delivery slots…" testID={TestIds.SLOW_LOADING} />;
  if (load.status === 'failed') {
    return <StateMessage icon="warning" title="Slots didn't load" body="Something went wrong on our side." actionLabel="Try again" onAction={load.retry} isError />;
  }
  return (
    <ScrollView testID={TestIds.SLOW_CONTENT}>
      <Text style={[Type.body, { color: colors.onSurfaceVariant, padding: Space.lg }]}>Choose when we bring your order.</Text>
      {DELIVERY_SLOTS.map((slot, index) => (
        <View key={slot} style={styles.slot}>
          <Text testID={TemplateIds.slowSlot(index + 1)} style={[Type.bodyLarge, { color: colors.onSurface }]}>
            {slot}
          </Text>
        </View>
      ))}
      <Button label="Reload" variant="outlined" testID={TestIds.SLOW_RELOAD} onPress={onReload} style={{ margin: Space.lg }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  slot: { minHeight: 56, justifyContent: 'center', paddingHorizontal: Space.lg },
});
