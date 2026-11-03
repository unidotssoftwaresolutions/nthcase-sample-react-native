import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GLYPHS, PEBBLES } from '../generated/art';
import { Button, Icon, Screen, TextField, TopBar } from '../ui/components';
import { Radius, Space, Type, useTheme } from '../ui/theme';

/** The one gift-card code that has a balance. Any other code is unknown. */
export const GIFT_CARD_CODE = 'MOSS-0025';
export const GIFT_CARD_BALANCE = 'Balance: $25.00';
export const GIFT_CARD_UNKNOWN = "We don't recognise that code";

type Design = 'Fern' | 'Stone';

/**
 * The screen with no test ids at all (SPEC.md §5, Gift cards). Nothing here carries a testID, including its top bar,
 * so NthCase must find each control by its visible text, its label and its position. Two buttons share the text
 * "Choose": only their position tells them apart.
 */
export function GiftCardsScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [amount, setAmount] = useState(25);
  const [design, setDesign] = useState<Design | null>(null);

  return (
    <Screen>
      <TopBar title="Gift cards" onBack={onBack} tagged={false} />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Text style={[Type.title, { color: colors.onSurface }]}>Check a balance</Text>
        {/* no testID: the field's label is all NthCase has */}
        <TextField
          label="Card code"
          value={code}
          onChangeText={(t) => {
            setCode(t.toUpperCase());
            setResult(null);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
        />
        <Button label="Check balance" onPress={() => setResult(code.trim() === GIFT_CARD_CODE ? GIFT_CARD_BALANCE : GIFT_CARD_UNKNOWN)} />
        {result ? <Text style={[Type.title, { color: colors.onSurface }]}>{result}</Text> : null}

        <Text style={[Type.title, { color: colors.onSurface, marginTop: Space.sm }]}>Buy a card</Text>
        <View style={styles.row}>
          {[10, 25, 50].map((value) => {
            const selected = amount === value;
            return (
              <Pressable
                key={value}
                onPress={() => setAmount(value)}
                accessibilityRole="radio"
                accessibilityState={{ selected, checked: selected }}
                style={[
                  styles.chip,
                  selected
                    ? { backgroundColor: colors.secondaryContainer, borderColor: colors.secondaryContainer }
                    : { borderColor: colors.outline },
                ]}
              >
                {/* selected is a mark as well as a tint */}
                {selected ? <Icon name="check" size={18} color={colors.onSecondaryContainer} /> : null}
                <Text style={[Type.label, { color: selected ? colors.onSecondaryContainer : colors.onSurfaceVariant }]}>{`$${value}`}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={[styles.row, { gap: Space.md }]}>
          <DesignCard title="Fern" body="Green leaves" chosen={design === 'Fern'} onChoose={() => setDesign('Fern')} />
          <DesignCard title="Stone" body="Grey pebbles" chosen={design === 'Stone'} onChoose={() => setDesign('Stone')} />
        </View>
        <Text style={[Type.bodyLarge, { color: colors.onSurface }]}>{design ? `A $${amount} card with the ${design} design` : 'Choose a design'}</Text>
      </ScrollView>
    </Screen>
  );
}

/** A gift-card design: a picture of it, its name, and Choose. The chosen one has a check and a primary border. */
function DesignCard({ title, body, chosen, onChoose }: { title: Design; body: string; chosen: boolean; onChoose: () => void }) {
  const { colors, aisles } = useTheme();
  const tint = title === 'Fern' ? aisles.garden : aisles.home;
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surfaceContainerHighest },
        chosen ? { borderWidth: 2, borderColor: colors.primary, padding: Space.md - 2 } : null,
      ]}
    >
      <View style={[styles.picture, { backgroundColor: tint.tile }]}>
        <Image
          source={title === 'Fern' ? GLYPHS.plant : PEBBLES}
          style={title === 'Fern' ? { width: 44, height: 44, tintColor: tint.ink } : { width: 64, height: 36, tintColor: tint.ink }}
          accessible={false}
        />
      </View>
      <View style={[styles.row, { marginTop: Space.xs }]}>
        <Text style={[Type.titleSmall, { flex: 1, color: colors.onSurface }]}>{title}</Text>
        {chosen ? (
          <View accessible accessibilityLabel="Chosen">
            <Icon name="check" size={18} color={colors.primary} />
          </View>
        ) : null}
      </View>
      <Text style={[Type.bodySmall, { color: colors.onSurfaceVariant }]}>{body}</Text>
      <Button label="Choose" variant="outlined" onPress={onChoose} style={{ marginTop: Space.xs, paddingHorizontal: Space.md }} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: Space.lg, gap: Space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, height: 32, paddingHorizontal: Space.md, borderRadius: Radius.sm, borderWidth: 1 },
  card: { flex: 1, borderRadius: Radius.md, padding: Space.md, gap: Space.xs },
  picture: { height: 72, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
});
