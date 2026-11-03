import { Accelerometer } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PanResponderGestureState,
} from 'react-native';

import {
  DOUBLE_TAP_MS,
  GestureWords,
  LONG_PRESS_MS,
  pinchResult,
  rotateResult,
  rotationText,
  ShakeDetector,
  swipeDirection,
  TwoFingerTracker,
  zoomText,
  type SwipeDirection,
} from '../data/gestures';
import { itemNumber } from '../data/catalog';
import { TestIds } from '../testIds';
import { Button, Icon, Screen, TopBar } from '../ui/components';
import { ItemNumberStyle, Radius, Space, Type, useTheme } from '../ui/theme';

/**
 * Every pad answers React Native's own touch system (the responder and PanResponder): react-native-gesture-handler
 * is a community package. A pad that follows a drag claims the touch on the way down and locks the screen's scroll
 * until the finger lifts, so the scroll view cannot take the gesture from it.
 */
export function GesturesScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const [status, setStatus] = useState<string>(GestureWords.READY);
  const [taps, setTaps] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [locks, setLocks] = useState(0);
  const lock = (on: boolean) => setLocks((n) => Math.max(0, n + (on ? 1 : -1)));

  useShake(() => setStatus(GestureWords.SHAKEN));

  return (
    <Screen testID={TestIds.GESTURES_SCREEN}>
      <TopBar title="Gestures" onBack={onBack} />
      {/* pinned above the scrolling benches, so the status is on screen after any gesture */}
      <View style={[styles.statusBar, { backgroundColor: colors.secondaryContainer }]}>
        <Text testID={TestIds.GESTURES_STATUS} accessibilityLiveRegion="polite" style={[Type.title, { flex: 1, color: colors.onSecondaryContainer }]}>
          {status}
        </Text>
        <Text testID={TestIds.GESTURES_ORIENTATION} style={[Type.label, { color: colors.onSecondaryContainer }]}>
          {width > height ? 'Landscape' : 'Portrait'}
        </Text>
      </View>
      <ScrollView testID={TestIds.GESTURES_SCROLL} scrollEnabled={locks === 0} contentContainerStyle={styles.column}>
        <View style={styles.row}>
          <TapPad taps={taps} onTap={() => {
            setTaps((n) => n + 1);
            setStatus(GestureWords.TAPPED);
          }} />
          <DoubleTapPad onDoubleTap={() => setStatus(GestureWords.DOUBLE_TAPPED)} />
          <Pad
            id={TestIds.GESTURES_LONG_PRESS}
            title="Long press"
            hint="Hold for a moment"
            onLongPress={() => setStatus(GestureWords.LONG_PRESSED)}
            actions={[{ name: 'longpress', label: 'Long press' }]}
            onAction={() => setStatus(GestureWords.LONG_PRESSED)}
          />
        </View>

        <SwipePad onSwipe={(d) => setStatus(GestureWords.swiped(d))} lock={lock} />

        <DragAndDrop onDrop={(hit) => setStatus(hit ? GestureWords.DROPPED : GestureWords.DROP_MISSED)} lock={lock} />

        <View style={styles.row}>
          <TwoFingerPad
            id={TestIds.GESTURES_PINCH}
            title="Pinch"
            value={zoomText(zoom)}
            valueId={TestIds.GESTURES_ZOOM_VALUE}
            square={{ transform: [{ scale: zoom }] }}
            lock={lock}
            onEnd={(change) => {
              const result = pinchResult(zoom, change.zoom);
              if (result) {
                setZoom(result.zoom);
                setStatus(result.word);
              }
            }}
          />
          <TwoFingerPad
            id={TestIds.GESTURES_ROTATE}
            title="Rotate"
            value={rotationText(rotation)}
            valueId={TestIds.GESTURES_ROTATION_VALUE}
            square={{ transform: [{ rotate: `${rotation}deg` }] }}
            lock={lock}
            onEnd={(change) => {
              const result = rotateResult(rotation, change.rotation);
              if (result) {
                setRotation(result.rotation);
                setStatus(result.word);
              }
            }}
          />
        </View>

        <Text style={[Type.body, { color: colors.onSurfaceVariant }]}>Scroll to the bottom drawer. It is below the shelves.</Text>
        {Array.from({ length: 12 }, (_, shelf) => (
          <View key={shelf} style={[styles.shelf, { backgroundColor: colors.surfaceContainer }]}>
            <Text style={[Type.body, { color: colors.onSurfaceVariant }]}>{`Shelf ${shelf + 1}`}</Text>
          </View>
        ))}
        <Button label="Open the bottom drawer" testID={TestIds.GESTURES_SCROLL_TARGET} onPress={() => setStatus(GestureWords.SCROLLED_TO)} />
      </ScrollView>
    </Screen>
  );
}

type Action = { name: string; label: string };

/** A pad: one accessible, pressable element with its id; its title and hint are its only children. */
function Pad({
  id,
  title,
  hint,
  onPress,
  onLongPress,
  actions,
  onAction,
}: {
  id: string;
  title: string;
  hint: string;
  onPress?: () => void;
  onLongPress?: () => void;
  actions?: Action[];
  onAction?: (name: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={id}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={LONG_PRESS_MS}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityActions={actions}
      onAccessibilityAction={(e) => onAction?.(e.nativeEvent.actionName)}
      style={({ pressed }) => [padStyle(colors), styles.smallPad, pressed && { backgroundColor: colors.surfaceContainer }]}
    >
      <Text style={[Type.titleSmall, { color: colors.onSurface }]}>{title}</Text>
      <Text style={[Type.bodySmall, { color: colors.onSurfaceVariant, marginTop: Space.xs }]}>{hint}</Text>
    </Pressable>
  );
}

/**
 * The tap pad. Its count has an id of its own, so the count cannot sit inside the pressable (on iOS an accessible
 * element hides its children): the pressable fills the pad, and the title and count are drawn over it, untouchable.
 */
function TapPad({ taps, onTap }: { taps: number; onTap: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[padStyle(colors), styles.smallPad]}>
      <Pressable
        testID={TestIds.GESTURES_TAP}
        onPress={onTap}
        accessibilityRole="button"
        accessibilityLabel="Tap"
        style={({ pressed }) => [StyleSheet.absoluteFill, { borderRadius: Radius.md }, pressed && { backgroundColor: colors.surfaceContainer }]}
      />
      <View pointerEvents="none">
        <Text style={[Type.titleSmall, { color: colors.onSurface }]}>Tap</Text>
        <Text testID={TestIds.GESTURES_TAP_COUNT} style={[Type.bodySmall, { color: colors.onSurfaceVariant, marginTop: Space.xs }]}>
          {`Taps: ${taps}`}
        </Text>
      </View>
    </View>
  );
}

/** Two presses closer than 300 ms. A single tap does nothing here. */
function DoubleTapPad({ onDoubleTap }: { onDoubleTap: () => void }) {
  const last = useRef(0);
  return (
    <Pad
      id={TestIds.GESTURES_DOUBLE_TAP}
      title="Double tap"
      hint="Twice, quickly"
      onPress={() => {
        const now = Date.now();
        if (now - last.current <= DOUBLE_TAP_MS) {
          last.current = 0;
          onDoubleTap();
        } else {
          last.current = now;
        }
      }}
      actions={[{ name: 'doubletap', label: 'Double tap' }]}
      onAction={(name) => name === 'doubletap' && onDoubleTap()}
    />
  );
}

/** A responder that claims the touch at once, locks the scroll while held, and reports the gesture when it ends. */
function useDrag(handlers: {
  lock: (on: boolean) => void;
  onGrant?: (e: GestureResponderEvent) => void;
  onStart?: (e: GestureResponderEvent) => void;
  onMove?: (e: GestureResponderEvent, g: PanResponderGestureState) => void;
  onEnd: (g: PanResponderGestureState, cancelled: boolean) => void;
}) {
  const latest = useRef(handlers);
  latest.current = handlers;
  return useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (e) => {
        latest.current.lock(true);
        latest.current.onGrant?.(e);
      },
      onPanResponderStart: (e) => latest.current.onStart?.(e),
      onPanResponderMove: (e, g) => latest.current.onMove?.(e, g),
      onPanResponderRelease: (_e, g) => {
        latest.current.lock(false);
        latest.current.onEnd(g, false);
      },
      onPanResponderTerminate: (_e, g) => {
        latest.current.lock(false);
        latest.current.onEnd(g, true);
      },
    }),
  ).current;
}

const SWIPES: SwipeDirection[] = ['left', 'right', 'up', 'down'];

function SwipePad({ onSwipe, lock }: { onSwipe: (d: SwipeDirection) => void; lock: (on: boolean) => void }) {
  const { colors } = useTheme();
  const responder = useDrag({
    lock,
    onEnd: (g, cancelled) => {
      const direction = cancelled ? null : swipeDirection(g.dx, g.dy);
      if (direction) onSwipe(direction);
    },
  });
  return (
    <View
      testID={TestIds.GESTURES_SWIPE}
      accessible
      accessibilityLabel="Swipe pad"
      accessibilityActions={SWIPES.map((d) => ({ name: `swipe_${d}`, label: `Swipe ${d}` }))}
      onAccessibilityAction={(e) => {
        const d = SWIPES.find((s) => `swipe_${s}` === e.nativeEvent.actionName);
        if (d) onSwipe(d);
      }}
      style={[padStyle(colors), styles.swipePad]}
      {...responder.panHandlers}
    >
      <Text style={[Type.titleSmall, { color: colors.onSurface }]}>Swipe</Text>
      <Text style={[Type.bodySmall, { color: colors.onSurfaceVariant }]}>Left, right, up or down</Text>
    </View>
  );
}

type Box = { x: number; y: number; width: number; height: number };

/** Whether the label, moved by (dx, dy), has its centre inside the drawer. Both boxes are in their row's coordinates. */
export function dropsOnTarget(source: Box, target: Box, dx: number, dy: number): boolean {
  const cx = source.x + source.width / 2 + dx;
  const cy = source.y + source.height / 2 + dy;
  return cx >= target.x && cx <= target.x + target.width && cy >= target.y && cy <= target.y + target.height;
}

function DragAndDrop({ onDrop, lock }: { onDrop: (hit: boolean) => void; lock: (on: boolean) => void }) {
  const { colors } = useTheme();
  const [dropped, setDropped] = useState(false);
  const offset = useRef(new Animated.ValueXY()).current;
  // Where the label and the drawer sit in their shared row, from layout (the drag itself moves the label by a transform).
  const boxes = useRef<{ source: Box | null; target: Box | null }>({ source: null, target: null });

  const drop = (hit: boolean) => {
    if (hit) setDropped(true);
    onDrop(hit);
  };

  const responder = useDrag({
    lock,
    onMove: (_e, g) => offset.setValue({ x: g.dx, y: g.dy }),
    onEnd: (g, cancelled) => {
      offset.setValue({ x: 0, y: 0 });
      if (cancelled) return;
      const { source, target } = boxes.current;
      drop(source !== null && target !== null && dropsOnTarget(source, target, g.dx, g.dy));
    },
  });

  return (
    <View style={{ gap: Space.sm }}>
      <Text style={[Type.titleSmall, { color: colors.onSurface }]}>Drag the label onto the drawer</Text>
      <View style={[styles.row, { alignItems: 'center', gap: Space.xl, zIndex: 1 }]}>
        <Animated.View
          onLayout={(e: LayoutChangeEvent) => (boxes.current.source = e.nativeEvent.layout)}
          testID={TestIds.GESTURES_DRAG_SOURCE}
          accessible
          accessibilityLabel={`Label ${itemNumber(7)}`}
          accessibilityActions={[{ name: 'drop', label: 'Drop on the drawer' }]}
          onAccessibilityAction={(e) => e.nativeEvent.actionName === 'drop' && drop(true)}
          style={[
            styles.dragLabel,
            { backgroundColor: colors.tertiaryContainer, borderColor: colors.tertiary, transform: offset.getTranslateTransform(), zIndex: 2, elevation: 2 },
          ]}
          {...responder.panHandlers}
        >
          <Text style={[ItemNumberStyle, { color: colors.onTertiaryContainer }]}>{itemNumber(7)}</Text>
        </Animated.View>
        <View
          onLayout={(e: LayoutChangeEvent) => (boxes.current.target = e.nativeEvent.layout)}
          testID={TestIds.GESTURES_DROP_TARGET}
          accessible
          accessibilityLabel={dropped ? 'Drawer, labelled' : 'Drawer, no label'}
          style={[styles.dropTarget, { borderColor: colors.outline, backgroundColor: dropped ? colors.primaryContainer : colors.surfaceContainerLow }]}
        >
          {dropped ? <Icon name="check" size={18} color={colors.onPrimaryContainer} /> : null}
          <Text style={[Type.body, { color: dropped ? colors.onPrimaryContainer : colors.onSurface }]}>{dropped ? 'Labelled' : 'Drawer'}</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * A pad that reads a two-finger gesture from first touch to last lift, then reports its total zoom and rotation once.
 * The pad is a plain view with its id, so its value line keeps an id of its own.
 */
function TwoFingerPad({
  id,
  title,
  value,
  valueId,
  square,
  lock,
  onEnd,
}: {
  id: string;
  title: string;
  value: string;
  valueId: string;
  square: { transform: ({ scale: number } | { rotate: string })[] };
  lock: (on: boolean) => void;
  onEnd: (change: { zoom: number; rotation: number }) => void;
}) {
  const { colors } = useTheme();
  const tracker = useRef(new TwoFingerTracker());
  const responder = useDrag({
    lock,
    // every frame, from the first touch on, so the fingers' starting distance and angle are where they came down
    onGrant: (e) => {
      tracker.current = new TwoFingerTracker();
      tracker.current.move(fingers(e));
    },
    onStart: (e) => tracker.current.move(fingers(e)),
    onMove: (e) => tracker.current.move(fingers(e)),
    onEnd: (_g, cancelled) => {
      if (!cancelled) onEnd({ zoom: tracker.current.zoom, rotation: tracker.current.rotation });
    },
  });
  return (
    <View testID={id} style={[padStyle(colors), styles.twoFingerPad]} {...responder.panHandlers}>
      <Text style={[Type.titleSmall, { color: colors.onSurface }]}>{title}</Text>
      <View pointerEvents="none" style={styles.squareHolder}>
        <View style={[styles.square, { backgroundColor: colors.primary }, square]} />
      </View>
      <Text testID={valueId} style={[Type.bodySmall, { color: colors.onSurface }]}>
        {value}
      </Text>
    </View>
  );
}

function fingers(e: GestureResponderEvent) {
  return e.nativeEvent.touches.map((t) => ({ x: t.pageX, y: t.pageY }));
}

/** Listens to the accelerometer while the screen is shown. Readings come in g. */
function useShake(onShake: () => void) {
  const latest = useRef(onShake);
  latest.current = onShake;
  useEffect(() => {
    const detector = new ShakeDetector(() => latest.current());
    Accelerometer.setUpdateInterval(20);
    const subscription = Accelerometer.addListener(({ x, y, z }) => detector.onReading(x, y, z, Date.now()));
    return () => subscription.remove();
  }, []);
}

function padStyle(colors: { surfaceContainerLow: string; outlineVariant: string }) {
  return { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant, borderWidth: 1, borderRadius: Radius.md, padding: Space.md };
}

const styles = StyleSheet.create({
  statusBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Space.lg, paddingVertical: Space.md },
  column: { padding: Space.lg, gap: Space.lg },
  row: { flexDirection: 'row', gap: Space.md },
  smallPad: { flex: 1, height: 104 },
  swipePad: { height: 140, alignItems: 'center', justifyContent: 'center' },
  dragLabel: { width: 120, height: 56, borderRadius: Radius.xs, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dropTarget: { flex: 1, height: 96, borderRadius: Radius.md, borderWidth: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Space.xs },
  twoFingerPad: { flex: 1, height: 160, justifyContent: 'space-between' },
  squareHolder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  square: { width: 48, height: 48, borderRadius: Radius.xs },
  shelf: { height: 56, borderRadius: Radius.md, padding: Space.lg, justifyContent: 'center' },
});
