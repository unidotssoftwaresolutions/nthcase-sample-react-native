/*
 * The Lobby (SPEC.md §5, 1.1), on the whole app with its real router, screens and state:
 *   - the tree: the order of the scrollers on the screen in front, with the pager on and off; the pager absent when
 *     off; Saved absent from the bar until its delay; the choices kept until a cold start;
 *   - the scenarios' flows (nthcase/scenarios/12–17 and 19), with the touch log checked as they check it;
 *   - what Pressable decides when UiScrollable's own swipe crosses a tile, played into its responder.
 * The preset's fake timers stand in for the delays, the 300 ms double-tap wait and the long-press timer.
 */
import { act, fireEvent, screen } from 'expo-router/testing-library';
import { Platform } from 'react-native';

import { Lobby } from '../src/data/lobby';
import { actions, getState } from '../src/data/store';
import { TemplateIds, TestIds } from '../src/testIds';
import { launchSignedIn, tap } from '../test/app';
import { allIds, hostRoots, scrollablesInFront, type HostNode } from '../test/tree';

const byId = (id: string) => screen.getByTestId(id);
const wait = (ms: number) => act(() => jest.advanceTimersByTime(ms));
const logShows = (text: string) => expect(byId(TestIds.LOBBY_TOUCH_LOG)).toHaveTextContent(text, { exact: false });
const logIs = (text: string) => expect(byId(TestIds.LOBBY_TOUCH_LOG)).toHaveTextContent(text);
const count = (n: number) => expect(byId(TestIds.LOBBY_TOUCH_COUNT)).toHaveTextContent(`Touches: ${n}`);
/** A tap, as a person makes it: Pressable's press, then the double-tap time with no second press. */
const tapAndSettle = async (id: string) => {
  await tap(id);
  await wait(300);
};
/** Every id anywhere in the rendered tree, the hidden screens included: "absent" means absent from all of it. */
const anywhere = () => allIds(hostRoots());
const PAGER_IDS = [TestIds.LOBBY_PAGER, TestIds.LOBBY_PAGER_POSITION, TestIds.LOBBY_PAGER_AUTO, ...[1, 2, 3, 4, 5].map(TemplateIds.lobbyBanner)];

async function openLobby() {
  await tap(TestIds.NAV_LAB);
  await tap(TestIds.LAB_LOBBY);
  await screen.findByTestId(TestIds.LOBBY_SCREEN);
}

/** A scroll as the platform reports it, to a scroller's own onScroll (FlatList's included). */
async function scrollTo(id: string, x: number, y: number, viewport = { width: 360, height: 240 }) {
  await fireEvent.scroll(byId(id), {
    nativeEvent: {
      contentOffset: { x, y },
      contentSize: { width: 3000, height: 3000 },
      layoutMeasurement: viewport,
      zoomScale: 1,
    },
  });
}

/** The phone's width for a row's position line: a layout pass 360 wide, as on a 360 dp phone. */
async function layOut(id: string, width = 360) {
  await fireEvent(byId(id), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width, height: 100 } } });
}

/** System Back on the quick sheet: what Android's Back does to a Modal, its onRequestClose. */
async function sheetBack() {
  type Node = { props: { onRequestClose?: () => void }; parent: Node | null };
  let node: Node | null = byId(TestIds.LOBBY_SHEET) as unknown as Node;
  while (node && typeof node.props.onRequestClose !== 'function') node = node.parent;
  if (!node) throw new Error('no Modal holds the sheet');
  const close = node.props.onRequestClose!;
  await act(() => close());
}

function barItems(): string[] {
  const bar = byId(TestIds.LOBBY_BAR) as unknown as HostNode;
  return [...allIds([bar])].filter((id) => id !== TestIds.LOBBY_BAR);
}

describe('the tree: what Appium meets first', () => {
  it('with the pager on, the pager is the first scrollable, then the Top 10 row, then the page', async () => {
    await launchSignedIn();
    await openLobby();
    const order = scrollablesInFront().map((s) => s.id);
    expect(order.slice(0, 3)).toEqual([TestIds.LOBBY_PAGER, TestIds.LOBBY_TOP_ROW, TestIds.LOBBY_PAGE]);
    // and then the page's own scrollers, in the page's order
    expect(order.slice(3)).toEqual([
      TestIds.LOBBY_CHIPS,
      ...[1, 2, 3, 4].map(TemplateIds.lobbyRow),
      TestIds.LOBBY_INNER_LIST,
      TestIds.LOBBY_BOARD,
    ]);
    const first = scrollablesInFront()[0];
    expect(first.horizontal).toBe(true);
    // the pager is a FlatList with pagingEnabled, outside the page's ScrollView
    expect(byId(TestIds.LOBBY_PAGER).props.pagingEnabled).toBe(true);
  });

  it('with the pager off, the pager is gone from the tree and the Top 10 row is the first scrollable', async () => {
    await launchSignedIn();
    await openLobby();
    await fireEvent(byId(TestIds.LOBBY_PAGER_SHOWN), 'valueChange', false);
    expect(getState().lobbyPagerShown).toBe(false);
    const ids = anywhere();
    expect(PAGER_IDS.filter((id) => ids.has(id))).toEqual([]);
    expect(scrollablesInFront()[0]).toEqual({ id: TestIds.LOBBY_TOP_ROW, horizontal: true });
    expect(scrollablesInFront()[1].id).toBe(TestIds.LOBBY_PAGE);
    logIs(Lobby.NOTHING_TOUCHED);

    // kept when the Lobby is left and opened again, until a cold start
    await tap(TestIds.TOP_BAR_BACK);
    await tap(TestIds.LAB_LOBBY);
    await screen.findByTestId(TestIds.LOBBY_SCREEN);
    expect(scrollablesInFront()[0].id).toBe(TestIds.LOBBY_TOP_ROW);
    expect(anywhere().has(TestIds.LOBBY_PAGER)).toBe(false);

    // on again: the first order, on the banner it showed
    await fireEvent(byId(TestIds.LOBBY_PAGER_SHOWN), 'valueChange', true);
    expect(scrollablesInFront().slice(0, 3).map((s) => s.id)).toEqual([TestIds.LOBBY_PAGER, TestIds.LOBBY_TOP_ROW, TestIds.LOBBY_PAGE]);
  });

  it('a cold start shows the pager and chooses 0 s, whatever the last run chose', async () => {
    await act(() => {
      actions.setLobbyPagerShown(false);
      actions.setLobbySavedDelay(12);
    });
    await launchSignedIn();
    await openLobby();
    expect(scrollablesInFront()[0].id).toBe(TestIds.LOBBY_PAGER);
    expect(byId(TemplateIds.lobbySavedDelay(0)).props.accessibilityState).toMatchObject({ selected: true });
    expect(anywhere().has(TestIds.LOBBY_BAR_SAVED)).toBe(true);
  });

  it('Saved is absent from the bar until its delay has passed, counted from the choice', async () => {
    await launchSignedIn();
    await openLobby();
    // 0 s, the default: four items at once
    expect(barItems()).toEqual([TestIds.LOBBY_BAR_HOME, TestIds.LOBBY_BAR_LIVE, TestIds.LOBBY_BAR_SAVED, TestIds.LOBBY_BAR_OFFERS]);

    await tap(TemplateIds.lobbySavedDelay(12));
    expect(anywhere().has(TestIds.LOBBY_BAR_SAVED)).toBe(false);
    expect(barItems()).toEqual([TestIds.LOBBY_BAR_HOME, TestIds.LOBBY_BAR_LIVE, TestIds.LOBBY_BAR_OFFERS]);
    await wait(11_800);
    expect(anywhere().has(TestIds.LOBBY_BAR_SAVED)).toBe(false);
    await wait(400);
    expect(anywhere().has(TestIds.LOBBY_BAR_SAVED)).toBe(true);
    logIs(Lobby.NOTHING_TOUCHED);

    // choosing again starts the count again, even the same delay
    await tap(TemplateIds.lobbySavedDelay(12));
    expect(anywhere().has(TestIds.LOBBY_BAR_SAVED)).toBe(false);
    await wait(6000);
    await tap(TemplateIds.lobbySavedDelay(3));
    await wait(2900);
    expect(anywhere().has(TestIds.LOBBY_BAR_SAVED)).toBe(false);
    await wait(200);
    expect(anywhere().has(TestIds.LOBBY_BAR_SAVED)).toBe(true);

    // the choice is kept when the Lobby opens again, and the count starts at the opening
    await tap(TestIds.TOP_BAR_BACK);
    await tap(TestIds.LAB_LOBBY);
    await screen.findByTestId(TestIds.LOBBY_SCREEN);
    expect(byId(TemplateIds.lobbySavedDelay(3)).props.accessibilityState).toMatchObject({ selected: true });
    expect(anywhere().has(TestIds.LOBBY_BAR_SAVED)).toBe(false);
    await wait(3100);
    expect(anywhere().has(TestIds.LOBBY_BAR_SAVED)).toBe(true);
    expect(getState().lobbySavedDelay).toBe(3);
  });

  it('the board is one scroller on iOS and two on Android, the outer one carrying the id', async () => {
    await launchSignedIn();
    await openLobby();
    expect(Platform.OS).toBe('ios');
    const ios = scrollablesInFront().filter((s) => s.id === TestIds.LOBBY_BOARD || s.id === '(no id)');
    expect(ios).toEqual([{ id: TestIds.LOBBY_BOARD, horizontal: false }]);
    await tap(TestIds.TOP_BAR_BACK);

    const os = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      await tap(TestIds.LAB_LOBBY);
      await screen.findByTestId(TestIds.LOBBY_SCREEN);
      const all = scrollablesInFront();
      const at = all.findIndex((s) => s.id === TestIds.LOBBY_BOARD);
      expect(all.slice(at)).toEqual([
        { id: TestIds.LOBBY_BOARD, horizontal: false },
        { id: '(no id)', horizontal: true },
      ]);
      // the cells are inside the inner one
      const board = byId(TestIds.LOBBY_BOARD) as unknown as HostNode;
      expect(allIds([board]).has(TemplateIds.lobbyBoardCell(13, 18))).toBe(true);
    } finally {
      os.restore();
    }
  });
});

describe('the scenarios’ flows', () => {
  it('12 · scrolling every scroller touches nothing', async () => {
    await launchSignedIn();
    await openLobby();
    logIs(Lobby.NOTHING_TOUCHED);
    await scrollTo(TestIds.LOBBY_PAGER, 360 * 2, 0);
    await scrollTo(TestIds.LOBBY_TOP_ROW, 300, 0);
    await scrollTo(TestIds.LOBBY_PAGE, 0, 2400);
    await scrollTo(TestIds.LOBBY_CHIPS, 200, 0);
    for (const row of [1, 2, 3, 4]) await scrollTo(TemplateIds.lobbyRow(row), 500, 0);
    await scrollTo(TestIds.LOBBY_INNER_LIST, 0, 600);
    await scrollTo(TestIds.LOBBY_BOARD, 400, 700);
    await scrollTo(TestIds.LOBBY_PAGE, 0, 0);
    await wait(1000);
    expect(byId(TestIds.LOBBY_FOOTER)).toHaveTextContent(Lobby.FOOTER, { exact: false });
    logIs(Lobby.NOTHING_TOUCHED);
    count(0);
  });

  it('13 · a tile deep in row 3: tap, back, long press, Back', async () => {
    await launchSignedIn();
    await openLobby();
    await layOut(TemplateIds.lobbyRow(3));
    expect(byId(TemplateIds.lobbyRowPosition(3))).toHaveTextContent('Row 3: tiles 1–3 of 20');
    // row 3 scrolled so tile 15 is the last whole tile: tile m starts at 16 + (m − 1) × 108
    const offset = 16 + 14 * 108 + 100 - 360;
    await scrollTo(TemplateIds.lobbyRow(3), offset, 0, { width: 360, height: 180 });
    expect(byId(TemplateIds.lobbyRowPosition(3))).toHaveTextContent('Row 3: tiles 13–15 of 20');
    expect(byId(TemplateIds.lobbyRowPosition(3)).props.accessibilityLabel).toBe('Row 3: tiles 13–15 of 20');
    logIs(Lobby.NOTHING_TOUCHED);

    await tap(TemplateIds.lobbyRowTile(3, 15));
    // a tap counts once the double-tap time has passed
    expect(screen.queryByTestId(TestIds.LOBBY_DETAIL)).toBeNull();
    await wait(300);
    expect(byId(TestIds.LOBBY_DETAIL)).toHaveTextContent('Bedside Lamp', { exact: false });
    expect(byId(TestIds.LOBBY_DETAIL)).toHaveTextContent('Row 3, tile 15', { exact: false });
    logIs('Tapped: Bedside Lamp (row 3, tile 15)');
    // the panel takes the place of the pager, the Top 10 row and the page; the log, the delay and the bar stay
    expect(screen.queryByTestId(TestIds.LOBBY_PAGE)).toBeNull();
    expect(screen.queryByTestId(TestIds.LOBBY_TOP_ROW)).toBeNull();
    expect(byId(TestIds.LOBBY_BAR)).toBeTruthy();

    await tap(TestIds.LOBBY_DETAIL_BACK);
    // row 3 kept its place
    expect(byId(TemplateIds.lobbyRow(3)).props.contentOffset).toEqual({ x: offset, y: 0 });
    // the row is laid out again as it mounts (the test renderer's window is 750 wide; a phone's row is its width)
    await layOut(TemplateIds.lobbyRow(3));
    expect(byId(TemplateIds.lobbyRowPosition(3))).toHaveTextContent('Row 3: tiles 13–15 of 20');

    await fireEvent(byId(TemplateIds.lobbyRowTile(3, 15)), 'longPress');
    expect(byId(TestIds.LOBBY_SHEET_TITLE)).toHaveTextContent('Bedside Lamp');
    for (const id of [TestIds.LOBBY_SHEET_OPEN, TestIds.LOBBY_SHEET_PREVIEW, TestIds.LOBBY_SHEET_SAVED, TestIds.LOBBY_SHEET_RATE]) expect(byId(id)).toBeTruthy();
    // system Back: the Modal's onRequestClose, with no log line
    await sheetBack();
    expect(screen.queryByTestId(TestIds.LOBBY_SHEET)).toBeNull();
    logIs('Long-pressed: Bedside Lamp (row 3, tile 15)\nTapped: Bedside Lamp (row 3, tile 15)');
    count(2);
  });

  it('14 · the board, both ways: pan to M18, tap, double-tap', async () => {
    await launchSignedIn();
    await openLobby();
    expect(byId(TestIds.LOBBY_BOARD_POSITION)).toHaveTextContent('Board: top-left A1');
    await scrollTo(TestIds.LOBBY_BOARD, 12 * 56, 17 * 56, { width: 280, height: 280 });
    expect(byId(TestIds.LOBBY_BOARD_POSITION)).toHaveTextContent('Board: top-left M18');
    expect(byId(TestIds.LOBBY_BOARD_POSITION).props.accessibilityLabel).toBe('Board: top-left M18');
    logIs(Lobby.NOTHING_TOUCHED);

    await tapAndSettle(TemplateIds.lobbyBoardCell(13, 18));
    logIs('Tapped: M18 (board)');
    await tap(TemplateIds.lobbyBoardCell(13, 18));
    await wait(120);
    await tap(TemplateIds.lobbyBoardCell(13, 18));
    await wait(400);
    logIs('Double-tapped: M18 (board)\nTapped: M18 (board)');
    count(2);
  });

  it('15 · the promo pager: three swipes, then banner 4', async () => {
    await launchSignedIn();
    await openLobby();
    // the pager pages by the window's width: 750 in the test renderer
    const width = 750;
    expect(byId(TestIds.LOBBY_PAGER_POSITION).props.accessibilityLabel).toBe('Banner 1 of 5');
    for (const page of [2, 3, 4]) {
      await scrollTo(TestIds.LOBBY_PAGER, (page - 1) * width, 0, { width, height: 104 });
      expect(byId(TestIds.LOBBY_PAGER_POSITION).props.accessibilityLabel).toBe(`Banner ${page} of 5`);
      expect(byId(TestIds.LOBBY_PAGER_POSITION)).toHaveTextContent(`Banner ${page} of 5`, { exact: false });
      logIs(Lobby.NOTHING_TOUCHED);
    }
    await tapAndSettle(TemplateIds.lobbyBanner(4));
    expect(byId(TestIds.LOBBY_PROMO)).toHaveTextContent('Candles for long evenings', { exact: false });
    expect(byId(TestIds.LOBBY_PROMO)).toHaveTextContent('Banner 4 of 5', { exact: false });
    expect(byId(TestIds.LOBBY_PROMO)).toHaveTextContent(Lobby.PROMO_NOTE, { exact: false });
    logIs('Tapped: Candles for long evenings (banner 4)');
    // Back closes the promo, and the pager is on banner 4 again
    await tap(TestIds.TOP_BAR_BACK);
    expect(byId(TestIds.LOBBY_PAGER).props.contentOffset).toEqual({ x: 3 * width, y: 0 });
    expect(byId(TestIds.LOBBY_PAGER_POSITION).props.accessibilityLabel).toBe('Banner 4 of 5');
  });

  it.each([
    ['16 · Saved comes late', 12],
    ['17 · Saved comes soon', 3],
  ])('%s (%i s), and nothing else is touched', async (_name, seconds) => {
    await launchSignedIn();
    await openLobby();
    expect(byId(TestIds.LOBBY_BAR)).toHaveTextContent('Saved', { exact: false });
    await tap(TemplateIds.lobbySavedDelay(seconds));
    expect(screen.queryByTestId(TestIds.LOBBY_BAR_SAVED)).toBeNull();
    logIs(Lobby.NOTHING_TOUCHED);
    await wait(seconds * 1000);
    await tap(TestIds.LOBBY_BAR_SAVED);
    expect(byId(TestIds.LOBBY_SAVED_SCREEN)).toHaveTextContent(Lobby.SAVED_EMPTY);
    logIs('Tapped: Saved (bar)');
    count(1);
    // Home closes Saved
    await tap(TestIds.LOBBY_BAR_HOME);
    expect(byId(TestIds.LOBBY_PAGE)).toBeTruthy();
    logShows('Tapped: Home (bar)');
  });

  it('19 · the pager off, a Top 10 tile, then Saved late', async () => {
    await launchSignedIn();
    await openLobby();
    await fireEvent(byId(TestIds.LOBBY_PAGER_SHOWN), 'valueChange', false);
    expect(screen.queryByTestId(TestIds.LOBBY_PAGER)).toBeNull();
    expect(byId(TestIds.LOBBY_TOP_ROW)).toBeTruthy();
    await layOut(TestIds.LOBBY_TOP_ROW);
    expect(byId(TestIds.LOBBY_TOP_ROW_POSITION)).toHaveTextContent('Top 10: tiles 1–3 of 10');

    // what a Top 10 tile does when touched on purpose
    await tapAndSettle(TemplateIds.lobbyTopRowTile(2));
    logIs('Tapped: Pocket Notebook (top row, tile 2)');
    expect(byId(TestIds.LOBBY_DETAIL)).toHaveTextContent('Top 10, tile 2', { exact: false });
    await tap(TestIds.LOBBY_DETAIL_BACK);
    await fireEvent(byId(TemplateIds.lobbyTopRowTile(2)), 'longPress');
    expect(byId(TestIds.LOBBY_SHEET_TITLE)).toHaveTextContent('Pocket Notebook');
    await tap(TestIds.LOBBY_SHEET_OPEN);
    logIs('Tapped: Open (quick sheet, Pocket Notebook)\nLong-pressed: Pocket Notebook (top row, tile 2)\nTapped: Pocket Notebook (top row, tile 2)');
    expect(byId(TestIds.LOBBY_DETAIL)).toHaveTextContent('Pocket Notebook', { exact: false });
    await tap(TestIds.LOBBY_DETAIL_BACK);
    await tap(TestIds.LOBBY_TOUCH_RESET);
    logIs(Lobby.NOTHING_TOUCHED);
    count(0);

    await tap(TemplateIds.lobbySavedDelay(12));
    expect(screen.queryByTestId(TestIds.LOBBY_BAR_SAVED)).toBeNull();
    await wait(12_000);
    await tap(TestIds.LOBBY_BAR_SAVED);
    expect(byId(TestIds.LOBBY_SAVED_SCREEN)).toBeTruthy();
    logIs('Tapped: Saved (bar)');
    count(1);
  });

  it('every kind of element logs as the spec writes it', async () => {
    await launchSignedIn();
    await openLobby();
    await tapAndSettle(TemplateIds.lobbyChip(3));
    logIs('Tapped: Desk (chip 3)');
    expect(byId(TemplateIds.lobbyChip(3)).props.accessibilityState).toMatchObject({ selected: true });
    expect(byId(TemplateIds.lobbyChip(1)).props.accessibilityState).toMatchObject({ selected: false });
    await fireEvent(byId(TemplateIds.lobbyChip(5)), 'longPress');
    logShows('Long-pressed: Home (chip 5)');
    await tapAndSettle(TemplateIds.lobbyGridCell(5));
    logShows('Tapped: Hanging Planter (grid, cell 5)');
    await tapAndSettle(TemplateIds.lobbyInnerRow(7));
    logShows('Tapped: Line 7 (inner list)');
    count(4);
    expect(byId(TestIds.LOBBY_TOUCH_LOG)).toHaveTextContent('Tapped: Line 7 (inner list)\nTapped: Hanging Planter (grid, cell 5)\nLong-pressed: Home (chip 5)');

    // a banner's long press opens the sheet; its Saved is logged with the sheet's title, and closes it
    await fireEvent(byId(TemplateIds.lobbyBanner(1)), 'longPress');
    expect(byId(TestIds.LOBBY_SHEET_TITLE)).toHaveTextContent('New in the Kitchen aisle');
    await tap(TestIds.LOBBY_SHEET_SAVED);
    expect(screen.queryByTestId(TestIds.LOBBY_SHEET)).toBeNull();
    logShows('Tapped: Saved (quick sheet, New in the Kitchen aisle)');
    count(6);

    // a row tile's number is the item's: row 2's first tile is No. 011, Espresso Cup Pair
    expect(byId(TemplateIds.lobbyRowTile(2, 1))).toHaveTextContent('Espresso Cup Pair', { exact: false });
    expect(byId(TemplateIds.lobbyRowTile(2, 1))).toHaveTextContent('No. 011', { exact: false });
    expect(byId(TemplateIds.lobbyTopRowTile(10))).toHaveTextContent('Fruit Bowl', { exact: false });
    expect(byId(TemplateIds.lobbyGridCell(12))).toHaveTextContent('Fruit Bowl', { exact: false });

    // Auto-advance: off by default; on, the pager moves every 4 s
    expect(byId(TestIds.LOBBY_PAGER_AUTO).props.value).toBe(false);
    await tap(TestIds.LOBBY_TOUCH_RESET);
    count(0);
  });

  it('starts fresh each time it opens, except the two choices', async () => {
    await launchSignedIn();
    await openLobby();
    await tapAndSettle(TemplateIds.lobbyChip(2));
    await tap(TemplateIds.lobbySavedDelay(6));
    await fireEvent(byId(TestIds.LOBBY_PAGER_AUTO), 'valueChange', true);
    await tap(TestIds.TOP_BAR_BACK);
    await tap(TestIds.LAB_LOBBY);
    await screen.findByTestId(TestIds.LOBBY_SCREEN);
    logIs(Lobby.NOTHING_TOUCHED);
    expect(byId(TemplateIds.lobbyChip(1)).props.accessibilityState).toMatchObject({ selected: true });
    expect(byId(TestIds.LOBBY_PAGER_AUTO).props.value).toBe(false);
    expect(byId(TemplateIds.lobbySavedDelay(6)).props.accessibilityState).toMatchObject({ selected: true });
  });
});

/*
 * The injected swipe. UiScrollable's swipe, as its bytecode says (docs/SAMPLE_APPS_LOBBY_SPEC_AND_ANDROID_REPORT.md
 * §4): one down at (centre x, top + 10 %) of the first scrollable's bounds, 54 moves each followed by a sleep, one up
 * at (centre x, bottom − 10 %), then 263 ms later the same the other way. Jest cannot run native touch: no
 * Android view sees these events, and no native scroller can intercept them. What this shows is what React
 * Native's JavaScript side decides when the platform hands it that finger: Pressable's responder gets the down, every
 * move and the up, with the timers between them. The tile's responder region is given as a phone measures it
 * (a Fabric `measure` answers at the grant); the test renderer's own measure never answers, and Pressable then
 * ignores every move.
 */
type Point = { x: number; y: number };
type Region = { left: number; top: number; width: number; height: number };

function pressEvent(at: Point, down: boolean, region: Region) {
  const target = {
    measure: (cb: (x: number, y: number, w: number, h: number, pageX: number, pageY: number) => void) =>
      cb(0, 0, region.width, region.height, region.left, region.top),
  };
  const touch = { identifier: 0, pageX: at.x, pageY: at.y, locationX: at.x - region.left, locationY: at.y - region.top, timestamp: Date.now(), target: 1 };
  return { persist: () => {}, currentTarget: target, target, nativeEvent: { ...touch, touches: down ? [touch] : [], changedTouches: [touch] } };
}

/** Plays one UiScrollable swipe into the element's responder. Returns what the element received, in order. */
async function uiScrollableSwipe(id: string, region: Region, from: Point, to: Point, stepMs: number): Promise<string[]> {
  const got: string[] = [];
  const el = () => screen.queryByTestId(id);
  if (!el()) return ['(not in the tree)'];
  await fireEvent(el()!, 'responderGrant', pressEvent(from, true, region));
  got.push('DOWN');
  const steps = 55;
  for (let i = 1; i < steps; i++) {
    await wait(stepMs);
    if (!el()) {
      got.push(`gone after ${i - 1} moves`);
      return got;
    }
    await fireEvent(el()!, 'responderMove', pressEvent({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }, true, region));
    if (got.at(-1) !== 'MOVE') got.push('MOVE');
  }
  await wait(stepMs);
  if (!el()) {
    got.push('gone before the up');
    return got;
  }
  await fireEvent(el()!, 'responderRelease', pressEvent(to, false, region));
  got.push('UP');
  return got;
}

/** Both swipes, backward then forward, 263 ms apart, then the double-tap time. */
async function scrollIntoViewSwipes(id: string, region: Region, scroller: Region, stepMs: number) {
  const x = scroller.left + scroller.width / 2;
  const top = { x, y: scroller.top + scroller.height * 0.1 };
  const bottom = { x, y: scroller.top + scroller.height * 0.9 };
  const first = await uiScrollableSwipe(id, region, top, bottom, stepMs);
  await wait(263);
  const second = await uiScrollableSwipe(id, region, bottom, top, stepMs);
  await wait(400);
  return { first: first.join(' → '), second: second.join(' → ') };
}

describe('UiScrollable’s swipe, played into Pressable', () => {
  // a phone 360 wide; the Top 10 row's list is 88 high (a 64 band, 4, a 16 line, 4 under), tile 2 at x 124–224
  const row: Region = { left: 0, top: 400, width: 360, height: 88 };
  const tile2: Region = { left: 124, top: 400, width: 100, height: 84 };
  // the pager is 104 high; banner 1 is 96 high under 4 of padding, 16 in from each side
  const pager: Region = { left: 0, top: 300, width: 360, height: 104 };
  const banner1: Region = { left: 16, top: 304, width: 328, height: 96 };

  for (const stepMs of [5, 19]) {
    it(`across the Top 10 row, pager off, ${stepMs} ms a step: tile 2 takes it as a tap`, async () => {
      await launchSignedIn();
      await openLobby();
      await fireEvent(byId(TestIds.LOBBY_PAGER_SHOWN), 'valueChange', false);
      expect(scrollablesInFront()[0].id).toBe(TestIds.LOBBY_TOP_ROW);
      const got = await scrollIntoViewSwipes(TemplateIds.lobbyTopRowTile(2), tile2, row, stepMs);
      // the first swipe: down, moves, up, and Pressable calls it a press. The long-press timer was cancelled once the
      // finger had moved 10 dp; the finger never left the tile's press rect, so the up is a press.
      expect(got.first).toBe('DOWN → MOVE → UP');
      // the second swipe starts 263 ms after the first up, before the 300 ms double-tap wait ends; at 300 ms the tap
      // opens the detail, which takes the row away from under the finger
      expect(got.second).toMatch(/^DOWN → (MOVE → )?gone/);
      logIs('Tapped: Pocket Notebook (top row, tile 2)');
      count(1);
      expect(byId(TestIds.LOBBY_DETAIL)).toHaveTextContent('Top 10, tile 2', { exact: false });
      expect(screen.queryByTestId(TestIds.LOBBY_SHEET)).toBeNull();
    });

    it(`across the pager, ${stepMs} ms a step: banner 1 takes it as a tap`, async () => {
      await launchSignedIn();
      await openLobby();
      expect(scrollablesInFront()[0].id).toBe(TestIds.LOBBY_PAGER);
      const got = await scrollIntoViewSwipes(TemplateIds.lobbyBanner(1), banner1, pager, stepMs);
      expect(got.first).toBe('DOWN → MOVE → UP');
      expect(got.second).toMatch(/^DOWN → (MOVE → )?gone/);
      logIs('Tapped: New in the Kitchen aisle (banner 1)');
      count(1);
      expect(byId(TestIds.LOBBY_PROMO)).toBeTruthy();
    });
  }

  it('Pressable’s own rules, for the README: still → long press; moved more than 10 dp → no long press; out of the press rect → nothing', async () => {
    await launchSignedIn();
    await openLobby();
    await fireEvent(byId(TestIds.LOBBY_PAGER_SHOWN), 'valueChange', false);
    const id = TemplateIds.lobbyTopRowTile(2);
    const centre = { x: 174, y: 442 };

    // a finger that stays still for 55 × 19 ms: a long press at 500 ms, the sheet opens
    await uiScrollableSwipe(id, tile2, centre, centre, 19);
    await wait(400);
    logIs('Long-pressed: Pocket Notebook (top row, tile 2)');
    await sheetBack();
    expect(screen.queryByTestId(TestIds.LOBBY_SHEET)).toBeNull();

    // 9 dp of travel over a second: still a long press (the cancel is at more than 10)
    await uiScrollableSwipe(id, tile2, centre, { x: centre.x, y: centre.y + 9 }, 19);
    await wait(400);
    logShows('Long-pressed: Pocket Notebook (top row, tile 2)\nLong-pressed');
    count(2);
    await sheetBack();

    // down on the tile, up 40 dp below it (beyond its 30 dp press-rect bottom): nothing at all
    await uiScrollableSwipe(id, tile2, centre, { x: centre.x, y: tile2.top + tile2.height + 40 }, 19);
    await wait(400);
    count(2);
  });
});
