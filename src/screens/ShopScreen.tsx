import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatPrice, itemNumber, ITEMS, search, type Item } from '../data/catalog';
import { getState } from '../data/store';
import { TemplateIds, TestIds } from '../testIds';
import { GlyphTile, IconButton, LabelHolder, Loading, Price, StateMessage, TextField } from '../ui/components';
import { useSnack } from '../ui/snackbar';
import { Radius, Space, Type, useTheme } from '../ui/theme';
import { SLOW_LOAD_MS, useLoad, useVisit } from '../ui/useLoad';

/** How long a pull-to-refresh spins when loading is not slowed. */
export const REFRESH_MS = 800;
export const REFRESHED_MESSAGE = 'Catalogue is up to date';

export function ShopScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const snack = useSnack();
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const visit = useVisit();
  const load = useLoad(false, visit);
  const results = useMemo(() => search(query), [query]);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  function refresh() {
    setRefreshing(true);
    refreshTimer.current = setTimeout(() => {
      setRefreshing(false);
      snack(REFRESHED_MESSAGE);
    }, getState().slowLoading ? SLOW_LOAD_MS : REFRESH_MS);
  }

  return (
    <View testID={TestIds.SHOP_SCREEN} style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[Type.headline, { color: colors.onSurface }]}>
          Mossgrove
        </Text>
        <View style={{ height: Space.md }} />
        <TextField
          label="Search"
          showLabel={false}
          testID={TestIds.SHOP_SEARCH}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or number"
          leading="search"
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          trailing={
            query !== '' ? (
              <IconButton testID={TestIds.SHOP_SEARCH_CLEAR} icon="close" label="Clear search" onPress={() => setQuery('')} />
            ) : null
          }
        />
        {load.status === 'ready' ? (
          <Text testID={TestIds.SHOP_COUNT} style={[Type.label, { color: colors.onSurfaceVariant, marginTop: Space.md }]}>
            {query.trim() === '' ? `${ITEMS.length} drawers · No. 001–040` : `${results.length} of ${ITEMS.length} drawers`}
          </Text>
        ) : null}
      </View>
      {load.status === 'loading' ? (
        <Loading text="Opening the drawers…" testID={TestIds.SHOP_LOADING} />
      ) : load.status === 'failed' ? (
        <StateMessage
          icon="warning"
          title="The catalogue didn't load"
          body="Something went wrong on our side. Your cart is safe."
          actionLabel="Try again"
          onAction={load.retry}
          isError
          testID={TestIds.SHOP_ERROR}
          actionTestID={TestIds.SHOP_RETRY}
        />
      ) : (
        <FlatList
          testID={TestIds.SHOP_LIST}
          data={results}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <DrawerRow item={item} onPress={() => router.push(`/item/${item.id}`)} />}
          contentContainerStyle={[styles.list, results.length === 0 && { flexGrow: 1 }]}
          ItemSeparatorComponent={Gap}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={ITEMS.length}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} tintColor={colors.primary} />}
          ListEmptyComponent={
            <StateMessage
              icon="empty"
              title={`No drawers match "${query.trim()}"`}
              body="Try a shorter word, or an item number like 7."
              actionLabel="Clear search"
              onAction={() => setQuery('')}
              testID={TestIds.SHOP_EMPTY}
              actionTestID={TestIds.SHOP_EMPTY_ACTION}
            />
          }
        />
      )}
    </View>
  );
}

function Gap() {
  return <View style={{ height: Space.sm }} />;
}

/** One drawer front: the glyph tile, the label holder, the price. The row is one accessible element with its id. */
function DrawerRow({ item, onPress }: { item: Item; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={TemplateIds.shopItem(item.id)}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${itemNumber(item.id)}, ${formatPrice(item.priceCents)}`}
      accessibilityHint={`Open ${item.name}`}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceContainer : colors.surfaceContainerLow }]}
    >
      <GlyphTile item={item} size={56} />
      <View style={{ flex: 1, marginHorizontal: Space.md }}>
        <LabelHolder item={item} />
      </View>
      <Price cents={item.priceCents} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Space.lg, paddingTop: Space.lg, paddingBottom: Space.sm },
  list: { paddingHorizontal: Space.lg, paddingVertical: Space.sm },
  row: { flexDirection: 'row', alignItems: 'center', padding: Space.md, borderRadius: Radius.md },
});
