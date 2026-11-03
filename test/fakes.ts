/** The state of the native-module fakes in test/setup.ts, which the tests read and steer. */
export const notificationFake = {
  granted: false,
  askAnswer: true,
  asked: 0,
  posted: [] as { title: string; body: string }[],
};

type Reading = { x: number; y: number; z: number };
export const accelerometerFake: { listener: ((r: Reading) => void) | null } = { listener: null };
