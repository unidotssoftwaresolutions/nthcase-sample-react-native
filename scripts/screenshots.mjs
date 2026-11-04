#!/usr/bin/env node
// Drives the installed app on ONE Android emulator, in CI only (.github/workflows/build.yml, job "screenshots"):
//
//   1. takes every screen, light and dark, under round one's names -> build/screenshots/{light,dark}/NN-name.png
//   2. walks every state the spec names for an id (nthcase/test-ids.json, "when") and reads UiAutomator's tree there:
//      the tree Appium's UiAutomator2 driver reads -> build/screenshots/android-ids.md, and each tree under trees/
//   3. plays the three taps SPEC.md §13 needs with the keyboard up (no hide-keyboard step): Sign in, Clear search,
//      the form's Join, and Gift cards' Check balance
//   4. writes what happened, step by step -> build/screenshots/walk.md
//
// The walk is cut into segments. Each starts from a cold start, so a segment that fails is reported and the next one
// still runs: one run tells every miss. The script fails once, at the end, if any screen, id or check was missed.
// An id it does not see is reported with its reason: transient (a 3 s spinner, which SPEC.md §13 lets a walk miss),
// not walked (the segment stopped before its state, with the error), or hidden from UiAutomator (the walk stood in
// its state and no node had it as resource-id: a defect).
//
// When adb loses the emulator (offline, not found), the walk waits up to 5 minutes for it to come back, writes what
// the runner and the guest say about it, and retries that segment once from a cold start. If it does not come back,
// every later segment is reported as "device lost" and the walk ends. walk.md lists each loss.
//
//   node scripts/screenshots.mjs          the walk (needs adb and the emulator)
//   node scripts/screenshots.mjs --plan   checks, without a device, that the walk names a state for every spec id
//
// It talks to the emulator through adb only, by its serial ($ANDROID_SERIAL, default emulator-5554). Never run it on
// a machine with other devices attached: it installs nothing, but it taps, types and switches the system theme.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'build/screenshots');
const PACKAGE = 'com.nthcase.sample';
const THEMES = ['light', 'dark'];

// ---- what the walk must see ---------------------------------------------------------------------------------------

const SPEC = JSON.parse(readFileSync(join(root, 'nthcase/test-ids.json'), 'utf8')).ids.filter((e) => !e.id.startsWith('web_'));
/** A spec id, or a template like shop_item_{id}, as a pattern over the ids the app writes. */
const PATTERNS = SPEC.map((e) => ({ id: e.id, re: new RegExp(`^${e.id.replace(/\{\w+\}/g, '[a-z0-9]+')}$`) }));
const specIdOf = (id) => PATTERNS.filter((p) => p.re.test(id)).map((p) => p.id);

/** The 3 s spinners. SPEC.md §13: a step on a device can outlast them, so a walk may miss them. */
const TRANSIENT = new Set(['shop_loading', 'orders_loading', 'slow_loading']);

/** Round one's 24 screens. */
const SHOTS = [
  '01-sign-in', '02-sign-in-error', '03-shop', '04-shop-search', '05-shop-no-match', '06-item', '07-item-snackbar',
  '08-cart', '09-cart-dialog', '10-cart-empty', '11-lab', '12-form-errors', '13-form-done', '14-gestures', '15-webview',
  '16-slow-loading', '17-slow-done', '18-orders', '19-orders-empty', '20-orders-error', '21-gift-cards', '22-settings',
  '23-settings-dialog', '24-deep-link-unknown',
];

/**
 * Every state the spec names, and the ids the app writes there (a template as the instance the walk makes: item 1,
 * order 1). `scroll`: the ids run below the fold, so the walk scrolls the page to its end to read them all.
 */
const PLAN = {
  'sign in': { ids: ['signin_screen', 'signin_email', 'signin_password', 'signin_password_toggle', 'signin_submit', 'signin_test_account', 'signin_use_test_account'] },
  'sign in, refused': { ids: ['signin_error'] },
  shop: { ids: ['nav_shop', 'nav_cart', 'nav_lab', 'nav_settings', 'shop_screen', 'shop_search', 'shop_count', 'shop_list', 'shop_item_1'] },
  'shop, searching': { ids: ['shop_search_clear'] },
  'shop, no match': { ids: ['shop_empty', 'shop_empty_action'] },
  item: {
    ids: ['item_screen', 'item_image', 'item_number', 'item_name', 'item_price', 'item_description', 'item_qty_decrease', 'item_qty_value', 'item_qty_increase', 'item_add_to_cart', 'top_bar_title', 'top_bar_back'],
    scroll: true,
  },
  'item, snackbar': { ids: ['snackbar', 'snackbar_text', 'snackbar_action'] },
  cart: { ids: ['cart_screen', 'cart_list', 'cart_line_1', 'cart_line_decrease_1', 'cart_line_qty_1', 'cart_line_increase_1', 'cart_line_remove_1', 'cart_line_total_1', 'cart_total', 'cart_checkout'] },
  'cart, dialog': { ids: ['dialog', 'dialog_title', 'dialog_text', 'dialog_confirm', 'dialog_dismiss'] },
  'cart, empty': { ids: ['cart_empty', 'cart_empty_action'] },
  orders: { ids: ['orders_screen', 'orders_list', 'orders_row_1'] },
  lab: { ids: ['lab_screen', 'lab_form', 'lab_gestures', 'lab_webview', 'lab_slow', 'lab_orders', 'lab_gift_cards'] },
  form: {
    ids: ['form_screen', 'form_name', 'form_email', 'form_age', 'form_password', 'form_password_toggle', 'form_category', 'form_date', 'form_newsletter', 'form_budget', 'form_budget_value', 'form_terms', 'form_submit'],
    scroll: true,
  },
  'form, every error': {
    ids: ['form_name_error', 'form_email_error', 'form_age_error', 'form_password_error', 'form_category_error', 'form_date_error', 'form_terms_error'],
    scroll: true,
  },
  'form, dropdown open': { ids: ['form_category_option_kitchen', 'form_category_option_desk', 'form_category_option_garden', 'form_category_option_home'] },
  'form, date picker open': { ids: ['form_date_picker', 'form_date_confirm', 'form_date_cancel'] },
  'form, joined': { ids: ['form_result'] },
  gestures: {
    ids: ['gestures_screen', 'gestures_status', 'gestures_orientation', 'gestures_tap', 'gestures_tap_count', 'gestures_double_tap', 'gestures_long_press', 'gestures_swipe', 'gestures_drag_source', 'gestures_drop_target', 'gestures_pinch', 'gestures_zoom_value', 'gestures_rotate', 'gestures_rotation_value', 'gestures_scroll', 'gestures_scroll_target'],
    scroll: true,
    lane: 'edge',
  },
  'care guide': { ids: ['webview_screen', 'webview', 'webview_status'] },
  'delivery slots, first 3 s': { ids: ['slow_loading'] },
  'delivery slots': { ids: ['slow_screen', 'slow_content', 'slow_slot_1', 'slow_slot_2', 'slow_slot_3', 'slow_slot_4', 'slow_slot_5', 'slow_reload'], scroll: true },
  settings: {
    ids: ['settings_screen', 'settings_account_email', 'settings_orders', 'settings_sign_out', 'settings_theme', 'settings_theme_system', 'settings_theme_light', 'settings_theme_dark', 'settings_notifications', 'settings_notifications_status', 'settings_send_notification', 'settings_slow_loading', 'settings_fail_loading', 'settings_reset', 'settings_version'],
    scroll: true,
  },
  'settings, reset dialog': { ids: ['settings_reset_confirm', 'settings_reset_cancel'] },
  'orders, failed': { ids: ['orders_error', 'orders_retry'] },
  'orders, none yet': { ids: ['orders_empty', 'orders_empty_action'] },
  'shop, failed': { ids: ['shop_error', 'shop_retry'] },
  'shop, slow': { ids: ['shop_loading'] },
  'orders, slow': { ids: ['orders_loading'] },
  'item, unknown id': { ids: ['item_not_found', 'item_not_found_action'] },
};

/** The plan names a state for every spec id, and nothing the spec does not name. */
function planProblems() {
  const problems = [];
  const covered = new Set();
  for (const [state, { ids }] of Object.entries(PLAN)) {
    for (const id of ids) {
      const spec = specIdOf(id);
      if (spec.length !== 1) problems.push(`"${state}": ${id} matches ${spec.length ? spec.join(', ') : 'no spec id'}`);
      spec.forEach((s) => covered.add(s));
      if (TRANSIENT.has(id) && ids.some((other) => !TRANSIENT.has(other))) problems.push(`"${state}": a spinner's state holds other ids`);
    }
  }
  for (const { id } of SPEC) if (!covered.has(id)) problems.push(`no state for ${id}`);
  const walked = SEGMENTS.flatMap(([, fn]) => [...fn.toString().matchAll(/see\('([^']+)'\)/g)].map(([, state]) => state));
  for (const state of Object.keys(PLAN)) {
    const times = walked.filter((w) => w === state).length;
    if (times !== 1) problems.push(`"${state}" is walked ${times} times by the segments, not once`);
  }
  for (const state of walked) if (!PLAN[state]) problems.push(`a segment walks "${state}", which the plan does not name`);
  if (SPEC.length !== 138) problems.push(`the spec has ${SPEC.length} native ids, not 138`);
  return problems;
}

// ---- adb -----------------------------------------------------------------------------------------------------------

const serial = process.env.ANDROID_SERIAL ?? 'emulator-5554';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The emulator stopped answering adb. The segment is retried once the device is back (see recover()). */
class DeviceLost extends Error {}
/** What adb says when it has no device to talk to, as opposed to a command that failed on the device. */
const LOST = /device offline|device '[^']*' not found|no devices\/emulators found|device unauthorized|error: closed|protocol fault/i;
/** Set when the device did not come back: every later segment is "device lost", and no adb command is sent. */
let deviceGone = '';

/** One adb call, bounded: a dump or a screencap on a slow device takes seconds, never 90. */
function adbOnce(args, timeout = 90_000) {
  return execFileSync('adb', args, { maxBuffer: 64 * 1024 * 1024, timeout, stdio: ['ignore', 'pipe', 'pipe'] });
}

/** What adb says the device is: "device" when it answers, else "offline", "unknown", ... */
function deviceState() {
  try {
    return adbOnce(['-s', serial, 'get-state'], 10_000).toString().trim() || 'unknown';
  } catch (error) {
    return (String(error.stderr ?? '').match(LOST)?.[0] ?? 'unknown').toLowerCase();
  }
}

function adb(...args) {
  if (deviceGone) throw new DeviceLost(`device lost: ${deviceGone}`);
  try {
    return adbOnce(['-s', serial, ...args]);
  } catch (error) {
    const what = `adb ${args.slice(0, 3).join(' ')}`;
    const said = String(error.stderr ?? '').trim().split('\n').at(-1) ?? '';
    if (LOST.test(said)) throw new DeviceLost(`device lost: ${what} said "${said}"`);
    if (error.code === 'ETIMEDOUT') {
      const state = deviceState();
      if (state !== 'device') throw new DeviceLost(`device lost: ${what} did not answer in 90 s, and the device is ${state}`);
      throw new Error(`${what} did not answer in 90 s`);
    }
    throw new Error(`${what} failed: ${said || error.message.split('\n')[0]}`);
  }
}
const shell = (...args) => adb('shell', ...args).toString();
/** Whether a wait for something on screen succeeded. A lost device is not "it did not show": it stops the segment. */
const shows = (promise) => promise.then(() => true, (error) => {
  if (error instanceof DeviceLost) throw error;
  return false;
});

let screen;
/** The screen in pixels, and dp → px. */
function size() {
  if (!screen) {
    const px = [...shell('wm', 'size').matchAll(/(\d+)x(\d+)/g)].at(-1);
    const dpi = [...shell('wm', 'density').matchAll(/(\d+)/g)].at(-1);
    screen = { width: Number(px[1]), height: Number(px[2]), dp: Number(dpi?.[1] ?? 160) / 160 };
  }
  return screen;
}

// ---- the UiAutomator tree ----------------------------------------------------------------------------------------

function decode(s) {
  return s.replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
}

let lastXml = '';
let lastNodes = [];
let failedDumps = 0;

/** The current window's nodes, as UiAutomator dumps them. A dump can fail while something animates; it is retried. */
function dump() {
  let xml = '';
  for (let attempt = 0; attempt < 5 && !xml.includes('<hierarchy'); attempt++) {
    try {
      shell('rm', '-f', '/sdcard/mossgrove-ui.xml');
      shell('uiautomator', 'dump', '/sdcard/mossgrove-ui.xml');
      xml = adb('exec-out', 'cat', '/sdcard/mossgrove-ui.xml').toString();
    } catch (error) {
      if (error instanceof DeviceLost) throw error;
      xml = '';
    }
  }
  if (!xml.includes('<hierarchy')) failedDumps++;
  lastXml = xml;
  lastNodes = [...xml.matchAll(/<node ([^>]*?)\/?>/g)].map(([, attrs]) => {
    const a = Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, decode(v)]));
    const [x1, y1, x2, y2] = (a.bounds?.match(/\d+/g) ?? [0, 0, 0, 0]).map(Number);
    return {
      id: a['resource-id'] ?? '', text: a.text ?? '', desc: a['content-desc'] ?? '', cls: a.class ?? '', scrollable: a.scrollable === 'true',
      x: (x1 + x2) / 2, y: (y1 + y2) / 2, y1, y2, h: y2 - y1,
    };
  });
  return lastNodes;
}

/** Where on screen a tap still lands on the app: above the system bar, and above the tab bar on a tab screen. */
function bottomLimit(nodes) {
  const { height, dp } = size();
  const tabBar = nodes.filter((n) => n.id.startsWith('nav_')).map((n) => n.y1);
  return Math.min(height - 48 * dp, ...tabBar);
}
/** On screen enough to tap: UiAutomator lists only what is visible, clipped by its scroll view. */
const reachable = (n, nodes) => n.h >= 12 * size().dp && n.y > 0 && n.y < bottomLimit(nodes);
/** Two dumps of the same page: the page did not move. */
const signature = (nodes) => nodes.map((n) => `${n.id}|${n.text}|${n.y1}`).join('\n');

async function find(pred, what, timeoutMs = 10_000) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const hit = dump().find(pred);
    if (hit) return hit;
    if (Date.now() > end) throw new Error(`not on screen: ${what}`);
    await sleep(400);
  }
}

const byId = (id, t) => find((n) => n.id === id, `id ${id}`, t);
const byText = (text, t) => find((n) => n.text === text || n.desc === text, `text "${text}"`, t);
const byTextPart = (part, t) => find((n) => n.text.includes(part) || n.desc.includes(part), `text containing "${part}"`, t);

async function tap(node) {
  shell('input', 'tap', String(Math.round(node.x)), String(Math.round(node.y)));
  await sleep(700);
}
const tapId = async (id) => tap(await byId(id));
const tapText = async (text) => tap(await byText(text));

/** Types into the focused field. The keyboard stays up: NthCase has no step that hides it (SPEC.md §13). */
async function typeText(text) {
  shell('input', 'text', text.replaceAll(' ', '%s'));
  await sleep(500);
}

async function clearField() {
  shell('input', 'keyevent', 'KEYCODE_MOVE_END');
  for (let i = 0; i < 4; i++) shell('input', 'keyevent', ...Array(10).fill('KEYCODE_DEL'));
}

/** Whether the soft keyboard is up, as the input method service says. */
function keyboardShown() {
  try {
    return /mInputShown=true/.test(shell('dumpsys', 'input_method'));
  } catch (error) {
    if (error instanceof DeviceLost) throw error;
    return false;
  }
}

/** For a picture only: the screenshots show the screen, not the keyboard. Back closes only the keyboard here. */
async function hideKeyboardForPicture() {
  if (keyboardShown()) {
    shell('input', 'keyevent', 'KEYCODE_BACK');
    await sleep(500);
  }
}

/**
 * One swipe of the page, inside its tallest scroll view: never on the keyboard, the top bar or the tab bar. `down`
 * shows what is below. `edge` swipes in the left gutter, clear of the Gestures screen's pads (a swipe on a pad is
 * that pad's gesture, by design).
 */
async function swipe(direction, lane = 'middle') {
  const { width, height, dp } = size();
  // every caller has just read the tree
  const page = lastNodes.filter((n) => n.scrollable).sort((a, b) => b.h - a.h)[0];
  const [top, bottom] = page ? [page.y1, page.y2] : [0.2 * height, 0.8 * height];
  const x = String(Math.round(lane === 'edge' ? 8 * dp : width / 2));
  const at = (f) => String(Math.round(top + (bottom - top) * f));
  const [from, to] = direction === 'down' ? [0.8, 0.25] : [0.25, 0.8];
  shell('input', 'swipe', x, at(from), x, at(to), '400');
  await sleep(600);
}

/** Scrolls the page, down to its end and then up to its top, until [id] is on screen where a tap lands. */
async function scrollTo(id, lane = 'middle') {
  for (const direction of ['down', 'up']) {
    let last = '';
    for (let i = 0; i < 15; i++) {
      const nodes = dump();
      const hit = nodes.find((n) => n.id === id && reachable(n, nodes));
      if (hit) return hit;
      const now = signature(nodes);
      if (now === last) break;
      last = now;
      await swipe(direction, lane);
    }
  }
  const seenAt = dump().find((n) => n.id === id);
  throw new Error(`could not scroll to ${id}${seenAt ? ` (it is on screen at y=${seenAt.y}, below where a tap lands, ${Math.round(bottomLimit(dump()))})` : ''}`);
}

async function scrollToTop(lane = 'middle') {
  let last = '';
  for (let i = 0; i < 15; i++) {
    const now = signature(dump());
    if (now === last) return;
    last = now;
    await swipe('up', lane);
  }
}

// ---- what the walk records -----------------------------------------------------------------------------------------

/** theme → state → { seen: Set, end: boolean (scrolled to the page's end), tree: path } */
const visits = Object.fromEntries(THEMES.map((t) => [t, {}]));
/** theme → segment → error, for the segments that stopped */
const stopped = Object.fromEntries(THEMES.map((t) => [t, {}]));
/** theme → the screenshots taken */
const shots = Object.fromEntries(THEMES.map((t) => [t, new Set()]));
/** the checks besides ids and screenshots: { theme, name, ok, detail } */
const checks = [];
const log = [];
const say = (line) => {
  log.push(line);
  console.log(line);
};

let theme = 'light';

/** The picture first (a 3 s spinner does not wait). */
async function capture(name) {
  await sleep(600);
  await hideKeyboardForPicture();
  const png = adb('exec-out', 'screencap', '-p');
  mkdirSync(join(out, theme), { recursive: true });
  writeFileSync(join(out, theme, `${name}.png`), png);
  shots[theme].add(name);
  say(`    ${theme}/${name}.png`);
}

/**
 * Reads the tree in [state] and records which of its ids are there. It waits a little for ids that are not yet drawn,
 * unless the state is a spinner's; a `scroll` state is read page by page down to the page's end, then scrolled back.
 */
async function see(state) {
  const { ids, scroll = false, lane = 'middle' } = PLAN[state];
  const spinner = ids.every((id) => TRANSIENT.has(id));
  const seen = new Set();
  const take = (nodes) => nodes.forEach((n) => ids.includes(n.id) && seen.add(n.id));
  const missing = () => ids.filter((id) => !seen.has(id));
  let xml = '';
  let end = !scroll;

  const until = Date.now() + (spinner ? 0 : scroll ? 1000 : 3000);
  do {
    take(dump());
    xml += lastXml;
    if (missing().length === 0) break;
    if (!spinner) await sleep(400);
  } while (Date.now() < until);

  if (scroll && missing().length > 0) {
    let last = '';
    for (let i = 0; i < 15; i++) {
      await swipe('down', lane);
      const nodes = dump();
      xml += lastXml;
      take(nodes);
      const now = signature(nodes);
      if (now === last) {
        end = true;
        break;
      }
      last = now;
      if (missing().length === 0) break;
    }
    await scrollToTop(lane);
  }

  const tree = join('trees', theme, `${state.replaceAll(/[^a-z0-9]+/gi, '-')}.xml`);
  mkdirSync(join(out, 'trees', theme), { recursive: true });
  writeFileSync(join(out, tree), xml);
  visits[theme][state] = { seen, end, tree };
  const miss = missing();
  say(`    ${state}: ${ids.length - miss.length} of ${ids.length} ids${miss.length ? `; not seen: ${miss.join(' ')}` : ''}`);
}

function check(name, ok, detail) {
  checks.push({ theme, name, ok, detail });
  say(`    ${ok ? 'PASS' : 'FAIL'} ${name}: ${detail}`);
}

// ---- the app -------------------------------------------------------------------------------------------------------

async function coldStart() {
  shell('am', 'force-stop', PACKAGE);
  shell('cmd', 'uimode', 'night', theme === 'dark' ? 'yes' : 'no');
  await sleep(800);
  shell('am', 'start', '-W', '-n', `${PACKAGE}/.MainActivity`);
  await byId('signin_screen', 30_000);
}

async function signIn() {
  await tap(await scrollTo('signin_use_test_account'));
  await tap(await scrollTo('signin_submit'));
  await byId('shop_list', 15_000);
}

async function waitForSnackbarToGo() {
  const end = Date.now() + 12_000;
  while (dump().some((n) => n.id === 'snackbar') && Date.now() < end) await sleep(1000);
}

/** Scenario 01, keyboard up: the Sign in tap after typing must reach the button, not the keyboard. */
async function signInAndShop() {
  await coldStart();
  await see('sign in');
  await capture('01-sign-in');
  await tapId('signin_email');
  await typeText('tester@mossgrove.test');
  await tap(await scrollTo('signin_password'));
  await typeText('letmein1');
  const up = keyboardShown();
  await tap(await scrollTo('signin_submit'));
  const refused = await shows(byText('Wrong email or password', 5000));
  check('Sign in, tapped with the keyboard up', refused, refused
    ? `the refusal showed${up ? '' : ' (the input method did not report the keyboard up)'}`
    : 'the tap did not reach Sign in: no refusal showed');
  if (!refused) {
    // go on without the keyboard, so the rest of the walk still runs
    await hideKeyboardForPicture();
    await tap(await scrollTo('signin_submit'));
  }
  await byId('signin_error');
  await see('sign in, refused');
  await capture('02-sign-in-error');
  await signIn();
  await see('shop');
  await capture('03-shop');

  await tapId('shop_search');
  await typeText('lamp');
  await byTextPart('4 of 40');
  await see('shop, searching');
  await capture('04-shop-search');
  await tapId('shop_search');
  await clearField();
  await typeText('velvet');
  await byId('shop_empty');
  await see('shop, no match');
  await capture('05-shop-no-match');
  // scenario 02, step 5: Clear search right after typing, the keyboard still up
  await tapId('shop_search');
  await sleep(500);
  const upForClear = keyboardShown();
  await tap(await scrollTo('shop_empty_action'));
  const cleared = await shows(byTextPart('40 drawers ·', 5000));
  check('Clear search, tapped with the keyboard up', cleared, cleared
    ? `the list came back${upForClear ? '' : ' (the input method did not report the keyboard up)'}`
    : 'the tap did not reach Clear search: the list did not come back');
}

async function itemCartAndOrders() {
  await coldStart();
  await signIn();
  await tapId('shop_item_1');
  await byId('item_add_to_cart');
  await see('item');
  await capture('06-item');
  await tap(await scrollTo('item_add_to_cart'));
  await byId('snackbar');
  await see('item, snackbar');
  await capture('07-item-snackbar');
  await tapId('snackbar_action');
  await byId('cart_total');
  await see('cart');
  await capture('08-cart');
  await tapId('cart_checkout');
  await byText('Place this order?');
  await see('cart, dialog');
  await capture('09-cart-dialog');
  await tapId('dialog_confirm');
  await byId('cart_empty');
  await see('cart, empty');
  await tapId('snackbar_action');
  await byText('Order 1');
  await see('orders');
  await waitForSnackbarToGo();
  await capture('18-orders');
  await tapId('top_bar_back');
  if (!dump().some((n) => n.id === 'cart_empty')) await tapId('nav_cart');
  await byId('cart_empty');
  await waitForSnackbarToGo();
  await capture('10-cart-empty');
}

/** Scenario 04. The last Join is tapped with the keyboard up, after typing: SPEC.md §13 says it must be reachable. */
async function labAndForm() {
  await coldStart();
  await signIn();
  await tapId('nav_lab');
  await byId('lab_form');
  await see('lab');
  await capture('11-lab');

  await tapId('lab_form');
  await byId('form_name');
  await see('form');
  await tap(await scrollTo('form_submit'));
  await byText('Enter your name');
  await see('form, every error');
  await scrollToTop();
  await capture('12-form-errors');

  await tap(await scrollTo('form_category'));
  await byText('Kitchen');
  await see('form, dropdown open');
  await tapId('form_category_option_garden');
  await tap(await scrollTo('form_date'));
  await byText('Select date');
  await see('form, date picker open');
  await tapText('15');
  await tapId('form_date_confirm');
  await tap(await scrollTo('form_terms'));

  for (const [id, text] of [['form_name', 'Sam Rivera'], ['form_email', 'sam@example.test'], ['form_age', '34'], ['form_password', 'garden42x']]) {
    await tap(await scrollTo(id));
    await typeText(text);
  }
  const up = keyboardShown();
  const page = dump().find((n) => n.cls === 'android.widget.ScrollView');
  const padded = page !== undefined && page.y2 < size().height - 150 * size().dp;
  if (!up && !padded) {
    check('Join, tapped with the keyboard up', false, 'the keyboard never came up after typing, so the check could not run');
  } else {
    await tap(await scrollTo('form_submit'));
    const joined = await shows(byId('form_result', 5000));
    check('Join, tapped with the keyboard up', joined, joined
      ? `joined; the form ended at y=${page?.y2} of ${size().height}, above the keyboard`
      : `the tap did not reach Join (the form ends at y=${page?.y2} of ${size().height}): the keyboard covers it`);
  }
  if (!dump().some((n) => n.id === 'form_result')) {
    // go on without the keyboard, so the rest of the walk still runs
    await hideKeyboardForPicture();
    await tap(await scrollTo('form_submit'));
  }
  await scrollTo('form_result');
  await see('form, joined');
  await waitForSnackbarToGo();
  await capture('13-form-done');
}

async function gestures() {
  await coldStart();
  await signIn();
  await tapId('nav_lab');
  await tapId('lab_gestures');
  await byId('gestures_status');
  await capture('14-gestures');
  await see('gestures');
}

async function careGuide() {
  await coldStart();
  await signIn();
  await tapId('nav_lab');
  await tapId('lab_webview');
  await byText('Care guide loaded', 15_000);
  await see('care guide');
  await sleep(1000);
  await capture('15-webview');
}

async function deliverySlots() {
  await coldStart();
  await signIn();
  await tapId('nav_lab');
  await tap(await byId('lab_slow'));
  await capture('16-slow-loading');
  await see('delivery slots, first 3 s');
  await byId('slow_content', 8000);
  await see('delivery slots');
  await capture('17-slow-done');
}

async function settings() {
  await coldStart();
  await signIn();
  await tapId('nav_settings');
  await byId('settings_version');
  await capture('22-settings');
  await see('settings');
  await tap(await scrollTo('settings_reset'));
  await byText('Empty the cart and orders?');
  await see('settings, reset dialog');
  await capture('23-settings-dialog');
  await tapId('settings_reset_cancel');
}

async function failedLoads() {
  await coldStart();
  await signIn();
  await tapId('nav_settings');
  await tap(await scrollTo('settings_fail_loading'));
  await tapId('nav_lab');
  await tapId('lab_orders');
  await byTextPart('Orders didn');
  await see('orders, failed');
  await capture('20-orders-error');
  await tapId('orders_retry');
  await byText('No orders yet');
  await see('orders, none yet');
  await capture('19-orders-empty');
  await tapId('top_bar_back');
  await tapId('nav_shop');
  await byTextPart('catalogue didn');
  await see('shop, failed');
}

async function slowLoads() {
  await coldStart();
  await signIn();
  await tapId('nav_settings');
  await tap(await scrollTo('settings_slow_loading'));
  await tapId('nav_shop');
  await see('shop, slow');
  await tapId('nav_lab');
  await tapId('lab_orders');
  await see('orders, slow');
}

/** Scenario 10: a screen with no ids. Check balance is tapped with the keyboard up, after typing the code. */
async function giftCards() {
  await coldStart();
  await signIn();
  await tapId('nav_lab');
  await tapId('lab_gift_cards');
  await byText('Check a balance');
  const ids = dump().filter((n) => specIdOf(n.id).length > 0).map((n) => n.id);
  check('Gift cards shows no spec id', ids.length === 0, ids.length ? `on screen: ${ids.join(' ')}` : 'none on screen');
  // the field, not its label above it: both read "Card code"
  await tap(await find((n) => n.cls === 'android.widget.EditText' && (n.desc === 'Card code' || n.text === 'Card code'), 'the Card code field'));
  await typeText('MOSS-0025');
  const up = keyboardShown();
  await tap(await byText('Check balance'));
  const balance = await shows(byText('Balance: $25.00', 5000));
  check('Check balance, tapped with the keyboard up', balance, balance
    ? `the balance showed${up ? '' : ' (the input method did not report the keyboard up)'}`
    : 'the tap did not reach Check balance: no balance showed');
  await hideKeyboardForPicture();
  if (!balance) await tap(await byText('Check balance'));
  await tapText('Choose');
  await byText('A $25 card with the Fern design');
  await capture('21-gift-cards');
}

async function deepLink() {
  await coldStart();
  await signIn();
  shell('am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', 'nthcase-sample://item/999', PACKAGE);
  await byId('item_not_found', 15_000);
  await see('item, unknown id');
  await capture('24-deep-link-unknown');
}

const SEGMENTS = [
  ['sign in and the shop', signInAndShop],
  ['item, cart and orders', itemCartAndOrders],
  ['the lab and the form', labAndForm],
  ['gestures', gestures],
  ['care guide', careGuide],
  ['delivery slots', deliverySlots],
  ['settings', settings],
  ['failed loads', failedLoads],
  ['slow loads', slowLoads],
  ['gift cards', giftCards],
  ['deep link', deepLink],
];

if (process.argv.includes('--plan')) {
  const problems = planProblems();
  console.log(problems.length ? problems.join('\n') : `The walk names a state for each of the ${SPEC.length} native spec ids, and walks each state once.`);
  process.exit(problems.length ? 1 : 0);
}

// ---- the reports ---------------------------------------------------------------------------------------------------

/** Each spec id's status in one theme: seen, or the reason it was not. */
function statusOf(specId, inTheme) {
  const states = Object.entries(PLAN).filter(([, p]) => p.ids.some((id) => specIdOf(id).includes(specId)));
  const reasons = [];
  for (const [state, { ids }] of states) {
    const mine = ids.filter((id) => specIdOf(id).includes(specId));
    const visit = visits[inTheme][state];
    if (!visit) {
      const [name, error] = Object.entries(stopped[inTheme]).find(([s]) => SEGMENT_OF[state] === s) ?? [SEGMENT_OF[state], 'it did not run'];
      reasons.push({ kind: 'not walked', text: `"${name}" stopped before "${state}": ${error}` });
      continue;
    }
    const missing = mine.filter((id) => !visit.seen.has(id));
    if (missing.length === 0) return { kind: 'seen', text: `${mine.join(', ')} in "${state}"` };
    if (mine.every((id) => TRANSIENT.has(id))) reasons.push({ kind: 'transient', text: `a 3 s spinner, gone before the tree was read in "${state}"` });
    else if (!visit.end) reasons.push({ kind: 'not on screen', text: `"${state}" was read, but the walk did not reach the end of the page (${visit.tree})` });
    else reasons.push({ kind: 'HIDDEN', text: `the walk stood in "${state}" and no node had ${missing.join(', ')} as resource-id (${visit.tree})` });
  }
  const order = ['HIDDEN', 'not on screen', 'not walked', 'transient'];
  return reasons.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))[0];
}

/** Which segment walks each state, read from the segments' source. */
const SEGMENT_OF = Object.fromEntries(
  SEGMENTS.flatMap(([name, fn]) => [...fn.toString().matchAll(/see\('([^']+)'\)/g)].map(([, state]) => [state, name])),
);

function reports() {
  const rows = SPEC.map(({ id }) => ({ id, by: Object.fromEntries(THEMES.map((t) => [t, statusOf(id, t)])) }));
  const misses = rows.flatMap((r) => THEMES.filter((t) => r.by[t].kind !== 'seen').map((t) => ({ id: r.id, theme: t, ...r.by[t] })));
  const failing = misses.filter((m) => m.kind !== 'transient');
  const seenBoth = rows.filter((r) => THEMES.every((t) => r.by[t].kind === 'seen')).length;
  const count = (kind) => misses.filter((m) => m.kind === kind).length;
  const cell = (s) => (s.kind === 'seen' ? 'seen' : `**${s.kind}**`);

  const ids = [
    '# Spec ids in the Android UiAutomator tree',
    '',
    `Read with \`uiautomator dump\` on the CI emulator (the tree Appium's UiAutomator2 driver reads), in each state the spec names, light and dark. **${seenBoth} of ${rows.length}** native ids were seen as \`resource-id\` in their state in both themes.`,
    '',
    misses.length === 0
      ? 'Missing: none.'
      : `Missing (an id × a theme): ${count('HIDDEN')} hidden from UiAutomator, ${count('not on screen')} not on screen in the state walked, ${count('not walked')} not walked, ${count('transient')} transient.`,
    '',
    '| Id | Light | Dark |',
    '| --- | --- | --- |',
    ...rows.map((r) => `| \`${r.id}\` | ${cell(r.by.light)} | ${cell(r.by.dark)} |`),
    '',
    '## Every miss, with its reason',
    '',
    ...(misses.length ? misses.map((m) => `- \`${m.id}\` (${m.theme}): **${m.kind}**. ${m.text}.`) : ['None.']),
    '',
    'Kinds: **transient** is a 3 s spinner, which SPEC.md §13 lets a walk miss. **not walked**: the segment stopped before the state, so the walk never stood there. **not on screen**: the walk stood there, but did not scroll to the end of the page. **HIDDEN**: the walk stood in the state, read the whole page, and no node had the id as resource-id: an `accessible` grouping or a view that collapses ids. That is a defect.',
    '',
  ];
  writeFileSync(join(out, 'android-ids.md'), ids.join('\n'));

  const shotMisses = THEMES.flatMap((t) => SHOTS.filter((s) => !shots[t].has(s)).map((s) => `${t}/${s}`));
  const walk = [
    '# The screenshot walk',
    '',
    `Screenshots: ${THEMES.map((t) => `${t} ${shots[t].size} of ${SHOTS.length}`).join(', ')}.${shotMisses.length ? ` Missing: ${shotMisses.join(', ')}.` : ''}`,
    '',
    '## Segments',
    '',
    ...THEMES.flatMap((t) => SEGMENTS.map(([name]) => `- ${t}, ${name}: ${stopped[t][name] ? `**stopped**: ${stopped[t][name]}` : 'done'}`)),
    '',
    '## Checks',
    '',
    ...(checks.length ? checks.map((c) => `- ${c.theme}, ${c.name}: ${c.ok ? 'pass' : '**FAIL**'}. ${c.detail}.`) : ['None ran.']),
    '',
    `UiAutomator dumps that failed five times in a row: ${failedDumps}.`,
    '',
    '## The device',
    '',
    ...(losses.length
      ? [
        `The emulator stopped answering adb ${losses.length} time${losses.length > 1 ? 's' : ''}. Each time the walk waited for it, and retried the segment once from a cold start if it came back:`,
        '',
        ...losses.map((l) => `- ${l.theme}, ${l.segment}, attempt ${l.attempt}: ${l.back ? `**back** after ${l.seconds} s` : `**not back** after ${l.seconds} s`}. ${l.detail}.${l.file ? ` The guest's log: \`${l.file}\`.` : ''}`),
      ]
      : ['The emulator answered adb through the whole walk.']),
    '',
    '## Log',
    '',
    '```',
    ...log,
    '```',
    '',
  ];
  writeFileSync(join(out, 'walk.md'), walk.join('\n'));

  const failures = [
    ...THEMES.flatMap((t) => Object.entries(stopped[t]).map(([s, e]) => `segment "${s}" (${t}) stopped: ${e}`)),
    ...shotMisses.map((s) => `screenshot missing: ${s}`),
    ...failing.map((m) => `id ${m.id} (${m.theme}): ${m.kind}. ${m.text}`),
    ...checks.filter((c) => !c.ok).map((c) => `check failed (${c.theme}): ${c.name}. ${c.detail}`),
  ];
  console.log(`\n${seenBoth} of ${rows.length} native ids seen in their state in both themes; ${misses.length - failing.length} transient misses.`);
  console.log(`Screenshots: ${THEMES.map((t) => `${t} ${shots[t].size}/${SHOTS.length}`).join(', ')}.`);
  if (losses.length) console.log(`The device was lost ${losses.length} time(s): ${losses.map((l) => `${l.theme}, ${l.segment}: ${l.back ? 'back' : 'not back'}`).join('; ')}.`);
  if (failures.length) console.log(`\n${failures.length} failures:\n${failures.map((f) => `  - ${f}`).join('\n')}`);
  return failures.length;
}

// ---- a lost device -------------------------------------------------------------------------------------------------

/** How many times the walk waits for a lost device before it calls it gone: each wait can take 5 minutes. */
const RECOVERIES = 3;
/** The walk starts no segment after this, so its reports are written well inside the job's 75 minutes. */
const WALK_BUDGET_MS = 50 * 60_000;
const walkStarted = Date.now();

/** Each time the device was lost: { theme, segment, attempt, back, seconds, detail, file } */
const losses = [];

/** The guest's seconds since boot. A smaller number after a loss means the guest itself rebooted. */
function guestUptime() {
  try {
    return Number(adbOnce(['-s', serial, 'shell', 'cat', '/proc/uptime'], 10_000).toString().split(/\s+/)[0]) || undefined;
  } catch {
    return undefined;
  }
}

/** The runner's own view, by count only: whether the emulator process still runs, and the memory left. */
function host() {
  const run = (cmd, args) => {
    try {
      return execFileSync(cmd, args, { timeout: 10_000, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch (error) {
      return String(error.stdout ?? '').trim();
    }
  };
  const count = run('pgrep', ['-c', '-f', 'qemu-system']);
  const mem = run('free', ['-m']).match(/^Mem:\s+(\d+)\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d+)/m);
  return { emulators: count === '' ? undefined : Number(count), memory: mem ? `${mem[2]} of ${mem[1]} MB available` : 'unknown' };
}

/**
 * The device stopped answering: waits for it (adb reconnect, wait-for-device, sys.boot_completed), up to 5 minutes,
 * and says why it was lost as far as the runner and the guest can tell. Returns whether the device is back.
 */
async function recover(segment, attempt, error, uptimeBefore) {
  const started = Date.now();
  const before = host();
  const notes = [
    `${error.message}`,
    `the emulator process ${before.emulators === undefined ? 'could not be counted' : before.emulators ? 'still runs' : 'is gone'}; the runner has ${before.memory}`,
  ];
  say(`    DEVICE LOST: ${error.message}; ${notes[1]}`);
  let back = false;
  if (losses.length >= RECOVERIES) {
    notes.push(`the device was already lost ${losses.length} times, so the walk does not wait again`);
  } else if (before.emulators === 0) {
    notes.push('with no emulator process, nothing can come back');
  } else {
    try {
      adbOnce(['reconnect', 'offline'], 15_000);
    } catch {
      // adb may have nothing to reconnect; the wait below decides
    }
    try {
      adbOnce(['-s', serial, 'wait-for-device'], 120_000);
    } catch {
      // still not back after 2 minutes; the loop below gives it the rest of the 5
    }
    while (!back && Date.now() - started < 300_000) {
      try {
        back = adbOnce(['-s', serial, 'shell', 'getprop', 'sys.boot_completed'], 10_000).toString().trim() === '1';
      } catch {
        // not yet
      }
      if (!back) await sleep(2000);
    }
  }
  const seconds = Math.round((Date.now() - started) / 1000);
  let file = '';
  if (back) {
    const uptime = guestUptime();
    notes.push(uptime !== undefined && uptimeBefore !== undefined && uptime < uptimeBefore
      ? `the guest rebooted (up ${Math.round(uptime)} s, ${Math.round(uptimeBefore)} s at the segment's start)`
      : 'the guest ran on: only adb lost it');
    // after a reboot the screen may be locked; the action unlocks it the same way after its boot
    try {
      adbOnce(['-s', serial, 'shell', 'input', 'keyevent', '82'], 10_000);
    } catch {
      // the segment's cold start will say if the screen is not usable
    }
    // what the guest logged: a crash or a watchdog line says which part of the system went
    try {
      mkdirSync(join(out, 'failures'), { recursive: true });
      file = join('failures', `device-lost-${theme}-${segment.replaceAll(/[^a-z0-9]+/gi, '-')}-${attempt}.txt`);
      const log = (args) => {
        try {
          return adbOnce(['-s', serial, 'logcat', '-d', ...args], 30_000).toString();
        } catch (e) {
          return `(${e.message.split('\n')[0]})\n`;
        }
      };
      writeFileSync(join(out, file), `${notes.join('\n')}\n\n== crash buffer\n${log(['-b', 'crash'])}\n== the last 500 lines\n${log(['-b', 'main,system', '-t', '500'])}`);
    } catch {
      file = '';
    }
  }
  losses.push({ theme, segment, attempt, back, seconds, detail: notes.slice(1).join('; '), file });
  say(`    ${back ? `the device came back after ${seconds} s` : `the device did not come back (${seconds} s)`}: ${notes.slice(1).join('; ')}`);
  if (!back) deviceGone = `the emulator went offline in "${segment}" (${theme}) and did not come back: ${notes.slice(1).join('; ')}`;
  return back;
}

// ---- the run -------------------------------------------------------------------------------------------------------

/** One segment, retried once if the device was lost and came back. Returns why it stopped, or '' when it ran through. */
async function runSegment(name, walk) {
  for (let attempt = 1; ; attempt++) {
    if (deviceGone) return `device lost: ${deviceGone}`;
    const ownChecks = checks.length;
    const uptime = guestUptime();
    try {
      await walk();
      return '';
    } catch (error) {
      if (!(error instanceof DeviceLost)) return String(error?.message ?? error).split('\n')[0];
      const back = deviceGone ? false : await recover(name, attempt, error, uptime);
      if (back && attempt === 1) {
        // the retry runs this attempt's checks again, on a device that is back
        checks.splice(ownChecks);
        say(`    retrying "${name}" from a cold start`);
        continue;
      }
      return back ? `${error.message}, again on the retry after the device came back` : `device lost: ${deviceGone}`;
    }
  }
}

const problems = planProblems();
if (problems.length) {
  console.error(`The walk's plan does not match the spec:\n${problems.join('\n')}`);
  process.exit(1);
}
mkdirSync(out, { recursive: true });
let failed = 0;
try {
  for (theme of THEMES) {
    say(`${theme}:`);
    for (const [name, walk] of SEGMENTS) {
      say(`  ${name}`);
      const why = Date.now() - walkStarted > WALK_BUDGET_MS
        ? `not started: the walk had used its ${WALK_BUDGET_MS / 60_000} minutes`
        : await runSegment(name, walk);
      if (!why) continue;
      stopped[theme][name] = why;
      say(`    STOPPED: ${why}`);
      if (deviceGone || why.startsWith('not started')) continue;
      try {
        mkdirSync(join(out, 'failures'), { recursive: true });
        const file = `${theme}-${name.replaceAll(/[^a-z0-9]+/gi, '-')}`;
        writeFileSync(join(out, 'failures', `${file}.png`), adb('exec-out', 'screencap', '-p'));
        dump();
        writeFileSync(join(out, 'failures', `${file}.xml`), lastXml);
      } catch {
        // the device went with the segment; the report still says what stopped
      }
    }
  }
} finally {
  failed = reports();
  try {
    shell('cmd', 'uimode', 'night', 'no');
  } catch {
    // the device is gone
  }
}
process.exit(failed ? 1 : 0);
