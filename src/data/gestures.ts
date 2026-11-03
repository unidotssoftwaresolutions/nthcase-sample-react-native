/** The status words of the gestures screen. They are the spec's oracle: the same words on every framework. */
export const GestureWords = {
  READY: 'Ready',
  TAPPED: 'Tapped',
  DOUBLE_TAPPED: 'Double-tapped',
  LONG_PRESSED: 'Long-pressed',
  swiped: (direction: SwipeDirection) => `Swiped ${direction}`,
  DROPPED: 'Dropped on the drawer',
  DROP_MISSED: 'Dropped outside the drawer',
  PINCHED_OUT: 'Pinched out',
  PINCHED_IN: 'Pinched in',
  ROTATED_CW: 'Rotated clockwise',
  ROTATED_CCW: 'Rotated counter-clockwise',
  SCROLLED_TO: 'Found the bottom drawer',
  SHAKEN: 'Shaken',
} as const;

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

/** A swipe must travel this far (dp) on its longest axis. */
export const SWIPE_MIN_DP = 48;
/** Two taps closer than this (ms) are a double tap. */
export const DOUBLE_TAP_MS = 300;
/** A press at least this long (ms) is a long press. */
export const LONG_PRESS_MS = 500;

/** A swipe's direction, from its total travel; null when it travelled less than [minDp]. The longest axis wins. */
export function swipeDirection(dx: number, dy: number, minDp: number = SWIPE_MIN_DP): SwipeDirection | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < minDp) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

/** "Zoom 1.0×". */
export function zoomText(zoom: number): string {
  return `Zoom ${zoom.toFixed(1)}×`;
}

/** "Rotation 0°". */
export function rotationText(degrees: number): string {
  return `Rotation ${Math.round(degrees)}°`;
}

export type Point = { x: number; y: number };

/**
 * Follows a two-finger gesture from first touch to last lift. Each frame with two fingers down multiplies the zoom by
 * the change in their distance, and adds the change in their angle (degrees, clockwise positive, as the screen's y
 * axis points down). The pads report the totals once, when every finger has lifted.
 */
export class TwoFingerTracker {
  zoom = 1;
  rotation = 0;
  private last: { distance: number; angle: number } | null = null;

  /** One frame: the positions of the fingers now down. */
  move(fingers: readonly Point[]) {
    if (fingers.length < 2) {
      this.last = null;
      return;
    }
    const [a, b] = fingers;
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    if (this.last && this.last.distance > 0 && distance > 0) {
      this.zoom *= distance / this.last.distance;
      let delta = angle - this.last.angle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      this.rotation += delta;
    }
    this.last = { distance, angle };
  }
}

/** The pinch pad's rule: a change over 5 % is a pinch; the pad's zoom stays within 0.5–3. */
export function pinchResult(current: number, change: number): { zoom: number; word: string } | null {
  if (change <= 1.05 && change >= 0.95) return null;
  return {
    zoom: Math.min(3, Math.max(0.5, current * change)),
    word: change > 1 ? GestureWords.PINCHED_OUT : GestureWords.PINCHED_IN,
  };
}

/** The rotate pad's rule: a turn over 10° counts. */
export function rotateResult(current: number, change: number): { rotation: number; word: string } | null {
  if (Math.abs(change) <= 10) return null;
  return {
    rotation: (current + change) % 360,
    word: change > 0 ? GestureWords.ROTATED_CW : GestureWords.ROTATED_CCW,
  };
}

/**
 * A shake is three jolts above 2.5 g within one second. Pure, so the tests can feed it readings; the gestures screen
 * feeds it the accelerometer (expo-sensors reports in g).
 */
export class ShakeDetector {
  static readonly THRESHOLD_G = 2.5;
  static readonly WINDOW_MS = 1000;
  static readonly JOLTS = 3;
  private jolts: number[] = [];

  constructor(private readonly onShake: () => void) {}

  onReading(x: number, y: number, z: number, timestampMs: number) {
    const g = Math.sqrt(x * x + y * y + z * z);
    if (g < ShakeDetector.THRESHOLD_G) return;
    this.jolts.push(timestampMs);
    this.jolts = this.jolts.filter((t) => timestampMs - t <= ShakeDetector.WINDOW_MS);
    if (this.jolts.length >= ShakeDetector.JOLTS) {
      this.jolts = [];
      this.onShake();
    }
  }
}
