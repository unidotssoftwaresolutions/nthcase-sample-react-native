/*
 * Reads the rendered host tree: the native views React Native would create, with their props. This is the React
 * tree's view of what Appium will see: every `testID` here becomes a resource-id (Android) or an accessibility
 * identifier (iOS). It cannot prove what the platform then exposes; CI's screenshot run reads the real Android tree.
 */
import { screen } from '@testing-library/react-native';

export type HostNode = { type: string; props: { [key: string]: unknown }; children: (HostNode | string)[] | null };

export function hostRoots(): HostNode[] {
  const json = screen.toJSON() as HostNode | HostNode[] | null;
  if (json === null) return [];
  return Array.isArray(json) ? json : [json];
}

function walk(nodes: (HostNode | string)[], visit: (node: HostNode, ancestors: HostNode[]) => void, ancestors: HostNode[] = []) {
  for (const node of nodes) {
    if (typeof node === 'string') continue;
    visit(node, ancestors);
    if (node.children) walk(node.children, visit, [...ancestors, node]);
  }
}

/** Every testID in the tree. */
export function allIds(nodes: HostNode[] = hostRoots()): Set<string> {
  const ids = new Set<string>();
  walk(nodes, (n) => {
    if (typeof n.props.testID === 'string') ids.add(n.props.testID);
  });
  return ids;
}

/**
 * Two kinds of hiding, kept apart:
 * - grouping: on iOS an `accessible` view is one accessibility element, and XCUITest never sees inside it;
 *   `importantForAccessibility="no-hide-descendants"` hides a subtree on Android. The app must never put an id there.
 * - off screen: the navigation library marks the screens that are not in front `aria-hidden`. Their ids are simply
 *   not on screen, which is right; a state's ids must not be under one.
 * A Text is accessible too, but holds only text.
 */
function groups(node: HostNode): boolean {
  return node.props.accessible === true || node.props.importantForAccessibility === 'no-hide-descendants';
}

function offScreen(node: HostNode): boolean {
  return node.props['aria-hidden'] === true || node.props.accessibilityElementsHidden === true;
}

/** Ids that sit inside an accessible (grouping) ancestor: each would be invisible to Appium on iOS. */
export function idsHiddenByAnAncestor(nodes: HostNode[] = hostRoots()): { id: string; ancestor: string }[] {
  const found: { id: string; ancestor: string }[] = [];
  walk(nodes, (n, ancestors) => {
    if (typeof n.props.testID !== 'string') return;
    const hider = ancestors.find(groups);
    if (hider) found.push({ id: n.props.testID, ancestor: String(hider.props.testID ?? hider.props.accessibilityLabel ?? hider.type) });
  });
  return found;
}

/** The ids on the screen in front: every testID not under a navigation-hidden ancestor. */
export function visibleIds(nodes: HostNode[] = hostRoots()): Set<string> {
  const ids = new Set<string>();
  walk(nodes, (n, ancestors) => {
    if (typeof n.props.testID === 'string' && !ancestors.some(offScreen) && !offScreen(n)) ids.add(n.props.testID);
  });
  return ids;
}

/** The text a subtree shows, joined. */
export function textOf(node: HostNode): string {
  const parts: string[] = [];
  const go = (children: (HostNode | string)[] | null) =>
    children?.forEach((c) => (typeof c === 'string' ? parts.push(c) : go(c.children)));
  go(node.children);
  return parts.join('');
}

/** The innermost screen container (react-native-screens' RNSScreen) whose subtree shows [text]. */
export function screenShowing(text: string, nodes: HostNode[] = hostRoots()): HostNode | null {
  let best: HostNode | null = null;
  walk(nodes, (n) => {
    if (n.type === 'RNSScreen' && textOf(n).includes(text)) best = n;
  });
  return best;
}
