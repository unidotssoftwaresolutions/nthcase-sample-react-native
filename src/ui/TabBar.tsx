import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { itemCount, itemsWord, useAppState } from '../data/store';
import { TestIds } from '../testIds';
import { Icon, type IconName } from './components';
import { Radius, Space, Type, useTheme } from './theme';

export const TAB_BAR_HEIGHT = 80;

/** The four tabs, in the spec's order, by route name inside app/(tabs). */
export const TABS: readonly { route: string; label: string; icon: IconName; id: string }[] = [
  { route: 'index', label: 'Shop', icon: 'shop', id: TestIds.NAV_SHOP },
  { route: 'cart', label: 'Cart', icon: 'cart', id: TestIds.NAV_CART },
  { route: 'lab', label: 'Lab', icon: 'lab', id: TestIds.NAV_LAB },
  { route: 'settings', label: 'Settings', icon: 'settings', id: TestIds.NAV_SETTINGS },
];

/** "Cart" or "Cart, 2 items": the Cart tab says its count itself, so the count reaches a screen reader and Appium. */
export function cartTabLabel(count: number): string {
  return count > 0 ? `Cart, ${itemsWord(count)}` : 'Cart';
}

/**
 * The bottom bar: a Material navigation bar on Android (the active tab in a pill), a plain tinted bar on iOS. Each
 * tab is one accessible button with its id; the icon, the label and the brass badge are its id-less children.
 */
export function TabBar({ active, onSelect }: { active: string; onSelect: (route: string) => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const count = useAppState((s) => itemCount(s.cart));
  const material = Platform.OS !== 'ios';
  return (
    <View accessibilityRole="tabbar" style={[styles.bar, { backgroundColor: colors.surfaceContainer, paddingBottom: insets.bottom, height: TAB_BAR_HEIGHT + insets.bottom }]}>
      {TABS.map((tab) => {
        const selected = tab.route === active;
        const ink = selected ? (material ? colors.onSecondaryContainer : colors.primary) : colors.onSurfaceVariant;
        return (
          <Pressable
            key={tab.route}
            testID={tab.id}
            onPress={() => onSelect(tab.route)}
            accessibilityRole="tab"
            accessibilityLabel={tab.route === 'cart' ? cartTabLabel(count) : tab.label}
            accessibilityState={{ selected }}
            style={styles.tab}
          >
            <View style={[styles.indicator, material && selected && { backgroundColor: colors.secondaryContainer }]}>
              <Icon name={tab.icon} color={ink} />
              {tab.route === 'cart' && count > 0 ? (
                <View style={[styles.badge, { backgroundColor: colors.tertiary }]}>
                  <Text style={[Type.labelMedium, { color: colors.onTertiary, fontSize: 11, lineHeight: 16 }]}>{count}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[Type.labelMedium, { color: selected ? (material ? colors.onSurface : colors.primary) : colors.onSurfaceVariant }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Space.xs },
  indicator: { width: 64, height: 32, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 0, left: 36, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
});
