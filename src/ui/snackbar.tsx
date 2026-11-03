import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TestIds } from '../testIds';
import { Radius, Space, Type, useTheme } from './theme';

/** Snackbars stay 10 s, so a test step after the action still finds them on screen (SPEC.md §5). */
export const SNACKBAR_MS = 10_000;

type Snack = { key: number; message: string; actionLabel?: string; onAction?: () => void };
type Show = (message: string, actionLabel?: string, onAction?: () => void) => void;

const SnackContext = createContext<Show>(() => {});

/** Shows a snackbar from anywhere: a message, and an optional action. A new one replaces the one on screen. */
export function useSnack(): Show {
  return useContext(SnackContext);
}

export function SnackbarProvider({ children, bottomOffset }: { children: ReactNode; bottomOffset: number }) {
  const [snack, setSnack] = useState<Snack | null>(null);
  const next = useRef(0);
  const show = useCallback<Show>((message, actionLabel, onAction) => {
    next.current += 1;
    setSnack({ key: next.current, message, actionLabel, onAction });
  }, []);

  useEffect(() => {
    if (!snack) return;
    const timer = setTimeout(() => setSnack((s) => (s?.key === snack.key ? null : s)), SNACKBAR_MS);
    return () => clearTimeout(timer);
  }, [snack]);

  const value = useMemo(() => show, [show]);
  return (
    <SnackContext.Provider value={value}>
      {children}
      {snack ? (
        <SnackbarView
          snack={snack}
          bottomOffset={bottomOffset}
          onAction={() => {
            setSnack(null);
            snack.onAction?.();
          }}
        />
      ) : null}
    </SnackContext.Provider>
  );
}

/**
 * Material's snackbar: inverse surface, the message, and a text action. The container is a plain view, so the text
 * and the action keep their own ids (snackbar_text, snackbar_action).
 */
function SnackbarView({ snack, bottomOffset, onAction }: { snack: Snack; bottomOffset: number; onAction: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: bottomOffset + insets.bottom + Space.md }]}>
      <View testID={TestIds.SNACKBAR} style={[styles.snackbar, { backgroundColor: colors.inverseSurface }]}>
        <Text
          testID={TestIds.SNACKBAR_TEXT}
          accessibilityLiveRegion="polite"
          style={[Type.body, styles.message, { color: colors.inverseOnSurface }]}
        >
          {snack.message}
        </Text>
        {snack.actionLabel ? (
          <Pressable testID={TestIds.SNACKBAR_ACTION} onPress={onAction} accessibilityRole="button" style={styles.action}>
            <Text style={[Type.label, { color: colors.inversePrimary }]}>{snack.actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: Space.md, right: Space.md },
  snackbar: {
    minHeight: 48,
    borderRadius: Radius.xs,
    paddingLeft: Space.lg,
    paddingRight: Space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 6,
  },
  message: { flex: 1, paddingVertical: 14 },
  action: { minHeight: 48, paddingHorizontal: Space.md, justifyContent: 'center' },
});
