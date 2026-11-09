/**
 * Alphabetische Sortierung für Checklisten und deren Positionen.
 * Deutsche Kollation (ä/ö/ü/ß werden als a/o/ss eingeordnet), Groß-/Kleinschreibung egal.
 * Einträge ohne Namen landen am Ende.
 */

export interface Nameable {
  name?: string | null;
}

export function byName<T extends Nameable>(a: T, b: T): number {
  const left = (a?.name ?? '').trim();
  const right = (b?.name ?? '').trim();

  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;

  return left.localeCompare(right, 'de', { sensitivity: 'base', numeric: true });
}

/** Gibt eine alphabetisch sortierte Kopie zurück (Input bleibt unverändert). */
export function sortByName<T extends Nameable>(entries: T[] | null | undefined): T[] {
  return (entries ?? []).slice().sort(byName);
}
