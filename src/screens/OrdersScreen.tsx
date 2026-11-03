import { FlatList, StyleSheet, Text, View } from 'react-native';

import { findItem, formatPrice } from '../data/catalog';
import { itemCount, itemsWord, totalCents, useAppState } from '../data/store';
import { TemplateIds, TestIds } from '../testIds';
import { Loading, Screen, StateMessage, TopBar } from '../ui/components';
import { Space, Type, useTheme } from '../ui/theme';
import { useLoad } from '../ui/useLoad';

/** Order history: the empty state and, with Settings › Fail the first load, the error state with retry. */
export function OrdersScreen({ onBack, onShop }: { onBack: () => void; onShop: () => void }) {
  const { colors } = useTheme();
  const orders = useAppState((s) => s.orders);
  const load = useLoad();

  return (
    <Screen testID={TestIds.ORDERS_SCREEN}>
      <TopBar title="Orders" onBack={onBack} />
      {load.status === 'loading' ? (
        <Loading text="Fetching your orders…" testID={TestIds.ORDERS_LOADING} />
      ) : load.status === 'failed' ? (
        <StateMessage
          icon="warning"
          title="Orders didn't load"
          body="Something went wrong on our side. Try again in a moment."
          actionLabel="Try again"
          onAction={load.retry}
          isError
          testID={TestIds.ORDERS_ERROR}
          actionTestID={TestIds.ORDERS_RETRY}
        />
      ) : orders.length === 0 ? (
        <StateMessage
          icon="empty"
          title="No orders yet"
          body="Orders you place appear here."
          actionLabel="Start shopping"
          onAction={onShop}
          testID={TestIds.ORDERS_EMPTY}
          actionTestID={TestIds.ORDERS_EMPTY_ACTION}
        />
      ) : (
        <FlatList
          testID={TestIds.ORDERS_LIST}
          data={orders}
          keyExtractor={(order) => String(order.number)}
          renderItem={({ item: order }) => (
            <View testID={TemplateIds.ordersRow(order.number)} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[Type.bodyLarge, { color: colors.onSurface }]}>{`Order ${order.number}`}</Text>
                <Text style={[Type.body, { color: colors.onSurfaceVariant }]}>
                  {`${itemsWord(itemCount(order.lines))} · ${order.lines.map((l) => findItem(l.itemId)!.name).join(', ')}`}
                </Text>
              </View>
              <Text style={[Type.title, { color: colors.onSurface }]}>{formatPrice(totalCents(order.lines))}</Text>
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 72, paddingHorizontal: Space.lg, paddingVertical: Space.md, gap: Space.lg },
});
