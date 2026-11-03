import { actions } from '../src/data/store';
import { itemIdFromLink } from '../src/data/deepLinks';

/**
 * Every URL the system hands the app passes here first. `nthcase-sample://item/{id}` is kept for the root layout,
 * which opens the item once someone is signed in (so a signed-out cold start shows sign-in first). Any other link is
 * ignored: on a cold start the app opens as usual, and a running app stays where it is.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string {
  const id = itemIdFromLink(path);
  if (id !== null) actions.setPendingItemId(id);
  return initial ? '/' : '';
}
