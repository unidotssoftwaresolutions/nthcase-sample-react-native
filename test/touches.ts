/*
 * Plays touches into React Native's responder props, the way the platform does, so a PanResponder computes its real
 * gesture state (dx, dy, number of fingers) from a touch history. Only the fields PanResponder and TouchHistoryMath
 * read are filled in.
 */
import { fireEvent } from '@testing-library/react-native';

type Finger = { x: number; y: number };
type Record = {
  touchActive: boolean;
  startPageX: number;
  startPageY: number;
  startTimeStamp: number;
  currentPageX: number;
  currentPageY: number;
  currentTimeStamp: number;
  previousPageX: number;
  previousPageY: number;
  previousTimeStamp: number;
};

export class Touches {
  private bank: Record[] = [];
  private time = 1000;

  constructor(private readonly element: Parameters<typeof fireEvent>[0]) {}

  private history() {
    const active = this.bank.filter((r) => r.touchActive);
    return {
      touchBank: this.bank,
      numberActiveTouches: active.length,
      indexOfSingleActiveTouch: active.length === 1 ? this.bank.indexOf(active[0]) : -1,
      mostRecentTimeStamp: this.time,
    };
  }

  private event() {
    const touches = this.bank
      .map((r, identifier) => ({ r, identifier }))
      .filter(({ r }) => r.touchActive)
      .map(({ r, identifier }) => ({ identifier, pageX: r.currentPageX, pageY: r.currentPageY, locationX: r.currentPageX, locationY: r.currentPageY }));
    const first = touches[0] ?? { pageX: 0, pageY: 0, locationX: 0, locationY: 0 };
    return {
      touchHistory: this.history(),
      nativeEvent: { touches, changedTouches: touches, pageX: first.pageX, pageY: first.pageY, locationX: first.locationX, locationY: first.locationY, timestamp: this.time },
      persist: () => {},
    };
  }

  /** Fingers come down at these points (the first call grants the responder). */
  async down(...fingers: Finger[]) {
    this.time += 16;
    const granting = this.bank.length === 0;
    for (const f of fingers) {
      this.bank.push({
        touchActive: true,
        startPageX: f.x, startPageY: f.y, startTimeStamp: this.time,
        currentPageX: f.x, currentPageY: f.y, currentTimeStamp: this.time,
        previousPageX: f.x, previousPageY: f.y, previousTimeStamp: this.time,
      });
    }
    await fireEvent(this.element, granting ? 'responderGrant' : 'responderStart', this.event());
  }

  /** The fingers that are down move to these points, in the order they came down. */
  async move(...fingers: Finger[]) {
    this.time += 16;
    this.bank.filter((r) => r.touchActive).forEach((r, i) => {
      const f = fingers[i];
      if (!f) return;
      r.previousPageX = r.currentPageX;
      r.previousPageY = r.currentPageY;
      r.previousTimeStamp = r.currentTimeStamp;
      r.currentPageX = f.x;
      r.currentPageY = f.y;
      r.currentTimeStamp = this.time;
    });
    await fireEvent(this.element, 'responderMove', this.event());
  }

  /** Every finger lifts. */
  async up() {
    this.time += 16;
    this.bank.forEach((r) => {
      r.touchActive = false;
      r.currentTimeStamp = this.time;
    });
    await fireEvent(this.element, 'responderRelease', this.event());
    this.bank = [];
  }

  /** One finger from `from` to `to`, in a few steps. */
  async drag(from: Finger, to: Finger, steps = 4) {
    await this.down(from);
    for (let i = 1; i <= steps; i++) {
      await this.move({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
    }
    await this.up();
  }
}
