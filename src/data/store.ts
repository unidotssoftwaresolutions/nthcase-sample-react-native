import { useSyncExternalStore } from 'react';

import { findItem } from './catalog';

export const TEST_EMAIL = 'tester@mossgrove.test';
export const TEST_PASSWORD = 'Mossgrove123';
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 9;

export type ThemeMode = 'system' | 'light' | 'dark';
export type CartLine = { itemId: number; quantity: number };
export type Order = { number: number; lines: readonly CartLine[] };

export type AppState = {
  signedInEmail: string | null;
  /** One line per item, in the order items were first added. Quantities stay within 1–9. */
  cart: readonly CartLine[];
  /** Newest first. Numbered from 1 in each session. */
  orders: readonly Order[];
  /** Settings › Testing: every list load waits 3 s first. */
  slowLoading: boolean;
  /** Settings › Testing: the first load of each visit fails; Try again then succeeds. */
  failFirstLoad: boolean;
  /** Settings › Notifications: post an "order placed" notification when allowed. */
  orderUpdates: boolean;
  themeMode: ThemeMode;
  /** A deep link that arrived before sign-in; opened right after it. */
  pendingItemId: string | null;
};

const COLD_START: AppState = {
  signedInEmail: null,
  cart: [],
  orders: [],
  slowLoading: false,
  failFirstLoad: false,
  orderUpdates: false,
  themeMode: 'system',
  pendingItemId: null,
};

/**
 * Everything the app remembers, in memory only. A cold start is always signed out with an empty cart and no orders,
 * so every run begins from the same screen (SPEC.md §2).
 */
let state: AppState = COLD_START;
const listeners = new Set<() => void>();

function set(next: Partial<AppState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function getState(): AppState {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppState<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state), () => select(state));
}

function clamp(quantity: number): number {
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, quantity));
}

export function lineTotalCents(line: CartLine): number {
  return findItem(line.itemId)!.priceCents * line.quantity;
}

export function itemCount(lines: readonly CartLine[]): number {
  return lines.reduce((n, l) => n + l.quantity, 0);
}

export function totalCents(lines: readonly CartLine[]): number {
  return lines.reduce((n, l) => n + lineTotalCents(l), 0);
}

/** "1 item" / "3 items". */
export function itemsWord(count: number): string {
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}

/** The one check of the sign-in screen. Email case and surrounding spaces do not matter; the password's case does. */
export function credentialsMatch(email: string, password: string): boolean {
  return email.trim().toLowerCase() === TEST_EMAIL && password === TEST_PASSWORD;
}

export const actions = {
  signIn(email: string) {
    set({ signedInEmail: email.trim().toLowerCase() });
  },
  signOut() {
    set({ signedInEmail: null, cart: [], orders: [] });
  },
  addToCart(itemId: number, quantity: number) {
    if (!findItem(itemId)) throw new Error(`No item ${itemId}`);
    const index = state.cart.findIndex((l) => l.itemId === itemId);
    if (index < 0) set({ cart: [...state.cart, { itemId, quantity: clamp(quantity) }] });
    else set({ cart: state.cart.map((l, i) => (i === index ? { itemId, quantity: clamp(l.quantity + quantity) } : l)) });
  },
  setQuantity(itemId: number, quantity: number) {
    set({ cart: state.cart.map((l) => (l.itemId === itemId ? { itemId, quantity: clamp(quantity) } : l)) });
  },
  removeLine(itemId: number) {
    set({ cart: state.cart.filter((l) => l.itemId !== itemId) });
  },
  /** Moves the cart into a new order, newest first, and empties the cart. */
  placeOrder(): Order {
    const order: Order = { number: state.orders.length + 1, lines: state.cart };
    set({ orders: [order, ...state.orders], cart: [] });
    return order;
  },
  /** Settings › Empty the cart and orders: keeps you signed in. */
  resetData() {
    set({ cart: [], orders: [] });
  },
  setSlowLoading(on: boolean) {
    set({ slowLoading: on });
  },
  setFailFirstLoad(on: boolean) {
    set({ failFirstLoad: on });
  },
  setOrderUpdates(on: boolean) {
    set({ orderUpdates: on });
  },
  setThemeMode(mode: ThemeMode) {
    set({ themeMode: mode });
  },
  setPendingItemId(id: string | null) {
    set({ pendingItemId: id });
  },
  /** Back to a cold start. Tests call it between cases. */
  reset() {
    set(COLD_START);
  },
};
