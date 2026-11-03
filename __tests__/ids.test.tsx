/*
 * The id census. It renders every screen in the state the spec names for each id (nthcase/test-ids.json, "when"),
 * and checks three things in the rendered tree at every step:
 *   1. every id the state should show is there;
 *   2. no id sits inside an ancestor that hides it (an `accessible` view, or a hidden subtree): on iOS such an id
 *      never reaches XCUITest, so Appium could not find it;
 *   3. the Gift cards screen has no id at all.
 * At the end, every id in the JSON has been seen, and the app's id list is exactly the JSON's.
 *
 * This proves the React tree: the testIDs React Native will hand to the platform, and their nesting. It does not
 * prove what UiAutomator2 or XCUITest then expose; the CI screenshot job reads the Android tree for that.
 */
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CATEGORIES } from '../src/data/catalog';
import { actions } from '../src/data/store';
import { TEMPLATE_PATTERNS, TemplateIds, TestIds } from '../src/testIds';
import { launch, launchSignedIn, signIn, tap } from '../test/app';
import { allIds, idsHiddenByAnAncestor, screenShowing, visibleIds, type HostNode } from '../test/tree';

type SpecId = { id: string; screen: string; element: string; when: string };
const spec: { pattern: string; ids: SpecId[] } = JSON.parse(readFileSync(join(__dirname, '../nthcase/test-ids.json'), 'utf8'));
const page = readFileSync(join(__dirname, '../assets/web/care-guide.html'), 'utf8');

const seen = new Set<string>();

/**
 * Checks one state of the app: the ids it must show are on the screen in front (waiting out a navigation
 * transition), and no id anywhere sits inside an accessible ancestor.
 */
async function state(name: string, expected: string[]) {
  await waitFor(() => {
    const ids = visibleIds();
    expect({ state: name, missing: expected.filter((id) => !ids.has(id)) }).toEqual({ state: name, missing: [] });
  });
  expect({ state: name, grouped: idsHiddenByAnAncestor() }).toEqual({ state: name, grouped: [] });
  visibleIds().forEach((id) => seen.add(id));
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const ofScreen = (s: string) => spec.ids.filter((e) => e.screen === s && !e.id.includes('{')).map((e) => e.id);

describe('the app’s ids are the spec’s', () => {
  it('lists exactly the JSON’s native ids, templates included', () => {
    const app = [...Object.values(TestIds), ...TEMPLATE_PATTERNS].sort();
    const json = spec.ids.map((e) => e.id).filter((id) => !id.startsWith('web_')).sort();
    expect(app).toEqual(json);
    expect(spec.ids).toHaveLength(147);
    for (const id of app) expect(id.replace(/\{\w+\}/g, 'x')).toMatch(new RegExp(spec.pattern));
    // the templates expand as the app writes them
    expect(TemplateIds.shopItem(7)).toBe('shop_item_7');
    expect(TemplateIds.formCategoryOption('garden')).toBe('form_category_option_garden');
  });

  it('puts every web_* id on the page as both id and data-testid', () => {
    const web = spec.ids.filter((e) => e.id.startsWith('web_')).map((e) => e.id);
    expect(web).toHaveLength(9);
    for (const id of web) expect(page).toMatch(new RegExp(`id="${id}" data-testid="${id}"`));
  });
});

describe('every id on its screen, in the state the spec names', () => {
  it('sign in, shop, item, cart, the modal, orders', async () => {
    await launch();
    await state('sign in', ofScreen('signin').filter((id) => id !== TestIds.SIGNIN_ERROR));
    await tap(TestIds.SIGNIN_SUBMIT);
    await state('sign in refused', [TestIds.SIGNIN_ERROR]);
    await signIn();

    const nav = [TestIds.NAV_SHOP, TestIds.NAV_CART, TestIds.NAV_LAB, TestIds.NAV_SETTINGS];
    await state('shop', [...nav, TestIds.SHOP_SCREEN, TestIds.SHOP_SEARCH, TestIds.SHOP_COUNT, TestIds.SHOP_LIST, ...range(40).map(TemplateIds.shopItem)]);
    await fireEvent.changeText(screen.getByTestId(TestIds.SHOP_SEARCH), 'lamp');
    await state('shop searching', [TestIds.SHOP_SEARCH_CLEAR]);
    await fireEvent.changeText(screen.getByTestId(TestIds.SHOP_SEARCH), 'velvet');
    await state('shop, no match', [TestIds.SHOP_EMPTY, TestIds.SHOP_EMPTY_ACTION]);
    await tap(TestIds.SHOP_EMPTY_ACTION);

    await tap(TemplateIds.shopItem(7));
    await screen.findByTestId(TestIds.ITEM_SCREEN);
    await state('item', [...ofScreen('item').filter((id) => !id.startsWith('item_not_found')), TestIds.TOP_BAR_TITLE, TestIds.TOP_BAR_BACK]);
    await tap(TestIds.ITEM_ADD_TO_CART);
    await state('snackbar with an action', [TestIds.SNACKBAR, TestIds.SNACKBAR_TEXT, TestIds.SNACKBAR_ACTION]);
    await tap(TestIds.SNACKBAR_ACTION);
    await screen.findByTestId(TestIds.CART_LIST);
    const line = [TemplateIds.cartLine, TemplateIds.cartLineDecrease, TemplateIds.cartLineQty, TemplateIds.cartLineIncrease, TemplateIds.cartLineRemove, TemplateIds.cartLineTotal].map((f) => f(7));
    await state('cart', [TestIds.CART_SCREEN, TestIds.CART_LIST, TestIds.CART_TOTAL, TestIds.CART_CHECKOUT, TestIds.TOP_BAR_TITLE, ...line]);
    await tap(TestIds.CART_CHECKOUT);
    await state('the modal', ofScreen('chrome').filter((id) => id.startsWith('dialog')));
    await tap(TestIds.DIALOG_CONFIRM);
    await state('cart, empty', [TestIds.CART_EMPTY, TestIds.CART_EMPTY_ACTION]);
    await tap(TestIds.SNACKBAR_ACTION);
    await screen.findByTestId(TestIds.ORDERS_LIST);
    await state('orders', [TestIds.ORDERS_SCREEN, TestIds.ORDERS_LIST, TemplateIds.ordersRow(1)]);
    await tap(TestIds.TOP_BAR_BACK);
    await tap(TestIds.NAV_LAB);
    await tap(TestIds.LAB_ORDERS);
    await screen.findByTestId(TestIds.ORDERS_SCREEN);
    await state('orders, none yet', []);
  });

  it('the lab: form, gestures, care guide, gift cards', async () => {
    await launchSignedIn();
    await tap(TestIds.NAV_LAB);
    await state('lab', ofScreen('lab'));

    await tap(TestIds.LAB_FORM);
    await screen.findByTestId(TestIds.FORM_SCREEN);
    const formIds = ofScreen('form');
    const always = formIds.filter((id) => !id.endsWith('_error') && !['form_date_picker', 'form_date_confirm', 'form_date_cancel', 'form_result'].includes(id));
    await state('form', always);
    await tap(TestIds.FORM_SUBMIT);
    await state('form, every error', formIds.filter((id) => id.endsWith('_error')));
    await tap(TestIds.FORM_CATEGORY);
    await state('form, dropdown open', CATEGORIES.map((c) => TemplateIds.formCategoryOption(c.key)));
    await tap(TemplateIds.formCategoryOption('garden'));
    await tap(TestIds.FORM_DATE);
    await state('form, date picker open', [TestIds.FORM_DATE_PICKER, TestIds.FORM_DATE_CONFIRM, TestIds.FORM_DATE_CANCEL]);
    await fireEvent.press(screen.getAllByText('15')[0]);
    await tap(TestIds.FORM_DATE_CONFIRM);
    await fireEvent.changeText(screen.getByTestId(TestIds.FORM_NAME), 'Sam Rivera');
    await fireEvent.changeText(screen.getByTestId(TestIds.FORM_EMAIL), 'sam@example.test');
    await fireEvent.changeText(screen.getByTestId(TestIds.FORM_AGE), '34');
    await fireEvent.changeText(screen.getByTestId(TestIds.FORM_PASSWORD), 'garden42x');
    await tap(TestIds.FORM_TERMS);
    await tap(TestIds.FORM_SUBMIT);
    await state('form, joined', [TestIds.FORM_RESULT]);
    await tap(TestIds.TOP_BAR_BACK);

    await tap(TestIds.LAB_GESTURES);
    await screen.findByTestId(TestIds.GESTURES_SCREEN);
    await state('gestures', ofScreen('gestures'));
    await tap(TestIds.TOP_BAR_BACK);

    await tap(TestIds.LAB_WEBVIEW);
    await screen.findByTestId(TestIds.WEBVIEW_SCREEN);
    await state('care guide', ofScreen('webview').filter((id) => !id.startsWith('web_')));
    await tap(TestIds.TOP_BAR_BACK);

    await tap(TestIds.LAB_GIFT_CARDS);
    await screen.findByText('Check a balance');
    await state('gift cards', []);
    const giftCards = screenShowing('Check a balance') as HostNode;
    expect(giftCards).not.toBeNull();
    expect([...allIds([giftCards])]).toEqual([]);
    // even after it has been used: a result line, a chip and a chosen design
    await fireEvent.changeText(screen.getByLabelText('Card code'), 'moss-0025');
    await fireEvent.press(screen.getByText('Check balance'));
    await fireEvent.press(screen.getAllByText('Choose')[1]);
    expect([...allIds([screenShowing('Check a balance') as HostNode])]).toEqual([]);
  });

  it('settings, the reset dialog, slow loads and failed loads', async () => {
    await launchSignedIn();
    await tap(TestIds.NAV_SETTINGS);
    await state('settings', ofScreen('settings').filter((id) => !id.startsWith('settings_reset_')));
    await tap(TestIds.SETTINGS_RESET);
    await state('settings, reset dialog', [TestIds.SETTINGS_RESET_CONFIRM, TestIds.SETTINGS_RESET_CANCEL]);
    await tap(TestIds.SETTINGS_RESET_CANCEL);

    // the preset's fake timers: the 3 s loads pass when the test says so
    actions.setSlowLoading(true);
    await tap(TestIds.NAV_SHOP);
    await state('shop, slow', [TestIds.SHOP_LOADING]);
    await tap(TestIds.NAV_LAB);
    await tap(TestIds.LAB_SLOW);
    await state('delivery slots, first 3 s', [TestIds.SLOW_SCREEN, TestIds.SLOW_LOADING]);
    await act(() => jest.advanceTimersByTime(3000));
    await state('delivery slots', [TestIds.SLOW_CONTENT, TestIds.SLOW_RELOAD, ...range(5).map(TemplateIds.slowSlot)]);
    await tap(TestIds.TOP_BAR_BACK);
    await tap(TestIds.LAB_ORDERS);
    await state('orders, slow', [TestIds.ORDERS_LOADING]);
    await act(() => jest.advanceTimersByTime(3000));
    await state('orders, none yet', [TestIds.ORDERS_EMPTY, TestIds.ORDERS_EMPTY_ACTION]);
    await tap(TestIds.TOP_BAR_BACK);

    actions.setSlowLoading(false);
    actions.setFailFirstLoad(true);
    await tap(TestIds.LAB_ORDERS);
    await state('orders, failed', [TestIds.ORDERS_ERROR, TestIds.ORDERS_RETRY]);
    await tap(TestIds.TOP_BAR_BACK);
    await tap(TestIds.NAV_SHOP);
    await state('shop, failed', [TestIds.SHOP_ERROR, TestIds.SHOP_RETRY]);
  });

  it('the item’s not-found state', async () => {
    await launch();
    // as the deep link nthcase-sample://item/999 leaves it (app/+native-intent.tsx)
    await act(() => actions.setPendingItemId('999'));
    await signIn({ waitForShop: false });
    await screen.findByTestId(TestIds.ITEM_NOT_FOUND);
    await state('item, unknown id', [TestIds.ITEM_SCREEN, TestIds.ITEM_NOT_FOUND, TestIds.ITEM_NOT_FOUND_ACTION]);
  });

  it('has seen every id in the JSON', () => {
    const expand = (id: string): string[] => {
      if (id.includes('{id}')) return [id.replace('{id}', id.startsWith('shop_item') ? '1' : '7')];
      if (id.includes('{key}')) return CATEGORIES.map((c) => id.replace('{key}', c.key));
      if (id.includes('{n}')) return [id.replace('{n}', '1')];
      return [id];
    };
    const native = spec.ids.filter((e) => !e.id.startsWith('web_')).flatMap((e) => expand(e.id));
    expect(native.filter((id) => !seen.has(id))).toEqual([]);
    // and nothing the spec does not name
    const known = (id: string) =>
      native.includes(id) || /^(shop_item|cart_line(_(decrease|qty|increase|remove|total))?)_\d+$|^(slow_slot|orders_row)_\d+$/.test(id);
    expect([...seen].filter((id) => !known(id))).toEqual([]);
  });
});
