import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { findItem, formatPrice } from '../data/catalog';
import { actions, getState, itemCount, itemsWord, lineTotalCents, totalCents, useAppState, type CartLine } from '../data/store';
import { postNotification } from '../notifications';
import { TemplateIds, TestIds } from '../testIds';
import { Button, Dialog, DialogActions, GlyphTile, IconButton, ItemNumber, QuantityStepper, Screen, StateMessage, TopBar } from '../ui/components';
import { useSnack } from '../ui/snackbar';
import { Space, Type, useTheme } from '../ui/theme';

export function orderPlacedMessage(number: number): string {
  return `Order ${number} placed`;
}

export function CartScreen({ onBrowse, onViewOrders }: { onBrowse: () => void; onViewOrders: () => void }) {
  const { colors } = useTheme();
  const snack = useSnack();
  const cart = useAppState((s) => s.cart);
  const [confirming, setConfirming] = useState(false);
  const count = itemCount(cart);

  function placeOrder() {
    setConfirming(false);
    const order = actions.placeOrder();
    if (getState().orderUpdates) void postNotification(orderPlacedMessage(order.number), "We're packing it now.");
    snack(orderPlacedMessage(order.number), 'View orders', onViewOrders);
  }

  return (
    <Screen testID={TestIds.CART_SCREEN}>
      <TopBar title="Cart" />
      {cart.length === 0 ? (
        <StateMessage
          icon="cart"
          title="Your cart is empty"
          body="Open a drawer in the shop and add something."
          actionLabel="Browse the shop"
          onAction={onBrowse}
          testID={TestIds.CART_EMPTY}
          actionTestID={TestIds.CART_EMPTY_ACTION}
        />
      ) : (
        <>
          <FlatList
            testID={TestIds.CART_LIST}
            data={cart}
            keyExtractor={(line) => String(line.itemId)}
            renderItem={({ item: line }) => <CartLineRow line={line} />}
            contentContainerStyle={{ padding: Space.lg, gap: Space.md }}
          />
          {/* pinned below the lines: the total and Check out, on a tonal panel */}
          <View style={[styles.panel, { backgroundColor: colors.surfaceContainer }]}>
            <View style={styles.row}>
              <Text style={[Type.title, { flex: 1, color: colors.onSurface }]}>Total</Text>
              <Text testID={TestIds.CART_TOTAL} style={[Type.titleLarge, { color: colors.onSurface }]}>
                {formatPrice(totalCents(cart))}
              </Text>
            </View>
            <Button label="Check out" testID={TestIds.CART_CHECKOUT} onPress={() => setConfirming(true)} style={{ marginTop: Space.md }} />
          </View>
        </>
      )}
      <Dialog
        visible={confirming}
        title="Place this order?"
        body={`${itemsWord(count)} · ${formatPrice(totalCents(cart))}. This is a sample shop: nothing is charged or shipped.`}
        onRequestClose={() => setConfirming(false)}
        testID={TestIds.DIALOG}
        titleTestID={TestIds.DIALOG_TITLE}
        bodyTestID={TestIds.DIALOG_TEXT}
      >
        <DialogActions>
          <Button label="Cancel" variant="text" testID={TestIds.DIALOG_DISMISS} onPress={() => setConfirming(false)} />
          <Button label="Place order" variant="text" testID={TestIds.DIALOG_CONFIRM} onPress={placeOrder} />
        </DialogActions>
      </Dialog>
    </Screen>
  );
}

/** A cart line: a plain view holding the stepper's and the remove button's own ids. Not a drawer front, so no frame. */
function CartLineRow({ line }: { line: CartLine }) {
  const { colors } = useTheme();
  const item = findItem(line.itemId)!;
  return (
    <View testID={TemplateIds.cartLine(item.id)} style={{ paddingBottom: Space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.outlineVariant }}>
      <View style={styles.row}>
        <GlyphTile item={item} size={48} />
        <View style={{ flex: 1, marginLeft: Space.md }}>
          <Text style={[Type.title, { color: colors.onSurface }]}>{item.name}</Text>
          <ItemNumber item={item} />
        </View>
        <Text testID={TemplateIds.cartLineTotal(item.id)} style={[Type.title, { color: colors.onSurface }]}>
          {formatPrice(lineTotalCents(line))}
        </Text>
      </View>
      <View style={[styles.row, { marginTop: Space.xs }]}>
        <Text style={[Type.body, { flex: 1, color: colors.onSurfaceVariant }]}>{`${formatPrice(item.priceCents)} each`}</Text>
        <QuantityStepper
          value={line.quantity}
          onChange={(q) => actions.setQuantity(item.id, q)}
          decreaseId={TemplateIds.cartLineDecrease(item.id)}
          valueId={TemplateIds.cartLineQty(item.id)}
          increaseId={TemplateIds.cartLineIncrease(item.id)}
          subject={item.name}
        />
        <IconButton icon="trash" label={`Remove ${item.name}`} testID={TemplateIds.cartLineRemove(item.id)} onPress={() => actions.removeLine(item.id)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  panel: { padding: Space.lg },
});
