import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent, type PanResponderGestureState } from 'react-native';

import { useTheme } from './theme';

/** How far, in dp, a finger moves before it is a drag rather than a tap. */
const SLOP = 8;

/**
 * A slider from React Native's core pieces: the Slider component left React Native core for a community package, so
 * this one is drawn here. A tap on the track moves the thumb there, and a sideways drag moves it under the finger, so a
 * drag that starts on the thumb (NthCase's `slide` drags the thumb to a fraction of the track) lands where it ends. To
 * a screen reader and to Appium it is an adjustable element with a value, and increment / decrement step it by one.
 *
 * A swipe up or down that starts on the slider belongs to the page, as on a platform slider: the slider never blocks
 * the scroll view under it, changes nothing until the finger has moved sideways, and only then stops the page
 * scrolling. Otherwise a person, or a scroll NthCase plays, whose finger lands on the slider could not scroll the form.
 */
export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  testID,
  label,
  valueText,
  onDragStateChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  testID?: string;
  label: string;
  valueText: string;
  onDragStateChange?: (dragging: boolean) => void;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const latest = useRef({ width, min, max, step, onChange, onDragStateChange });
  latest.current = { width, min, max, step, onChange, onDragStateChange };

  // Where the finger came down, in the track's own coordinates; a move adds the gesture's travel to it. A gesture
  // becomes a drag once it has gone [SLOP] sideways and further sideways than up or down.
  const startX = useRef(0);
  const dragging = useRef(false);
  const sideways = (g: PanResponderGestureState) => Math.abs(g.dx) > SLOP && Math.abs(g.dx) > Math.abs(g.dy);
  const endDrag = () => {
    if (dragging.current) latest.current.onDragStateChange?.(false);
    dragging.current = false;
  };
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_event, gesture) => sideways(gesture),
      // the scroll view may still take a vertical swipe (Android intercepts it, iOS cancels the touch)
      onShouldBlockNativeResponder: () => false,
      onPanResponderTerminationRequest: () => !dragging.current,
      onPanResponderGrant: (event) => {
        dragging.current = false;
        startX.current = event.nativeEvent.locationX;
      },
      onPanResponderMove: (_event, gesture) => {
        if (!dragging.current) {
          if (!sideways(gesture)) return;
          dragging.current = true;
          latest.current.onDragStateChange?.(true);
        }
        moveTo(startX.current + gesture.dx);
      },
      onPanResponderRelease: (_event, gesture) => {
        // a tap: the thumb goes where the finger was
        if (!dragging.current && Math.abs(gesture.dx) <= SLOP && Math.abs(gesture.dy) <= SLOP) moveTo(startX.current);
        endDrag();
      },
      onPanResponderTerminate: endDrag,
    }),
  ).current;

  function moveTo(x: number) {
    const { width: w, min: lo, max: hi, step: s, onChange: change } = latest.current;
    if (w <= 0) return;
    const fraction = Math.min(1, Math.max(0, x / w));
    change(lo + Math.round((fraction * (hi - lo)) / s) * s);
  }

  const fraction = (value - min) / (max - min);
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: valueText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment') onChange(Math.min(max, value + step));
        if (event.nativeEvent.actionName === 'decrement') onChange(Math.max(min, value - step));
      }}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={styles.touch}
      {...responder.panHandlers}
    >
      <View pointerEvents="none" style={[styles.track, { backgroundColor: colors.secondaryContainer }]}>
        <View style={[styles.fill, { width: `${fraction * 100}%`, backgroundColor: colors.primary }]} />
      </View>
      <View pointerEvents="none" style={[styles.thumb, { left: `${fraction * 100}%`, backgroundColor: colors.primary }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  touch: { height: 48, justifyContent: 'center' },
  track: { height: 16, borderRadius: 8, overflow: 'hidden' },
  fill: { height: '100%' },
  thumb: { position: 'absolute', width: 4, height: 44, marginLeft: -2, borderRadius: 2 },
});
