#!/usr/bin/env node
// Drives the installed app on ONE Android emulator, in CI only (.github/workflows/build.yml, job "screenshots"):
//
//   1. captures every screen, light and dark, under round one's names -> build/screenshots/{light,dark}/NN-name.png
//   2. dumps UiAutomator's tree (the tree Appium's UiAutomator2 driver reads) in each state, and writes which spec ids
//      appeared there as resource-id -> build/screenshots/android-ids.md
//
// It talks to the emulator through adb only, by its serial ($ANDROID_SERIAL, default emulator-5554). Never run it on
// a machine with other devices attached: it installs nothing, but it taps, types and switches the system theme.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'build/screenshots');
const serial = process.env.ANDROID_SERIAL ?? 'emulator-5554';
const PACKAGE = 'com.nthcase.sample';

const adb = (...args) => execFileSync('adb', ['-s', serial, ...args], { maxBuffer: 64 * 1024 * 1024 });
const shell = (...args) => adb('shell', ...args).toString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- the UiAutomator tree ----------------------------------------------------------------------------------------

const seenIds = new Set();

function decode(s) {
  return s.replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
}

/** The current window's nodes, as UiAutomator dumps them. A dump can fail while something animates; it is retried. */
function dump() {
  let xml = '';
  for (let attempt = 0; attempt < 5 && !xml.includes('<hierarchy'); attempt++) {
    shell('rm', '-f', '/sdcard/mossgrove-ui.xml');
    shell('uiautomator', 'dump', '/sdcard/mossgrove-ui.xml');
    xml = adb('exec-out', 'cat', '/sdcard/mossgrove-ui.xml').toString();
  }
  const nodes = [...xml.matchAll(/<node ([^>]*?)\/?>/g)].map(([, attrs]) => {
    const a = Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, decode(v)]));
    const [x1, y1, x2, y2] = (a.bounds.match(/\d+/g) ?? [0, 0, 0, 0]).map(Number);
    return { id: a['resource-id'], text: a.text, desc: a['content-desc'], x: (x1 + x2) / 2, y: (y1 + y2) / 2, h: y2 - y1 };
  });
  nodes.forEach((n) => n.id && seenIds.add(n.id));
  return nodes;
}

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

async function tap(node) {
  shell('input', 'tap', String(Math.round(node.x)), String(Math.round(node.y)));
  await sleep(700);
}
const tapId = async (id) => tap(await byId(id));
const tapText = async (text) => tap(await byText(text));

async function type(id, text) {
  await tapId(id);
  shell('input', 'text', text.replaceAll(' ', '%s'));
  await sleep(500);
  await hideKeyboard();
}

async function clear(id) {
  await tapId(id);
  shell('input', 'keyevent', 'KEYCODE_MOVE_END');
  for (let i = 0; i < 4; i++) shell('input', 'keyevent', ...Array(10).fill('KEYCODE_DEL'));
}

async function hideKeyboard() {
  if (/mInputShown=true/.test(shell('dumpsys', 'input_method'))) {
    shell('input', 'keyevent', 'KEYCODE_BACK');
    await sleep(500);
  }
}

const { width, height } = (() => {
  const m = shell('wm', 'size').match(/(\d+)x(\d+)/);
  return { width: Number(m[1]), height: Number(m[2]) };
})();

/** Swipes the content up (to see what is below) until [id] is on screen. */
async function scrollTo(id) {
  for (let i = 0; i < 12; i++) {
    const hit = dump().find((n) => n.id === id && n.y > height * 0.15 && n.y < height * 0.85);
    if (hit) return hit;
    shell('input', 'swipe', String(width / 2), String(height * 0.7), String(width / 2), String(height * 0.35), '400');
    await sleep(600);
  }
  throw new Error(`could not scroll to ${id}`);
}

async function scrollToTop() {
  for (let i = 0; i < 6; i++) shell('input', 'swipe', String(width / 2), String(height * 0.35), String(width / 2), String(height * 0.8), '200');
  await sleep(600);
}

// ---- the app -------------------------------------------------------------------------------------------------------

async function coldStart(theme) {
  shell('am', 'force-stop', PACKAGE);
  shell('cmd', 'uimode', 'night', theme === 'dark' ? 'yes' : 'no');
  await sleep(800);
  shell('am', 'start', '-W', '-n', `${PACKAGE}/.MainActivity`);
  await byId('signin_screen', 30_000);
}

async function signIn() {
  await tapId('signin_use_test_account');
  await tapId('signin_submit');
  await byId('shop_list', 15_000);
}

/** The picture first (a 3 s spinner does not wait), then the tree for the id report. */
async function capture(theme, name) {
  await sleep(600);
  const png = adb('exec-out', 'screencap', '-p');
  mkdirSync(join(out, theme), { recursive: true });
  writeFileSync(join(out, theme, `${name}.png`), png);
  console.log(`  ${theme}/${name}.png`);
  dump();
}

async function waitForSnackbarToGo() {
  const end = Date.now() + 12_000;
  while (dump().some((n) => n.id === 'snackbar') && Date.now() < end) await sleep(1000);
}

async function run(theme) {
  console.log(`${theme}:`);
  await coldStart(theme);
  await capture(theme, '01-sign-in');
  await type('signin_email', 'tester@mossgrove.test');
  await type('signin_password', 'letmein1');
  await tapId('signin_submit');
  await byId('signin_error');
  await capture(theme, '02-sign-in-error');
  await signIn();
  await capture(theme, '03-shop');
  await type('shop_search', 'lamp');
  await capture(theme, '04-shop-search');
  await clear('shop_search');
  await type('shop_search', 'velvet');
  await byId('shop_empty');
  await capture(theme, '05-shop-no-match');
  await tapId('shop_empty_action');
  await hideKeyboard();

  await tapId('shop_item_1');
  await byId('item_add_to_cart');
  await capture(theme, '06-item');
  await tapId('item_add_to_cart');
  await byId('snackbar');
  await capture(theme, '07-item-snackbar');
  await tapId('snackbar_action');
  await byId('cart_total');
  await capture(theme, '08-cart');
  await tapId('cart_checkout');
  await byId('dialog_confirm');
  await capture(theme, '09-cart-dialog');
  await tapId('dialog_confirm');
  await byId('cart_empty');
  await waitForSnackbarToGo();
  await capture(theme, '10-cart-empty');

  await tapId('nav_lab');
  await byId('lab_form');
  await capture(theme, '11-lab');

  await tapId('lab_form');
  await tap(await scrollTo('form_submit'));
  await scrollToTop();
  await byId('form_name_error');
  await capture(theme, '12-form-errors');
  await type('form_name', 'Sam Rivera');
  await type('form_email', 'sam@example.test');
  await type('form_age', '34');
  await type('form_password', 'garden42x');
  await tap(await scrollTo('form_category'));
  await tapId('form_category_option_garden');
  await tap(await scrollTo('form_date'));
  await byId('form_date_picker');
  await tapText('15');
  await tapId('form_date_confirm');
  await tap(await scrollTo('form_terms'));
  await tap(await scrollTo('form_submit'));
  await scrollTo('form_result');
  await waitForSnackbarToGo();
  await capture(theme, '13-form-done');
  await tapId('top_bar_back');

  await tapId('lab_gestures');
  await byId('gestures_status');
  await capture(theme, '14-gestures');
  await scrollTo('gestures_scroll_target');
  await tapId('top_bar_back');

  await tapId('lab_webview');
  await byText('Care guide loaded', 15_000);
  await sleep(1000);
  await capture(theme, '15-webview');
  await tapId('top_bar_back');

  await tap(await byId('lab_slow'));
  await capture(theme, '16-slow-loading');
  await byId('slow_content', 8000);
  await capture(theme, '17-slow-done');
  await tapId('top_bar_back');

  await tapId('lab_orders');
  await byId('orders_row_1');
  await capture(theme, '18-orders');
  await tapId('top_bar_back');

  await tapId('nav_settings');
  await byId('settings_version');
  await capture(theme, '22-settings');
  await tap(await scrollTo('settings_reset'));
  await byId('settings_reset_confirm');
  await capture(theme, '23-settings-dialog');
  await tapId('settings_reset_confirm');
  await waitForSnackbarToGo();
  await tap(await scrollTo('settings_fail_loading'));
  await tapId('nav_lab');
  await tapId('lab_orders');
  await byId('orders_error');
  await capture(theme, '20-orders-error');
  await tapId('orders_retry');
  await byId('orders_empty');
  await capture(theme, '19-orders-empty');
  await tapId('top_bar_back');

  // the states only the id proof needs: slow and failed loads, the open dropdown
  await tapId('nav_shop');
  await byId('shop_error');
  await tapId('shop_retry');
  await tapId('nav_settings');
  await tap(await scrollTo('settings_fail_loading'));
  await tap(await scrollTo('settings_slow_loading'));
  await tapId('nav_shop');
  await byId('shop_loading');
  await tapId('nav_lab');
  await tapId('lab_orders');
  await byId('orders_loading');
  await tapId('top_bar_back');
  await tapId('lab_form');
  await tap(await scrollTo('form_category'));
  await byId('form_category_option_kitchen');
  shell('input', 'keyevent', 'KEYCODE_BACK');
  await sleep(500);
  await tapId('top_bar_back');

  await tapId('lab_gift_cards');
  await byText('Check a balance');
  await tapText('Choose');
  await byText('A $25 card with the Fern design');
  await capture(theme, '21-gift-cards');

  shell('am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', 'nthcase-sample://item/999', PACKAGE);
  await byId('item_not_found', 15_000);
  await capture(theme, '24-deep-link-unknown');
}

// ---- the id report ------------------------------------------------------------------------------------------------

function idReport() {
  const spec = JSON.parse(readFileSync(join(root, 'nthcase/test-ids.json'), 'utf8')).ids.filter((e) => !e.id.startsWith('web_'));
  const rows = spec.map((e) => {
    const pattern = new RegExp(`^${e.id.replace(/\{\w+\}/g, '\\w+')}$`);
    const hits = [...seenIds].filter((id) => pattern.test(id)).sort();
    return { id: e.id, hits };
  });
  const missing = rows.filter((r) => r.hits.length === 0);
  const lines = [
    '# Spec ids in the Android UiAutomator tree',
    '',
    `Read with \`uiautomator dump\` on the CI emulator: the tree Appium's UiAutomator2 driver reads. ${rows.length - missing.length} of ${rows.length} native ids were seen as \`resource-id\`.`,
    '',
    '| Id | Seen as resource-id |',
    '| --- | --- |',
    ...rows.map((r) => `| \`${r.id}\` | ${r.hits.length ? r.hits.slice(0, 3).join(', ') + (r.hits.length > 3 ? ', …' : '') : '**not seen**'} |`),
    '',
    `Not seen: ${missing.length ? missing.map((r) => `\`${r.id}\``).join(', ') : 'none'}.`,
  ];
  writeFileSync(join(out, 'android-ids.md'), lines.join('\n') + '\n');
  console.log(lines.slice(0, 3).join('\n'));
  if (missing.length) console.log(`not seen: ${missing.map((r) => r.id).join(' ')}`);
}

mkdirSync(out, { recursive: true });
try {
  for (const theme of ['light', 'dark']) await run(theme);
} finally {
  idReport();
  shell('cmd', 'uimode', 'night', 'no');
}
