/*
 * The scenarios' flows (nthcase/scenarios/01–10, and 11's deep link), played on the whole app with its real router,
 * screens and state. Queries see what a person sees: screens behind the one in front are hidden from them. Steps a
 * test runner cannot play (rotating, locking, Home, a system prompt) are left to the device; their app-side half is
 * here. The preset's fake timers stand in for the 3 s loads, the 0.8 s refresh and the 10 s snackbar.
 */
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Dimensions } from 'react-native';

import { redirectSystemPath } from '../app/+native-intent';
import { actions, getState } from '../src/data/store';
import { TestIds } from '../src/testIds';
import { DARK, LIGHT } from '../src/ui/theme';
import { launch, launchSignedIn, signIn, tap } from '../test/app';
import { accelerometerFake, notificationFake } from '../test/fakes';
import { Touches } from '../test/touches';

const byId = (id: string) => screen.getByTestId(id);
const type = (id: string, text: string) => fireEvent.changeText(byId(id), text);
const wait = (ms: number) => act(() => jest.advanceTimersByTime(ms));
/** The element's text contains [text] (React Native Testing Library matches the whole text by default). */
const shows = (id: string, text: string) => expect(byId(id)).toHaveTextContent(text, { exact: false });
/** One accelerometer reading, in g, to the screen that listens. */
const shakeReading = (r: { x: number; y: number; z: number }) => act(() => accelerometerFake.listener?.(r));

describe('01 · sign in with the test account', () => {
  it('refuses a wrong password, shows it, then signs in', async () => {
    await launch();
    expect(screen.getByText('Mossgrove')).toBeTruthy();
    expect(screen.getByText('Home and desk goods')).toBeTruthy();
    await type(TestIds.SIGNIN_EMAIL, 'tester@mossgrove.test');
    await type(TestIds.SIGNIN_PASSWORD, 'letmein1');
    await tap(TestIds.SIGNIN_SUBMIT);
    expect(byId(TestIds.SIGNIN_ERROR)).toHaveTextContent('Wrong email or password');
    expect(byId(TestIds.SIGNIN_PASSWORD).props.secureTextEntry).toBe(true);
    expect(screen.getByLabelText('Show password')).toBeTruthy();
    await tap(TestIds.SIGNIN_PASSWORD_TOGGLE);
    expect(byId(TestIds.SIGNIN_PASSWORD).props.secureTextEntry).toBe(false);
    expect(byId(TestIds.SIGNIN_PASSWORD).props.value).toBe('letmein1');
    expect(screen.getByLabelText('Hide password')).toBeTruthy();
    await type(TestIds.SIGNIN_PASSWORD, 'Mossgrove123');
    await tap(TestIds.SIGNIN_SUBMIT);
    await screen.findByTestId(TestIds.SHOP_SCREEN);
    expect(screen.getByText('Stoneware Mug')).toBeTruthy();
    expect(byId(TestIds.SHOP_COUNT)).toHaveTextContent('40 drawers · No. 001–040');
  });

  it('asks for both fields, and fills them from the printed test account', async () => {
    await launch();
    await tap(TestIds.SIGNIN_SUBMIT);
    expect(byId(TestIds.SIGNIN_ERROR)).toHaveTextContent('Enter your email and password');
    expect(screen.getByText('Test account')).toBeTruthy();
    await tap(TestIds.SIGNIN_USE_TEST_ACCOUNT);
    expect(byId(TestIds.SIGNIN_EMAIL).props.value).toBe('tester@mossgrove.test');
    expect(byId(TestIds.SIGNIN_PASSWORD).props.value).toBe('Mossgrove123');
    await tap(TestIds.SIGNIN_SUBMIT);
    await screen.findByTestId(TestIds.SHOP_SCREEN);
    expect(getState().signedInEmail).toBe('tester@mossgrove.test');
  });
});

describe('02 · search, scroll and refresh the shop', () => {
  it('narrows by name and number, empties, and says the catalogue is up to date', async () => {
    await launchSignedIn();
    await type(TestIds.SHOP_SEARCH, 'lamp');
    expect(byId(TestIds.SHOP_COUNT)).toHaveTextContent('4 of 40 drawers');
    expect(screen.getByText('Floor Lamp')).toBeTruthy();
    await tap(TestIds.SHOP_SEARCH_CLEAR);
    shows(TestIds.SHOP_COUNT, '40 drawers');
    await type(TestIds.SHOP_SEARCH, 'velvet');
    expect(screen.getByText('No drawers match "velvet"')).toBeTruthy();
    expect(screen.getByText('Clear search')).toBeTruthy();
    await tap(TestIds.SHOP_EMPTY_ACTION);
    expect(screen.getByText('Fruit Bowl')).toBeTruthy();
    expect(screen.getByText('No. 040')).toBeTruthy();

    // pull to refresh: the list's RefreshControl
    const list = byId(TestIds.SHOP_LIST);
    const refreshControl = list.props.refreshControl as { props: { onRefresh: () => void } };
    await act(() => refreshControl.props.onRefresh());
    await wait(800);
    expect(byId(TestIds.SNACKBAR_TEXT)).toHaveTextContent('Catalogue is up to date');

    await type(TestIds.SHOP_SEARCH, '7');
    expect(byId(TestIds.SHOP_COUNT)).toHaveTextContent('1 of 40 drawers');
    expect(within(list).getAllByRole('button').map((b) => b.props.testID)).toEqual(['shop_item_7']);
    expect(screen.getByText('Wall Clock')).toBeTruthy();
  });
});

describe('03 · fill the cart and place an order', () => {
  it('steps, adds, removes, confirms in the modal, and lists the order', async () => {
    await launchSignedIn();
    await fireEvent.press(screen.getByText('Stoneware Mug'));
    await screen.findByTestId(TestIds.ITEM_SCREEN);
    expect(byId(TestIds.ITEM_NUMBER)).toHaveTextContent('No. 001');
    expect(byId(TestIds.ITEM_PRICE)).toHaveTextContent('$14.00');
    expect(byId(TestIds.ITEM_QTY_DECREASE)).toBeDisabled();
    await tap(TestIds.ITEM_QTY_INCREASE);
    expect(byId(TestIds.ITEM_QTY_VALUE)).toHaveTextContent('2');
    expect(byId(TestIds.ITEM_ADD_TO_CART)).toHaveTextContent('Add to cart · $28.00');
    await tap(TestIds.ITEM_ADD_TO_CART);
    expect(byId(TestIds.SNACKBAR_TEXT)).toHaveTextContent('Added to cart');
    expect(byId(TestIds.SNACKBAR_ACTION)).toHaveTextContent('View cart');
    await tap(TestIds.SNACKBAR_ACTION);
    await screen.findByTestId(TestIds.CART_TOTAL);
    expect(byId(TestIds.CART_TOTAL)).toHaveTextContent('$28.00');
    expect(screen.getByLabelText('Cart, 2 items')).toBeTruthy();

    await tap(TestIds.NAV_SHOP);
    await fireEvent.press(screen.getByText('Brass Desk Lamp'));
    await tap(TestIds.ITEM_ADD_TO_CART);
    await tap(TestIds.TOP_BAR_BACK);
    await tap(TestIds.NAV_CART);
    expect(byId(TestIds.CART_TOTAL)).toHaveTextContent('$70.00');

    await tap('cart_line_remove_1');
    expect(screen.queryByText('Stoneware Mug')).toBeNull();
    expect(byId(TestIds.CART_TOTAL)).toHaveTextContent('$42.00');
    const orderTotal = String(byId(TestIds.CART_TOTAL).props.children);

    await tap(TestIds.CART_CHECKOUT);
    expect(byId(TestIds.DIALOG_TITLE)).toHaveTextContent('Place this order?');
    expect(byId(TestIds.DIALOG_TEXT)).toHaveTextContent('1 item · $42.00. This is a sample shop: nothing is charged or shipped.');
    await tap(TestIds.DIALOG_DISMISS);
    expect(screen.queryByTestId(TestIds.DIALOG)).toBeNull();
    expect(screen.getByText('Brass Desk Lamp')).toBeTruthy();

    await tap(TestIds.CART_CHECKOUT);
    await tap(TestIds.DIALOG_CONFIRM);
    expect(byId(TestIds.SNACKBAR_TEXT)).toHaveTextContent('Order 1 placed');
    expect(screen.getByText('Your cart is empty')).toBeTruthy();
    await tap(TestIds.SNACKBAR_ACTION);
    await screen.findByTestId('orders_row_1');
    shows('orders_row_1', 'Order 1');
    shows('orders_row_1', orderTotal);
    shows('orders_row_1', '1 item · Brass Desk Lamp');
  });

  it('caps a line at 9, and keeps a snackbar for 10 seconds', async () => {
    await launchSignedIn();
    await tap('shop_item_29');
    for (let i = 0; i < 12; i++) if (!byId(TestIds.ITEM_QTY_INCREASE).props.accessibilityState?.disabled) await tap(TestIds.ITEM_QTY_INCREASE);
    expect(byId(TestIds.ITEM_QTY_VALUE)).toHaveTextContent('9');
    expect(byId(TestIds.ITEM_QTY_INCREASE)).toBeDisabled();
    await tap(TestIds.ITEM_ADD_TO_CART);
    await tap(TestIds.ITEM_ADD_TO_CART);
    expect(getState().cart).toEqual([{ itemId: 29, quantity: 9 }]);
    await wait(9_900);
    expect(screen.queryByTestId(TestIds.SNACKBAR)).not.toBeNull();
    await wait(200);
    expect(screen.queryByTestId(TestIds.SNACKBAR)).toBeNull();
  });
});

describe('04 · join the club: every form control', () => {
  it('shows every error, follows edits, and joins', async () => {
    await launchSignedIn();
    await tap(TestIds.NAV_LAB);
    await fireEvent.press(screen.getByText('Join the club'));
    await screen.findByTestId(TestIds.FORM_SCREEN);
    await tap(TestIds.FORM_SUBMIT);
    for (const text of ['Enter your name', 'Enter a valid email address', 'Enter an age from 18 to 120', 'Use at least 8 characters, including a number', 'Choose a favourite aisle', 'Choose a delivery date', 'Accept the terms to continue']) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    await type(TestIds.FORM_NAME, 'Sam Rivera');
    expect(screen.queryByText('Enter your name')).toBeNull();
    await type(TestIds.FORM_EMAIL, 'sam@example');
    expect(screen.getByText('Enter a valid email address')).toBeTruthy();
    await type(TestIds.FORM_EMAIL, 'sam@example.test');
    expect(screen.queryByText('Enter a valid email address')).toBeNull();
    await type(TestIds.FORM_AGE, '34x');
    expect(byId(TestIds.FORM_AGE).props.value).toBe('34');
    await type(TestIds.FORM_PASSWORD, 'garden42x');
    await tap(TestIds.FORM_PASSWORD_TOGGLE);
    expect(byId(TestIds.FORM_PASSWORD).props.value).toBe('garden42x');
    expect(byId(TestIds.FORM_PASSWORD).props.secureTextEntry).toBe(false);

    await tap(TestIds.FORM_CATEGORY);
    await tap('form_category_option_garden');
    shows(TestIds.FORM_CATEGORY, 'Garden');

    await tap(TestIds.FORM_DATE);
    expect(byId(TestIds.FORM_DATE_CONFIRM)).toBeDisabled();
    await fireEvent.press(within(byId(TestIds.FORM_DATE_PICKER)).getByText('15'));
    await tap(TestIds.FORM_DATE_CONFIRM);
    const now = new Date();
    const expected = `15 ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][now.getMonth()]} ${now.getFullYear()}`;
    expect(screen.getByText(expected)).toBeTruthy();

    await fireEvent(byId(TestIds.FORM_NEWSLETTER), 'valueChange', true);
    expect(byId(TestIds.FORM_NEWSLETTER).props.value).toBe(true);

    // drag the slider's thumb from the start to 60 % of its track
    const slider = byId(TestIds.FORM_BUDGET);
    await fireEvent(slider, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 48 } } });
    await new Touches(slider).drag({ x: 0, y: 24 }, { x: 180, y: 24 });
    expect(byId(TestIds.FORM_BUDGET_VALUE)).toHaveTextContent('$120');
    expect(slider.props.accessibilityValue).toMatchObject({ min: 0, max: 200, now: 120, text: '$120' });

    await tap(TestIds.FORM_TERMS);
    expect(byId(TestIds.FORM_TERMS).props.accessibilityState).toMatchObject({ checked: true });
    await tap(TestIds.FORM_SUBMIT);
    expect(byId(TestIds.FORM_RESULT).props.accessibilityLabel).toBe(
      `Welcome, Sam Rivera. We'll write to sam@example.test about the Garden aisle and deliver on ${expected}.`,
    );
    expect(byId(TestIds.SNACKBAR_TEXT)).toHaveTextContent('Welcome to the club');
  });

  it('steps the slider by $10 from a screen reader, and cancels the date picker', async () => {
    await launchSignedIn();
    await tap(TestIds.NAV_LAB);
    await tap(TestIds.LAB_FORM);
    const slider = await screen.findByTestId(TestIds.FORM_BUDGET);
    expect(byId(TestIds.FORM_BUDGET_VALUE)).toHaveTextContent('$50');
    for (let i = 0; i < 7; i++) await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(byId(TestIds.FORM_BUDGET_VALUE)).toHaveTextContent('$120');
    await tap(TestIds.FORM_DATE);
    await tap(TestIds.FORM_DATE_CANCEL);
    expect(screen.queryByTestId(TestIds.FORM_DATE_PICKER)).toBeNull();
  });
});

describe('05 · every gesture on the Gestures screen', () => {
  it('names each gesture in the status line', async () => {
    await launchSignedIn();
    await tap(TestIds.NAV_LAB);
    await fireEvent.press(screen.getByText('Gestures'));
    await screen.findByTestId(TestIds.GESTURES_SCREEN);
    const status = () => byId(TestIds.GESTURES_STATUS);
    expect(status()).toHaveTextContent('Ready');

    await tap(TestIds.GESTURES_TAP);
    expect(status()).toHaveTextContent('Tapped');
    expect(byId(TestIds.GESTURES_TAP_COUNT)).toHaveTextContent('Taps: 1');

    await tap(TestIds.GESTURES_DOUBLE_TAP);
    expect(status()).toHaveTextContent('Tapped');
    await tap(TestIds.GESTURES_DOUBLE_TAP);
    expect(status()).toHaveTextContent('Double-tapped');

    await fireEvent(byId(TestIds.GESTURES_LONG_PRESS), 'longPress');
    expect(status()).toHaveTextContent('Long-pressed');

    const swipe = new Touches(byId(TestIds.GESTURES_SWIPE));
    await swipe.drag({ x: 200, y: 70 }, { x: 60, y: 80 });
    expect(status()).toHaveTextContent('Swiped left');
    await swipe.drag({ x: 60, y: 70 }, { x: 200, y: 60 });
    expect(status()).toHaveTextContent('Swiped right');
    await swipe.drag({ x: 150, y: 120 }, { x: 160, y: 20 });
    expect(status()).toHaveTextContent('Swiped up');
    await swipe.drag({ x: 150, y: 20 }, { x: 140, y: 120 });
    expect(status()).toHaveTextContent('Swiped down');
    await swipe.drag({ x: 150, y: 70 }, { x: 180, y: 90 });
    expect(status()).toHaveTextContent('Swiped down');

    // the label sits at the row's start; the drawer 144 dp to its right
    const source = byId(TestIds.GESTURES_DRAG_SOURCE);
    await fireEvent(source, 'layout', { nativeEvent: { layout: { x: 0, y: 20, width: 120, height: 56 } } });
    await fireEvent(byId(TestIds.GESTURES_DROP_TARGET), 'layout', { nativeEvent: { layout: { x: 144, y: 0, width: 200, height: 96 } } });
    await new Touches(source).drag({ x: 60, y: 48 }, { x: 60, y: 300 });
    expect(status()).toHaveTextContent('Dropped outside the drawer');
    await new Touches(source).drag({ x: 60, y: 48 }, { x: 240, y: 50 });
    expect(status()).toHaveTextContent('Dropped on the drawer');
    expect(screen.getByLabelText('Drawer, labelled')).toBeTruthy();

    const pinch = new Touches(byId(TestIds.GESTURES_PINCH));
    await pinch.down({ x: 100, y: 80 }, { x: 140, y: 80 });
    await pinch.move({ x: 80, y: 80 }, { x: 160, y: 80 });
    await pinch.move({ x: 60, y: 80 }, { x: 180, y: 80 });
    await pinch.up();
    expect(status()).toHaveTextContent('Pinched out');
    expect(byId(TestIds.GESTURES_ZOOM_VALUE)).toHaveTextContent('Zoom 3.0×');
    await pinch.down({ x: 60, y: 80 }, { x: 180, y: 80 });
    await pinch.move({ x: 90, y: 80 }, { x: 150, y: 80 });
    await pinch.up();
    expect(status()).toHaveTextContent('Pinched in');
    expect(byId(TestIds.GESTURES_ZOOM_VALUE)).toHaveTextContent('Zoom 1.5×');

    const rotate = new Touches(byId(TestIds.GESTURES_ROTATE));
    const at = (deg: number) => ({ x: 100 + 50 * Math.cos((deg * Math.PI) / 180), y: 80 + 50 * Math.sin((deg * Math.PI) / 180) });
    await rotate.down({ x: 100, y: 80 }, at(0));
    await rotate.move({ x: 100, y: 80 }, at(15));
    await rotate.move({ x: 100, y: 80 }, at(30));
    await rotate.up();
    expect(status()).toHaveTextContent('Rotated clockwise');
    expect(byId(TestIds.GESTURES_ROTATION_VALUE)).toHaveTextContent('Rotation 30°');

    await tap(TestIds.GESTURES_SCROLL_TARGET);
    expect(status()).toHaveTextContent('Found the bottom drawer');

    for (let jolt = 0; jolt < 3; jolt++) {
      jest.setSystemTime(Date.now() + 200);
      await shakeReading({ x: 2.8, y: 0.5, z: 0.3 });
    }
    expect(status()).toHaveTextContent('Shaken');
  });

  it('locks the scroll while a pad holds the finger, and offers its gesture to a screen reader', async () => {
    await launchSignedIn();
    await tap(TestIds.NAV_LAB);
    await tap(TestIds.LAB_GESTURES);
    await screen.findByTestId(TestIds.GESTURES_SCREEN);
    const touches = new Touches(byId(TestIds.GESTURES_SWIPE));
    await touches.down({ x: 100, y: 70 });
    expect(byId(TestIds.GESTURES_SCROLL).props.scrollEnabled).toBe(false);
    await touches.up();
    expect(byId(TestIds.GESTURES_SCROLL).props.scrollEnabled).toBe(true);

    await fireEvent(byId(TestIds.GESTURES_SWIPE), 'accessibilityAction', { nativeEvent: { actionName: 'swipe_up' } });
    expect(byId(TestIds.GESTURES_STATUS)).toHaveTextContent('Swiped up');
    await fireEvent(byId(TestIds.GESTURES_DOUBLE_TAP), 'accessibilityAction', { nativeEvent: { actionName: 'doubletap' } });
    expect(byId(TestIds.GESTURES_STATUS)).toHaveTextContent('Double-tapped');
    await fireEvent(byId(TestIds.GESTURES_DRAG_SOURCE), 'accessibilityAction', { nativeEvent: { actionName: 'drop' } });
    expect(byId(TestIds.GESTURES_STATUS)).toHaveTextContent('Dropped on the drawer');
  });
});

describe('06 · the device', () => {
  afterEach(() => Dimensions.set({ window: { width: 750, height: 1334, scale: 2, fontScale: 2 } }));

  it('says the orientation, keeps the cart, and goes back to the Lab', async () => {
    await launchSignedIn();
    await fireEvent.press(screen.getByText('Stoneware Mug'));
    await tap(TestIds.ITEM_ADD_TO_CART);
    await tap(TestIds.TOP_BAR_BACK);
    await tap(TestIds.NAV_LAB);
    await tap(TestIds.LAB_GESTURES);
    await screen.findByTestId(TestIds.GESTURES_SCREEN);
    expect(byId(TestIds.GESTURES_ORIENTATION)).toHaveTextContent('Portrait');
    await act(() => Dimensions.set({ window: { width: 1334, height: 750, scale: 2, fontScale: 2 } }));
    expect(byId(TestIds.GESTURES_ORIENTATION)).toHaveTextContent('Landscape');
    await act(() => Dimensions.set({ window: { width: 750, height: 1334, scale: 2, fontScale: 2 } }));
    expect(byId(TestIds.GESTURES_ORIENTATION)).toHaveTextContent('Portrait');
    await act(() => router.back());
    expect(await screen.findByText('Join the club')).toBeTruthy();
    await tap(TestIds.NAV_CART);
    expect(screen.getByText('Stoneware Mug')).toBeTruthy();
  });
});

describe('07 · the care guide', () => {
  it('loads the bundled page and refuses to leave it', async () => {
    await launchSignedIn();
    await tap(TestIds.NAV_LAB);
    await fireEvent.press(screen.getByText('Care guide'));
    await screen.findByTestId(TestIds.WEBVIEW);
    await waitFor(() => expect(byId(TestIds.WEBVIEW_STATUS)).toHaveTextContent('Care guide loaded'));
    const web = byId(TestIds.WEBVIEW);
    expect((web.props.source as { html: string }).html).toBe(readFileSync(join(__dirname, '../assets/web/care-guide.html'), 'utf8'));
    expect(web.props.webviewDebuggingEnabled).toBe(true);
    const decide = web.props.onShouldStartLoadWithRequest as (r: { url: string }) => boolean;
    expect(decide({ url: 'about:blank#web_washing' })).toBe(true);
    expect(decide({ url: 'https://example.test/' })).toBe(false);
  });
});

describe('08 · a slow screen, an error with retry, and empty states', () => {
  it('waits 3 s, fails once, retries, and loads slowly', async () => {
    await launchSignedIn();
    await tap(TestIds.NAV_LAB);
    await fireEvent.press(screen.getByText('Delivery slots'));
    expect(await screen.findByText('Finding delivery slots…')).toBeTruthy();
    await wait(2900);
    expect(screen.queryByText('Monday · 8:00–10:00')).toBeNull();
    await wait(100);
    expect(screen.getByText('Monday · 8:00–10:00')).toBeTruthy();
    expect(screen.getByText('Saturday · 10:00–12:00')).toBeTruthy();
    await tap(TestIds.SLOW_RELOAD);
    expect(screen.getByText('Finding delivery slots…')).toBeTruthy();
    await wait(3000);
    expect(screen.getByText('Choose when we bring your order.')).toBeTruthy();

    await tap(TestIds.TOP_BAR_BACK);
    await fireEvent.press(screen.getByText('Orders'));
    expect(await screen.findByText('No orders yet')).toBeTruthy();
    await tap(TestIds.TOP_BAR_BACK);

    await tap(TestIds.NAV_SETTINGS);
    await fireEvent(byId(TestIds.SETTINGS_FAIL_LOADING), 'valueChange', true);
    await tap(TestIds.NAV_LAB);
    await fireEvent.press(screen.getByText('Orders'));
    expect(await screen.findByText("Orders didn't load")).toBeTruthy();
    await tap(TestIds.ORDERS_RETRY);
    expect(screen.getByText('No orders yet')).toBeTruthy();
    await tap(TestIds.TOP_BAR_BACK);

    await tap(TestIds.NAV_SETTINGS);
    await fireEvent(byId(TestIds.SETTINGS_FAIL_LOADING), 'valueChange', false);
    await fireEvent(byId(TestIds.SETTINGS_SLOW_LOADING), 'valueChange', true);
    await tap(TestIds.NAV_SHOP);
    expect(screen.getByText('Opening the drawers…')).toBeTruthy();
    await wait(3000);
    expect(screen.getByText('Stoneware Mug')).toBeTruthy();
    await tap(TestIds.NAV_CART);
    expect(screen.getByText('Your cart is empty')).toBeTruthy();
  });

  it('fails the shop’s first load on each visit, and Start shopping opens the Shop', async () => {
    await launchSignedIn();
    await act(() => actions.setFailFirstLoad(true));
    await tap(TestIds.NAV_LAB);
    await tap(TestIds.NAV_SHOP);
    expect(screen.getByText("The catalogue didn't load")).toBeTruthy();
    await tap(TestIds.SHOP_RETRY);
    expect(screen.getByText('Stoneware Mug')).toBeTruthy();
    await tap(TestIds.NAV_LAB);
    await tap(TestIds.NAV_SHOP);
    expect(screen.getByText("The catalogue didn't load")).toBeTruthy();
    await act(() => actions.setFailFirstLoad(false));
    await tap(TestIds.NAV_LAB);
    await tap(TestIds.LAB_ORDERS);
    await tap(TestIds.ORDERS_EMPTY_ACTION);
    expect(await screen.findByTestId(TestIds.SHOP_LIST)).toBeTruthy();
  });
});

describe('09 · settings, the notification prompt and a confirm dialog', () => {
  it('asks once, sends a test notification, confirms, and signs out', async () => {
    await launchSignedIn();
    await tap(TestIds.NAV_SETTINGS);
    expect(screen.getByText('tester@mossgrove.test')).toBeTruthy();
    expect(await screen.findByText('Not allowed. Turn this on to be asked.')).toBeTruthy();
    expect(byId(TestIds.SETTINGS_SEND_NOTIFICATION)).toBeDisabled();

    await tap(TestIds.SETTINGS_THEME_DARK);
    expect(byId(TestIds.SETTINGS_THEME_DARK).props.accessibilityState).toMatchObject({ checked: true });
    expect(byId(TestIds.SETTINGS_THEME_SYSTEM).props.accessibilityState).toMatchObject({ checked: false });
    // the whole app at once: this screen's title and the Shop behind it
    expect(byId(TestIds.TOP_BAR_TITLE)).toHaveStyle({ color: DARK.onSurface });
    expect(screen.getByTestId(TestIds.SHOP_SCREEN, { includeHiddenElements: true })).toHaveStyle({ backgroundColor: DARK.surface });
    await tap(TestIds.SETTINGS_THEME_SYSTEM);
    expect(getState().themeMode).toBe('system');
    expect(byId(TestIds.TOP_BAR_TITLE)).toHaveStyle({ color: LIGHT.onSurface });

    await fireEvent(byId(TestIds.SETTINGS_NOTIFICATIONS), 'valueChange', true);
    expect(await screen.findByText("On: we'll tell you when an order is placed.")).toBeTruthy();
    expect(notificationFake.asked).toBe(1);
    expect(byId(TestIds.SETTINGS_NOTIFICATIONS).props.value).toBe(true);
    await tap(TestIds.SETTINGS_SEND_NOTIFICATION);
    expect(byId(TestIds.SNACKBAR_TEXT)).toHaveTextContent('Notification sent');
    await waitFor(() => expect(notificationFake.posted).toEqual([{ title: 'Your order is packed', body: 'A test notification from Mossgrove.' }]));
    await fireEvent(byId(TestIds.SETTINGS_NOTIFICATIONS), 'valueChange', false);
    expect(screen.getByText('Off')).toBeTruthy();

    await tap(TestIds.SETTINGS_RESET);
    expect(screen.getByText('Empty the cart and orders?')).toBeTruthy();
    expect(screen.getByText("You stay signed in. This can't be undone.")).toBeTruthy();
    await tap(TestIds.SETTINGS_RESET_CANCEL);
    expect(screen.queryByText('Empty the cart and orders?')).toBeNull();
    expect(byId(TestIds.SETTINGS_VERSION)).toHaveTextContent('Mossgrove 1.0.0 · spec 1.0 · a sample app for NthCase');

    await tap(TestIds.SETTINGS_SIGN_OUT);
    expect(await screen.findByText('Test account')).toBeTruthy();
    expect(getState()).toMatchObject({ signedInEmail: null, cart: [], orders: [] });
  });

  it('stays off when the prompt is refused, posts "Order <n> placed" when on, and empties on confirm', async () => {
    notificationFake.askAnswer = false;
    await launchSignedIn();
    await tap(TestIds.NAV_SETTINGS);
    await fireEvent(byId(TestIds.SETTINGS_NOTIFICATIONS), 'valueChange', true);
    await waitFor(() => expect(notificationFake.asked).toBe(1));
    expect(screen.getByText('Not allowed. Turn this on to be asked.')).toBeTruthy();
    expect(byId(TestIds.SETTINGS_NOTIFICATIONS).props.value).toBe(false);

    notificationFake.askAnswer = true;
    await fireEvent(byId(TestIds.SETTINGS_NOTIFICATIONS), 'valueChange', true);
    await screen.findByText("On: we'll tell you when an order is placed.");
    await tap(TestIds.NAV_SHOP);
    await tap('shop_item_3');
    await tap(TestIds.ITEM_ADD_TO_CART);
    await tap(TestIds.SNACKBAR_ACTION);
    await tap(TestIds.CART_CHECKOUT);
    await tap(TestIds.DIALOG_CONFIRM);
    await waitFor(() => expect(notificationFake.posted).toEqual([{ title: 'Order 1 placed', body: "We're packing it now." }]));

    await tap(TestIds.NAV_SETTINGS);
    await tap(TestIds.SETTINGS_RESET);
    await tap(TestIds.SETTINGS_RESET_CONFIRM);
    expect(byId(TestIds.SNACKBAR_TEXT)).toHaveTextContent('Cart and orders emptied');
    expect(getState()).toMatchObject({ signedInEmail: 'tester@mossgrove.test', cart: [], orders: [] });
  });
});

describe('10 · gift cards: a screen with no test ids', () => {
  it('is driven by text, label and position', async () => {
    await launchSignedIn();
    await tap(TestIds.NAV_LAB);
    await fireEvent.press(screen.getByText('Gift cards'));
    expect(await screen.findByText('Check a balance')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Card code'), 'moss-0025');
    expect(screen.getByLabelText('Card code').props.value).toBe('MOSS-0025');
    await fireEvent.press(screen.getByText('Check balance'));
    expect(screen.getByText('Balance: $25.00')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Card code'), 'MOSS-9999');
    await fireEvent.press(screen.getByText('Check balance'));
    expect(screen.getByText("We don't recognise that code")).toBeTruthy();
    expect(screen.getByText('Choose a design')).toBeTruthy();
    await fireEvent.press(screen.getByText('$50'));
    const [left, right] = screen.getAllByText('Choose');
    await fireEvent.press(right);
    expect(screen.getByText('A $50 card with the Stone design')).toBeTruthy();
    await fireEvent.press(left);
    expect(screen.getByText('A $50 card with the Fern design')).toBeTruthy();
  });
});

describe('a tab always opens at its first screen (SPEC.md §4)', () => {
  it('never restores a deeper screen, and Back from a tab goes to the Shop', async () => {
    const app = await launchSignedIn();
    await tap('shop_item_5');
    await tap(TestIds.ITEM_ADD_TO_CART);
    await tap(TestIds.SNACKBAR_ACTION);
    await screen.findByTestId(TestIds.CART_TOTAL);
    expect(app.getPathname()).toBe('/cart');
    expect(router.canGoBack()).toBe(true);
    await tap(TestIds.NAV_SHOP);
    expect(app.getPathname()).toBe('/');
    expect(screen.queryByTestId(TestIds.ITEM_SCREEN)).toBeNull();

    await tap(TestIds.NAV_LAB);
    await tap(TestIds.LAB_FORM);
    await screen.findByTestId(TestIds.FORM_SCREEN);
    expect(screen.queryByTestId(TestIds.NAV_LAB)).toBeNull();
    await tap(TestIds.TOP_BAR_BACK);
    await tap(TestIds.NAV_SETTINGS);
    await tap(TestIds.NAV_LAB);
    expect(app.getPathname()).toBe('/lab');
    expect(screen.getByTestId(TestIds.LAB_SCREEN)).toBeTruthy();
    expect(screen.queryByTestId(TestIds.FORM_SCREEN)).toBeNull();

    await act(() => router.back());
    expect(app.getPathname()).toBe('/');
  });

  it('opens Orders above the tabs from Settings, and Back returns to Settings', async () => {
    const app = await launchSignedIn();
    await tap(TestIds.NAV_SETTINGS);
    await tap(TestIds.SETTINGS_ORDERS);
    expect(await screen.findByText('No orders yet')).toBeTruthy();
    expect(screen.queryByTestId(TestIds.NAV_SHOP)).toBeNull();
    await tap(TestIds.TOP_BAR_BACK);
    expect(app.getPathname()).toBe('/settings');
  });
});

describe('11 · the deep link', () => {
  it('asks for sign-in first on a cold start, then opens the item; Back lands on the Shop', async () => {
    actions.reset();
    expect(redirectSystemPath({ path: 'nthcase-sample://item/7', initial: true })).toBe('/');
    const app = await renderRouter('./app', { initialUrl: '/' });
    expect(screen.getByTestId(TestIds.SIGNIN_SCREEN)).toBeTruthy();
    await signIn({ waitForShop: false });
    expect(await screen.findByTestId(TestIds.ITEM_NAME)).toHaveTextContent('Wall Clock');
    expect(byId(TestIds.ITEM_NUMBER)).toHaveTextContent('No. 007');
    await tap(TestIds.TOP_BAR_BACK);
    expect(await screen.findByText('Stoneware Mug')).toBeTruthy();
    expect(app.getPathname()).toBe('/');
  });

  it('opens at once when signed in, says when a number is unknown, and ignores other links', async () => {
    await launchSignedIn();
    expect(redirectSystemPath({ path: 'nthcase-sample://cart/7', initial: false })).toBe('');
    expect(getState().pendingItemId).toBeNull();
    await act(() => redirectSystemPath({ path: 'nthcase-sample://item/999', initial: false }));
    expect(await screen.findByText('No drawer has the number "999"')).toBeTruthy();
    expect(screen.getByText('Items are numbered 1 to 40.')).toBeTruthy();
    expect(byId(TestIds.TOP_BAR_TITLE)).toHaveTextContent('Not found');
    await tap(TestIds.ITEM_NOT_FOUND_ACTION);
    expect(await screen.findByText('Stoneware Mug')).toBeTruthy();
  });
});
