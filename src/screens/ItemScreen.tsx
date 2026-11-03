import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { categoryLabel, findItemByRawId, formatPrice, ITEMS } from '../data/catalog';
import { actions } from '../data/store';
import { TestIds } from '../testIds';
import { Button, GlyphTile, ItemNumber, QuantityStepper, Screen, StateMessage, TopBar } from '../ui/components';
import { useSnack } from '../ui/snackbar';
import { Radius, Space, Type, useTheme } from '../ui/theme';

export const ADDED_MESSAGE = 'Added to cart';

/** The detail page. [rawId] is the route's (or the deep link's) id as written, so an unknown id can say so. */
export function ItemScreen({ rawId, onBack, onViewCart }: { rawId: string; onBack: () => void; onViewCart: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const snack = useSnack();
  const item = findItemByRawId(rawId);
  const [quantity, setQuantity] = useState(1);

  return (
    <Screen testID={TestIds.ITEM_SCREEN}>
      <TopBar title={item?.name ?? 'Not found'} onBack={onBack} />
      {item === undefined ? (
        <StateMessage
          icon="empty"
          title={`No drawer has the number "${rawId}"`}
          body={`Items are numbered 1 to ${ITEMS.length}.`}
          actionLabel="Back to the shop"
          onAction={onBack}
          testID={TestIds.ITEM_NOT_FOUND}
          actionTestID={TestIds.ITEM_NOT_FOUND_ACTION}
        />
      ) : (
        <ScrollView contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + Space.xl }]}>
          <View style={styles.column}>
            <View style={{ alignItems: 'center' }}>
              <GlyphTile item={item} size={220} label={`Drawing of the ${item.name}`} testID={TestIds.ITEM_IMAGE} />
            </View>
            {/* the drawer's label holder, at the scale of the page: the name, then its number */}
            <View style={[styles.holder, { borderColor: colors.outlineVariant }]}>
              <Text testID={TestIds.ITEM_NAME} style={[Type.headlineSmall, { color: colors.onSurface }]}>
                {item.name}
              </Text>
              <ItemNumber item={item} testID={TestIds.ITEM_NUMBER} />
            </View>
            <Text testID={TestIds.ITEM_PRICE} style={[Type.titleLarge, { color: colors.onSurface }]}>
              {formatPrice(item.priceCents)}
            </Text>
            <Text testID={TestIds.ITEM_DESCRIPTION} style={[Type.bodyLarge, { color: colors.onSurfaceVariant }]}>
              {item.description}
            </Text>
            <Text style={[Type.label, { color: colors.onSurfaceVariant }]}>{`${categoryLabel(item.category)} aisle`}</Text>
            <View style={styles.quantityRow}>
              <Text style={[Type.titleSmall, { flex: 1, color: colors.onSurface }]}>Quantity</Text>
              <QuantityStepper
                value={quantity}
                onChange={setQuantity}
                decreaseId={TestIds.ITEM_QTY_DECREASE}
                valueId={TestIds.ITEM_QTY_VALUE}
                increaseId={TestIds.ITEM_QTY_INCREASE}
                subject={item.name}
              />
            </View>
            <Button
              label={`Add to cart · ${formatPrice(item.priceCents * quantity)}`}
              variant="brass"
              testID={TestIds.ITEM_ADD_TO_CART}
              onPress={() => {
                actions.addToCart(item.id, quantity);
                snack(ADDED_MESSAGE, 'View cart', onViewCart);
              }}
            />
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: Space.lg, paddingVertical: Space.sm, alignItems: 'center' },
  column: { width: '100%', maxWidth: 560, gap: Space.md },
  holder: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: Radius.xs, paddingHorizontal: 10, paddingVertical: 6, marginTop: Space.xs },
  quantityRow: { flexDirection: 'row', alignItems: 'center', marginTop: Space.sm },
});
