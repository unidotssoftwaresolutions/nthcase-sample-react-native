import { ITEMS, type Item } from './catalog';

/**
 * The Lobby (SPEC.md §5, new in 1.1): its names, numbers and texts. The screen only draws them. They are the same in
 * all five apps, so a scenario's checks read the same words everywhere.
 */
export const Lobby = {
  BANNERS: 5,
  ROWS: 4,
  TILES: 20,
  /** The Top 10 row: fixed, outside the page, under the pager or in its place. */
  TOP_TILES: 10,
  GRID_CELLS: 12,
  INNER_LINES: 30,
  BOARD: 26,
  /** "Saved appears after", in seconds. 0 is the default; SPEC.md §5 says why each one. */
  DELAYS: [0, 3, 6, 12, 20] as const,
  /** Auto-advance moves the pager every 4 s while it is on. */
  AUTO_ADVANCE_MS: 4000,

  /** A tile is 100 wide with 8 between tiles, after 16 of padding: the geometry the position lines read. */
  TILE_WIDTH: 100,
  TILE_GAP: 8,
  ROW_PADDING: 16,
  /** A board cell is 56 square; the board shows 5 × 5 of them. */
  BOARD_CELL: 56,

  banners: [
    'New in the Kitchen aisle',
    'Warm, low desk lamps',
    'Ferns that like the shade',
    'Candles for long evenings',
    'Totes for market day',
  ],
  chips: ['All', 'Kitchen', 'Desk', 'Garden', 'Home', 'Under $20', 'Under $40', 'New', 'Gifts', 'Sets', 'Lamps', 'Candles'],
  barItems: ['Home', 'Live', 'Saved', 'Offers'],
  sheetButtons: ['Open', 'Preview', 'Saved', 'Rate'],

  NOTHING_TOUCHED: 'Nothing touched',
  SAVED_EMPTY: 'Saved: nothing yet',
  FOOTER: 'End of the lobby',
  FOOTER_NOTE: 'A test bench: nothing here is for sale.',
  BANNER_NOTE: 'A test banner',
  PROMO_NOTE: 'A test banner. Nothing here is for sale.',
  BACK_TO_LOBBY: 'Back to the lobby',
} as const;

export type Delay = (typeof Lobby.DELAYS)[number];

/** The Top 10 row's number where a row is asked for: it is not one of the page's rows 1–4. */
export const TOP_ROW = 0;

/** Tile [tile] of row [row] (both from 1) shows item ((row − 1) × 10 + tile − 1) mod 40 + 1. */
export function tileItem(row: number, tile: number): Item {
  return ITEMS[((row - 1) * 10 + tile - 1) % ITEMS.length];
}

/** Tile [tile] (from 1) of the Top 10 row shows item tile + 30: No. 031 to No. 040. */
export function topItem(tile: number): Item {
  return ITEMS[tile + 29];
}

/** Grid cell [cell] (from 1) shows item cell + 28. */
export function gridItem(cell: number): Item {
  return ITEMS[cell + 27];
}

/** The item a tile shows, for a row from 1 to 4 or [TOP_ROW]. */
export function itemAt(row: number, tile: number): Item {
  return row === TOP_ROW ? topItem(tile) : tileItem(row, tile);
}

/** "A1" … "Z26": the column letter, then the row number, both from 1. */
export function boardLabel(col: number, row: number): string {
  return `${String.fromCharCode(64 + col)}${row}`;
}

export function pagerPosition(banner: number): string {
  return `Banner ${banner} of ${Lobby.BANNERS}`;
}

/** "Row 2: tiles 1–3 of 20", or "Row 2: tile 4 of 20" when only one tile is fully visible. */
export function rowPosition(row: number, first: number, last: number): string {
  return last <= first ? `Row ${row}: tile ${first} of ${Lobby.TILES}` : `Row ${row}: tiles ${first}–${last} of ${Lobby.TILES}`;
}

/** "Top 10: tiles 1–3 of 10", or "Top 10: tile 4 of 10" when only one is. */
export function topRowPosition(first: number, last: number): string {
  return last <= first ? `Top 10: tile ${first} of ${Lobby.TOP_TILES}` : `Top 10: tiles ${first}–${last} of ${Lobby.TOP_TILES}`;
}

/** The detail's place line: "Row 3, tile 15", or "Top 10, tile 2". */
export function detailPlace(row: number, tile: number): string {
  return row === TOP_ROW ? `Top 10, tile ${tile}` : `Row ${row}, tile ${tile}`;
}

/** Where the log says a tile was touched: "row 3, tile 15" or "top row, tile 2". */
export function tileWhere(row: number, tile: number): string {
  return row === TOP_ROW ? `top row, tile ${tile}` : `row ${row}, tile ${tile}`;
}

export function boardPosition(col: number, row: number): string {
  return `Board: top-left ${boardLabel(col, row)}`;
}

export function innerLine(n: number): string {
  return `Line ${n} of ${Lobby.INNER_LINES}`;
}

/**
 * The first and last fully visible tiles of a row scrolled [offset] across a viewport [width] wide, from 1. A tile
 * cut by an edge is not counted; when none is whole, the one under the left edge is named alone.
 */
export function fullyVisibleTiles(offset: number, width: number, count: number): [number, number] {
  const left = (m: number) => Lobby.ROW_PADDING + (m - 1) * (Lobby.TILE_WIDTH + Lobby.TILE_GAP);
  const whole: number[] = [];
  for (let m = 1; m <= count; m++) {
    if (left(m) >= offset - 0.5 && left(m) + Lobby.TILE_WIDTH <= offset + width + 0.5) whole.push(m);
  }
  if (whole.length > 0) return [whole[0], whole[whole.length - 1]];
  let under = 1;
  for (let m = 1; m <= count; m++) if (left(m) <= offset) under = m;
  return [under, under];
}

/** The board's top-left fully visible cell for a scroll of (x, y): a cell scrolled partly out is not counted. */
export function boardTopLeft(x: number, y: number): [number, number] {
  const cell = (offset: number) => Math.min(Lobby.BOARD, Math.max(1, Math.ceil(offset / Lobby.BOARD_CELL - 0.001) + 1));
  return [cell(x), cell(y)];
}

/** How a touch came: the words each log line starts with. */
export type Touch = 'Tapped' | 'Long-pressed' | 'Double-tapped';

export type TouchLog = { lines: readonly string[]; count: number };

export const EMPTY_LOG: TouchLog = { lines: [], count: 0 };

/** The log after one more touch: newest first, three lines at most; the count keeps every touch since the reset. */
export function logTouch(log: TouchLog, touch: Touch, what: string, where: string): TouchLog {
  return { lines: [`${touch}: ${what} (${where})`, ...log.lines].slice(0, 3), count: log.count + 1 };
}

export function logText(log: TouchLog): string {
  return log.lines.length === 0 ? Lobby.NOTHING_TOUCHED : log.lines.join('\n');
}

export function countText(log: TouchLog): string {
  return `Touches: ${log.count}`;
}
