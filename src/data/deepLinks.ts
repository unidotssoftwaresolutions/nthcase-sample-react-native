/** `nthcase-sample://item/{id}`: the one deep link every Mossgrove app answers (SPEC.md §5, Deep link). */
export const SCHEME = 'nthcase-sample';

/**
 * The item id as written in the link (it may be unknown or not a number; the item screen says so), or null for any
 * other host or path, which the app ignores.
 */
export function itemIdFromLink(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = /^nthcase-sample:\/\/item\/([^/?#]+)\/?(?:[?#].*)?$/.exec(url);
  if (!match) return null;
  try {
    const id = decodeURIComponent(match[1]).trim();
    return id === '' ? null : id;
  } catch {
    return null;
  }
}

export function linkForItem(id: number): string {
  return `${SCHEME}://item/${id}`;
}
