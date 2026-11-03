import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatPrice, itemNumber, type Item } from '../data/catalog';
import { GLYPHS, ICONS } from '../generated/art';
import { TestIds } from '../testIds';
import { ItemNumberStyle, Radius, Space, Type, useTheme } from './theme';

/*
 * How ids reach Appium here. React Native hands `testID` to the platform view: Android's resource-id, iOS's
 * accessibilityIdentifier (XCUITest's `name`). On iOS an element that is `accessible` (every Pressable by default)
 * becomes one accessibility element and hides its children from XCUITest. So an id never sits inside a Pressable or
 * any other accessible view: a pressable carries its own id and only id-less children, and containers that hold
 * other ids (a dialog, a snackbar, a cart line, a state message) are plain views, not accessible ones.
 * `__tests__/ids.test.tsx` walks every screen's tree to keep it so.
 */

export type IconName = keyof typeof ICONS;

/** One of the 17 stroked interface icons (art/icons), tinted. Decorative: it never carries a label of its own. */
export function Icon({ name, size = 24, color }: { name: IconName; size?: number; color?: string }) {
  const { colors } = useTheme();
  return (
    <Image
      source={ICONS[name]}
      style={{ width: size, height: size, tintColor: color ?? colors.onSurfaceVariant }}
      accessible={false}
      importantForAccessibility="no"
    />
  );
}

/** "No. 007" in brass monospace: the item's mark on every screen. */
export function ItemNumber({ item, testID }: { item: Item; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Text testID={testID} style={[ItemNumberStyle, { color: colors.tertiary }]}>
      {itemNumber(item.id)}
    </Text>
  );
}

/** The item's drawing on its aisle's tint. The glyph fills 62 % of the square tile. */
export function GlyphTile({ item, size, label, testID }: { item: Item; size: number; label?: string; testID?: string }) {
  const { aisles } = useTheme();
  const tint = aisles[item.category];
  const glyph = Math.round(size * 0.62);
  return (
    <View
      testID={testID}
      accessible={label !== undefined}
      accessibilityRole={label !== undefined ? 'image' : undefined}
      accessibilityLabel={label}
      style={{ width: size, height: size, borderRadius: Radius.sm, backgroundColor: tint.tile, alignItems: 'center', justifyContent: 'center' }}
    >
      <Image source={GLYPHS[item.glyph]} style={{ width: glyph, height: glyph, tintColor: tint.ink }} accessible={false} />
    </View>
  );
}

/** The label holder of a drawer front: a thin frame around the name and the number. It hugs its content. */
export function LabelHolder({ item }: { item: Item }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.labelHolder, { borderColor: colors.outlineVariant }]}>
      <Text style={[Type.title, { color: colors.onSurface }]}>{item.name}</Text>
      <ItemNumber item={item} />
    </View>
  );
}

/** The top app bar: the screen's title, and a Back arrow on screens below a tab. Gift cards shows it without ids. */
export function TopBar({ title, onBack, tagged = true }: { title: string; onBack?: () => void; tagged?: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.topBar, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <View style={styles.topBarRow}>
        {onBack ? (
          <Pressable
            testID={tagged ? TestIds.TOP_BAR_BACK : undefined}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={4}
            style={styles.iconButton}
          >
            <Icon name="back" color={colors.onSurface} />
          </Pressable>
        ) : (
          <View style={{ width: Space.xs }} />
        )}
        <Text
          testID={tagged ? TestIds.TOP_BAR_TITLE : undefined}
          accessibilityRole="header"
          numberOfLines={1}
          style={[Type.titleLarge, styles.topBarTitle, { color: colors.onSurface }]}
        >
          {title}
        </Text>
      </View>
    </View>
  );
}

export type ButtonVariant = 'filled' | 'brass' | 'outlined' | 'tonal' | 'text' | 'danger' | 'dangerText';

/** A Material-shaped button: a pill, 48 dp tall. Its label is its only child, so its id stays reachable. */
export function Button({
  label,
  onPress,
  variant = 'filled',
  testID,
  disabled = false,
  accessibilityLabel,
  style,
  leading,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  testID?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  leading?: IconName;
}) {
  const { colors } = useTheme();
  const look: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    filled: { bg: colors.primary, fg: colors.onPrimary },
    // brass, like the item number and the cart badge: the one live action of the item page
    brass: { bg: colors.tertiary, fg: colors.onTertiary },
    outlined: { bg: 'transparent', fg: colors.primary, border: colors.outline },
    tonal: { bg: colors.secondaryContainer, fg: colors.onSecondaryContainer },
    text: { bg: 'transparent', fg: colors.primary },
    danger: { bg: 'transparent', fg: colors.error, border: colors.error },
    dangerText: { bg: 'transparent', fg: colors.error },
  };
  const { bg, fg, border } = look[variant];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        (variant === 'text' || variant === 'dangerText') && styles.textButton,
        { backgroundColor: bg, borderColor: border ?? 'transparent', borderWidth: border ? 1 : 0 },
        disabled && { opacity: 0.38 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {leading ? <Icon name={leading} size={18} color={fg} /> : null}
      <Text style={[Type.label, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** A 48 dp round icon button with a spoken label. Outlined buttons lose their ring when disabled (a shape, not a dimmer colour). */
export function IconButton({
  icon,
  label,
  onPress,
  testID,
  disabled = false,
  outlined = false,
  color,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  testID?: string;
  disabled?: boolean;
  outlined?: boolean;
  color?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[
        styles.iconButton,
        outlined && !disabled && { borderWidth: 1, borderColor: colors.outline },
        disabled && { opacity: 0.38 },
      ]}
    >
      <Icon name={icon} color={color ?? colors.onSurfaceVariant} />
    </Pressable>
  );
}

/** A − value + stepper. The value's id and the buttons' ids come from the caller. */
export function QuantityStepper({
  value,
  onChange,
  decreaseId,
  valueId,
  increaseId,
  subject,
  min = 1,
  max = 9,
}: {
  value: number;
  onChange: (value: number) => void;
  decreaseId: string;
  valueId: string;
  increaseId: string;
  subject: string;
  min?: number;
  max?: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <IconButton icon="minus" label={`Decrease ${subject}`} outlined disabled={value <= min} testID={decreaseId} onPress={() => onChange(value - 1)} />
      <Text
        testID={valueId}
        accessibilityLabel={`Quantity of ${subject}: ${value}`}
        style={[Type.title, { minWidth: 40, textAlign: 'center', color: colors.onSurface }]}
      >
        {value}
      </Text>
      <IconButton icon="plus" label={`Increase ${subject}`} outlined disabled={value >= max} testID={increaseId} onPress={() => onChange(value + 1)} />
    </View>
  );
}

/**
 * A centred message with an icon, a title, a line of help and one action: the shape of every empty and error state.
 * The container carries the state's id; it is a plain view, so the action button keeps its own id.
 */
export function StateMessage({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  testID,
  actionTestID,
  isError = false,
  style,
}: {
  icon: IconName;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
  actionTestID?: string;
  isError?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={[styles.stateMessage, style]}>
      <Icon name={icon} size={40} color={isError ? colors.error : colors.onSurfaceVariant} />
      <Text style={[Type.titleLarge, styles.center, { color: colors.onSurface, marginTop: Space.lg }]}>{title}</Text>
      <Text style={[Type.body, styles.center, { color: colors.onSurfaceVariant, marginTop: Space.sm }]}>{body}</Text>
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant={isError ? 'filled' : 'outlined'}
          testID={actionTestID}
          style={{ marginTop: Space.xl, paddingHorizontal: Space.xl }}
        />
      ) : null}
    </View>
  );
}

/** A spinner with a line under it, for the slow loads. */
export function Loading({ text, testID }: { text: string; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={styles.stateMessage}>
      <ActivityIndicator size="large" color={colors.primary} accessibilityLabel={text} />
      <Text style={[Type.body, { color: colors.onSurfaceVariant, marginTop: Space.lg }]}>{text}</Text>
    </View>
  );
}

/** A field's error, as a line of its own under the field, with a warning icon (never a red outline alone). */
export function ErrorLine({ error, testID }: { error?: string; testID: string }) {
  const { colors } = useTheme();
  if (!error) return null;
  return (
    <View style={[styles.row, { marginTop: Space.xs, marginLeft: Space.xs }]}>
      <Icon name="warning" size={16} color={colors.error} />
      <Text testID={testID} accessibilityLiveRegion="polite" style={[Type.bodySmall, { color: colors.error, marginLeft: 6, flexShrink: 1 }]}>
        {error}
      </Text>
    </View>
  );
}

/**
 * An outlined text field with its label above it. The input carries the id; a trailing button (clear, show/hide)
 * sits beside the input, never inside it.
 */
export function TextField({
  label,
  testID,
  error = false,
  trailing,
  leading,
  showLabel = true,
  ...input
}: TextInputProps & { label: string; testID?: string; error?: boolean; trailing?: ReactNode; leading?: IconName; showLabel?: boolean }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.error : focused ? colors.primary : colors.outline;
  return (
    <View>
      {showLabel ? (
        <Text style={[Type.bodySmall, { color: error ? colors.error : colors.onSurfaceVariant, marginBottom: Space.xs }]}>{label}</Text>
      ) : null}
      <View style={[styles.field, { borderColor, borderWidth: focused || error ? 2 : 1 }]}>
        {leading ? (
          <View style={{ marginLeft: Space.md }}>
            <Icon name={leading} />
          </View>
        ) : null}
        <TextInput
          testID={testID}
          accessibilityLabel={label}
          placeholderTextColor={colors.onSurfaceVariant}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[Type.bodyLarge, styles.input, { color: colors.onSurface }]}
          {...input}
        />
        {trailing}
      </View>
    </View>
  );
}

/** A Material-style dialog in a Modal: a title, a body, and its own buttons, each with an id when the caller gives one. */
export function Dialog({
  visible,
  title,
  body,
  onRequestClose,
  children,
  testID,
  titleTestID,
  bodyTestID,
}: {
  visible: boolean;
  title: string;
  body?: string;
  onRequestClose: () => void;
  children: ReactNode;
  testID?: string;
  titleTestID?: string;
  bodyTestID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose} statusBarTranslucent navigationBarTranslucent>
      <View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onRequestClose} accessible={false} importantForAccessibility="no" />
        <View testID={testID} accessibilityViewIsModal style={[styles.dialog, { backgroundColor: colors.surfaceContainerHigh }]}>
          <Text testID={titleTestID} accessibilityRole="header" style={[Type.headlineSmall, { color: colors.onSurface }]}>
            {title}
          </Text>
          {body ? (
            <Text testID={bodyTestID} style={[Type.body, { color: colors.onSurfaceVariant, marginTop: Space.lg }]}>
              {body}
            </Text>
          ) : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

/** The row of a dialog's buttons, at its end. */
export function DialogActions({ children }: { children: ReactNode }) {
  return <View style={styles.dialogActions}>{children}</View>;
}

/** A drawer row's price, right-aligned. */
export function Price({ cents, testID, large = false }: { cents: number; testID?: string; large?: boolean }) {
  const { colors } = useTheme();
  return (
    <Text testID={testID} style={[large ? Type.titleLarge : Type.title, { color: colors.onSurface }]}>
      {formatPrice(cents)}
    </Text>
  );
}

/** A screen's ground: the card-stock surface. */
export function Screen({ testID, children, style }: { testID?: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={[{ flex: 1, backgroundColor: colors.surface }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { textAlign: 'center' },
  labelHolder: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: Radius.xs, paddingHorizontal: 10, paddingVertical: 6 },
  topBar: {},
  topBarRow: { height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Space.xs },
  topBarTitle: { flex: 1, marginLeft: Space.xs },
  iconButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  button: {
    minHeight: 48,
    borderRadius: Radius.full,
    paddingHorizontal: Space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
  },
  textButton: { paddingHorizontal: Space.md },
  stateMessage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Space.xxl },
  field: { minHeight: 56, borderRadius: Radius.xs, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, minHeight: 52, paddingHorizontal: Space.lg, paddingVertical: Space.md },
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Space.xl },
  dialog: { width: '100%', maxWidth: 400, borderRadius: Radius.xl, padding: Space.xl },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Space.xl, gap: Space.sm },
});
