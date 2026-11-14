/**
 * Single source of truth for the order of tags on a receipt:
 * alphabetical by name, German collation, case-insensitive.
 * Any stored position/assignment time is ignored on purpose.
 */
const collator = new Intl.Collator('de', { sensitivity: 'base', numeric: true });

export function compareTagNames(a: string, b: string): number {
  return collator.compare(a ?? '', b ?? '') || (a ?? '').localeCompare(b ?? '');
}

export function sortTagNames(names: readonly string[]): string[] {
  return [...names].sort(compareTagNames);
}

export function sortTags<T extends { name: string }>(tags: readonly (T | null | undefined)[]): T[] {
  return (tags.filter(Boolean) as T[]).sort((a, b) => compareTagNames(a.name, b.name));
}

/** Canonical display/export string; identical for any selection order. */
export function joinTagNames(tags: readonly ({ name: string } | string)[], sep = '; '): string {
  return sortTagNames(tags.map(t => (typeof t === 'string' ? t : t.name))).join(sep);
}
