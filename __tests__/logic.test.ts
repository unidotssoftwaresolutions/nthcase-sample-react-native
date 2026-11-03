import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { findItemByRawId, formatPrice, itemNumber, ITEMS, search } from '../src/data/catalog';
import { itemIdFromLink, linkForItem } from '../src/data/deepLinks';
import {
  pinchResult,
  rotateResult,
  rotationText,
  ShakeDetector,
  swipeDirection,
  TwoFingerTracker,
  zoomText,
} from '../src/data/gestures';
import { ageInput, budgetFromFraction, EMPTY_FORM, formatPickedDate, formErrors, FormErrors, welcomeMessage } from '../src/data/rules';
import { actions, credentialsMatch, getState, itemCount, totalCents } from '../src/data/store';
import { ART_BASE, GLYPHS, ICONS } from '../src/generated/art';
import { CARE_GUIDE_HTML } from '../src/generated/careGuide';
import { dropsOnTarget } from '../src/screens/GesturesScreen';
import { allowNavigation } from '../src/screens/WebViewScreen';
import { cartTabLabel } from '../src/ui/TabBar';

const root = join(__dirname, '..');

describe('the catalogue (SPEC.md §3)', () => {
  it('has forty items, numbered 1–40 in order, with fixed prices', () => {
    expect(ITEMS).toHaveLength(40);
    expect(ITEMS.map((i) => i.id)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
    expect(ITEMS[0]).toMatchObject({ name: 'Stoneware Mug', category: 'kitchen', glyph: 'mug', priceCents: 1400 });
    expect(ITEMS[6]).toMatchObject({ name: 'Wall Clock', category: 'home', priceCents: 3500 });
    expect(ITEMS[39]).toMatchObject({ name: 'Fruit Bowl', category: 'kitchen', priceCents: 3400 });
  });

  it('is SPEC.md §3, row for row: number, name, aisle, drawing, price and description', () => {
    const spec = readFileSync(join(root, 'SPEC.md'), 'utf8');
    const rows = [...spec.matchAll(/^\| (\d{3}) \| (.+?) \| \w+ \(`(\w+)`\) \| (\w+) \| \$(\d+)\.(\d{2}) \| (.+?) \|$/gm)];
    expect(rows).toHaveLength(40);
    expect(ITEMS.map((i) => [i.id, i.name, i.category, i.glyph, i.priceCents, i.description])).toEqual(
      rows.map((r) => [Number(r[1]), r[2], r[3], r[4], Number(r[5]) * 100 + Number(r[6]), r[7]]),
    );
  });

  it('writes numbers and prices the same way everywhere', () => {
    expect(itemNumber(7)).toBe('No. 007');
    expect(itemNumber(40)).toBe('No. 040');
    expect(formatPrice(1400)).toBe('$14.00');
    expect(formatPrice(950)).toBe('$9.50');
    expect(formatPrice(8900)).toBe('$89.00');
  });

  it('searches by name anywhere, ignoring case, or by number exactly', () => {
    expect(search('lamp').map((i) => i.name)).toEqual(['Brass Desk Lamp', 'Clip Reading Lamp', 'Floor Lamp', 'Bedside Lamp']);
    expect(search('LAMP')).toHaveLength(4);
    for (const q of ['7', '007', 'No. 007', 'no. 7']) expect(search(q).map((i) => i.id)).toEqual([7]);
    expect(search('velvet')).toEqual([]);
    expect(search('   ')).toHaveLength(40);
  });

  it('reads an id as written, so an unknown one can say so', () => {
    expect(findItemByRawId('7')?.name).toBe('Wall Clock');
    expect(findItemByRawId('007')?.id).toBe(7);
    for (const raw of ['0', '41', '999', 'abc', '', '7a']) expect(findItemByRawId(raw)).toBeUndefined();
  });
});

describe('the cart and orders', () => {
  beforeEach(() => actions.reset());

  it('keeps one line per item in the order first added, within 1–9', () => {
    actions.addToCart(1, 2);
    actions.addToCart(5, 1);
    actions.addToCart(1, 8);
    expect(getState().cart).toEqual([{ itemId: 1, quantity: 9 }, { itemId: 5, quantity: 1 }]);
    actions.setQuantity(5, 0);
    expect(getState().cart[1].quantity).toBe(1);
    expect(itemCount(getState().cart)).toBe(10);
    expect(totalCents(getState().cart)).toBe(9 * 1400 + 4200);
    actions.removeLine(1);
    expect(getState().cart).toEqual([{ itemId: 5, quantity: 1 }]);
    expect(() => actions.addToCart(41, 1)).toThrow();
  });

  it('moves the cart into a numbered order, newest first', () => {
    actions.addToCart(5, 1);
    expect(actions.placeOrder().number).toBe(1);
    actions.addToCart(1, 2);
    expect(actions.placeOrder().number).toBe(2);
    expect(getState().orders.map((o) => o.number)).toEqual([2, 1]);
    expect(getState().cart).toEqual([]);
  });

  it('says the cart count in the tab label', () => {
    expect(cartTabLabel(0)).toBe('Cart');
    expect(cartTabLabel(1)).toBe('Cart, 1 item');
    expect(cartTabLabel(2)).toBe('Cart, 2 items');
  });

  it('matches the email ignoring case and spaces, and the password exactly', () => {
    expect(credentialsMatch('  Tester@Mossgrove.TEST ', 'Mossgrove123')).toBe(true);
    expect(credentialsMatch('tester@mossgrove.test', 'mossgrove123')).toBe(false);
    expect(credentialsMatch('tester@mossgrove.test', 'letmein1')).toBe(false);
  });

  it('starts cold: signed out, empty, defaults', () => {
    actions.signIn('tester@mossgrove.test');
    actions.setSlowLoading(true);
    actions.reset();
    expect(getState()).toMatchObject({ signedInEmail: null, cart: [], orders: [], slowLoading: false, failFirstLoad: false, orderUpdates: false, themeMode: 'system' });
  });
});

describe('the club form (SPEC.md §5)', () => {
  it('names every invalid field with the spec text', () => {
    expect(formErrors(EMPTY_FORM)).toEqual(FormErrors);
    expect(Object.values(FormErrors)).toEqual([
      'Enter your name',
      'Enter a valid email address',
      'Enter an age from 18 to 120',
      'Use at least 8 characters, including a number',
      'Choose a favourite aisle',
      'Choose a delivery date',
      'Accept the terms to continue',
    ]);
  });

  it('accepts a valid form', () => {
    const form = { ...EMPTY_FORM, name: 'Sam Rivera', email: 'sam@example.test', age: '34', password: 'garden42x', category: 'garden' as const, deliveryDate: '15 Nov 2026', acceptedTerms: true };
    expect(formErrors(form)).toEqual({});
    expect(formErrors({ ...form, email: 'sam@example' }).email).toBe(FormErrors.email);
    expect(formErrors({ ...form, age: '17' }).age).toBe(FormErrors.age);
    expect(formErrors({ ...form, age: '121' }).age).toBe(FormErrors.age);
    expect(formErrors({ ...form, password: 'gardenxyz' }).password).toBe(FormErrors.password);
    expect(formErrors({ ...form, password: 'g4rden' }).password).toBe(FormErrors.password);
  });

  it('keeps the age to three digits, the budget to $10 steps, and writes dates as d MMM yyyy', () => {
    expect(ageInput('3a4b5c6')).toBe('345');
    expect(budgetFromFraction(0.6)).toBe(120);
    expect(budgetFromFraction(0.25)).toBe(50);
    expect(budgetFromFraction(1.4)).toBe(200);
    expect(budgetFromFraction(-1)).toBe(0);
    expect(formatPickedDate(2026, 10, 15)).toBe('15 Nov 2026');
    expect(welcomeMessage(' Sam Rivera ', 'sam@example.test', 'Garden', '15 Nov 2026')).toBe(
      "Welcome, Sam Rivera. We'll write to sam@example.test about the Garden aisle and deliver on 15 Nov 2026.",
    );
  });
});

describe('gestures (SPEC.md §5, Gestures)', () => {
  it('finds a swipe by its longest axis, from 48 dp', () => {
    expect(swipeDirection(-120, 10)).toBe('left');
    expect(swipeDirection(120, -60)).toBe('right');
    expect(swipeDirection(30, -90)).toBe('up');
    expect(swipeDirection(0, 48)).toBe('down');
    expect(swipeDirection(40, 40)).toBeNull();
  });

  it('measures two fingers: zoom by distance, rotation clockwise positive', () => {
    const t = new TwoFingerTracker();
    t.move([{ x: 100, y: 100 }, { x: 200, y: 100 }]);
    t.move([{ x: 50, y: 100 }, { x: 250, y: 100 }]);
    expect(t.zoom).toBeCloseTo(2);
    const r = new TwoFingerTracker();
    r.move([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    r.move([{ x: 0, y: 0 }, { x: 100 * Math.cos(Math.PI / 6), y: 100 * Math.sin(Math.PI / 6) }]);
    expect(r.rotation).toBeCloseTo(30);
  });

  it('counts a pinch over 5 % and a turn over 10°', () => {
    expect(pinchResult(1, 1.04)).toBeNull();
    expect(pinchResult(1, 2)).toEqual({ zoom: 2, word: 'Pinched out' });
    expect(pinchResult(1, 0.5)).toEqual({ zoom: 0.5, word: 'Pinched in' });
    expect(pinchResult(2, 4)?.zoom).toBe(3);
    expect(rotateResult(0, 9)).toBeNull();
    expect(rotateResult(0, 30)).toEqual({ rotation: 30, word: 'Rotated clockwise' });
    expect(rotateResult(0, -45)).toEqual({ rotation: -45, word: 'Rotated counter-clockwise' });
    expect(zoomText(1)).toBe('Zoom 1.0×');
    expect(rotationText(29.6)).toBe('Rotation 30°');
  });

  it('shakes on three jolts over 2.5 g within a second', () => {
    let shakes = 0;
    const d = new ShakeDetector(() => (shakes += 1));
    d.onReading(0, 0, 1, 0);
    d.onReading(3, 0, 0, 100);
    d.onReading(0, 3, 0, 1300);
    d.onReading(0, 0, 3, 1400);
    expect(shakes).toBe(0);
    d.onReading(2, 2, 0, 1500);
    expect(shakes).toBe(1);
  });

  it('drops the label when its centre lands in the drawer', () => {
    const source = { x: 0, y: 20, width: 120, height: 56 };
    const target = { x: 144, y: 0, width: 200, height: 96 };
    expect(dropsOnTarget(source, target, 180, 0)).toBe(true);
    expect(dropsOnTarget(source, target, 20, 0)).toBe(false);
    expect(dropsOnTarget(source, target, 180, 200)).toBe(false);
  });
});

describe('the deep link and the web view', () => {
  it('reads nthcase-sample://item/{id} and ignores anything else', () => {
    expect(itemIdFromLink('nthcase-sample://item/7')).toBe('7');
    expect(itemIdFromLink('nthcase-sample://item/999/')).toBe('999');
    expect(itemIdFromLink('nthcase-sample://item/abc?x=1')).toBe('abc');
    for (const other of ['nthcase-sample://cart/7', 'nthcase-sample://item/', 'nthcase-sample://item/7/8', 'https://example.test/item/7', '/item/7', '', null]) {
      expect(itemIdFromLink(other)).toBeNull();
    }
    expect(linkForItem(7)).toBe('nthcase-sample://item/7');
  });

  it('lets the page move within itself and nowhere else', () => {
    expect(allowNavigation('about:blank')).toBe(true);
    expect(allowNavigation('about:blank#web_washing')).toBe(true);
    for (const url of ['https://example.test/', 'http://localhost:8081/', 'file:///etc/hosts', 'nthcase-sample://item/7', 'javascript:alert(1)']) {
      expect(allowNavigation(url)).toBe(false);
    }
  });
});

describe('derived files match their sources (scripts/derive-assets.mjs)', () => {
  it('loads the bundled page byte for byte', () => {
    const page = readFileSync(join(root, 'assets/web/care-guide.html'), 'utf8');
    expect(CARE_GUIDE_HTML).toBe(page);
    expect(createHash('sha256').update(CARE_GUIDE_HTML).digest('hex')).toBe(createHash('sha256').update(page).digest('hex'));
  });

  it('has a 1x, 2x and 3x PNG for every drawing in art/', () => {
    for (const kind of ['icons', 'glyphs'] as const) {
      const svgs = readdirSync(join(root, 'art', kind)).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)).sort();
      expect(Object.keys(kind === 'icons' ? ICONS : GLYPHS).sort()).toEqual(svgs);
      for (const name of svgs) {
        for (const suffix of ['', '@2x', '@3x']) {
          const png = join(root, 'assets/art', kind, `${name}${suffix}.png`);
          expect(existsSync(png)).toBe(true);
          const scale = suffix === '' ? 1 : Number(suffix[1]);
          // PNG width: bytes 16–19 of the IHDR chunk
          expect(readFileSync(png).readUInt32BE(16)).toBe(ART_BASE[kind] * scale);
        }
      }
    }
  });
});
