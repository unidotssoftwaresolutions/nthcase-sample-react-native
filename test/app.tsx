import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { actions } from '../src/data/store';

/** A cold start: signed out, empty cart, no orders, Settings at their defaults, the app at [initialUrl]. */
export async function launch(initialUrl = '/') {
  actions.reset();
  return renderRouter('./app', { initialUrl });
}

/** Signs in with the test account, the way scenario 01 does, and (unless a deep link opens over it) waits for the Shop. */
export async function signIn({ waitForShop = true } = {}) {
  await fireEvent.changeText(screen.getByTestId('signin_email'), 'tester@mossgrove.test');
  await fireEvent.changeText(screen.getByTestId('signin_password'), 'Mossgrove123');
  await fireEvent.press(screen.getByTestId('signin_submit'));
  if (waitForShop) await screen.findByTestId('shop_screen');
}

/** Launches and signs in. */
export async function launchSignedIn() {
  const result = await launch();
  await signIn();
  return result;
}

export async function tap(id: string) {
  await fireEvent.press(screen.getByTestId(id));
}
