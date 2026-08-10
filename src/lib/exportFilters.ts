// Tag filter for export templates
export interface TagFilter {
  include: string[];
  exclude: string[];
  includeMode: 'any' | 'all';
}

export const EMPTY_TAG_FILTER: TagFilter = { include: [], exclude: [], includeMode: 'any' };

export const parseTagFilter = (value: unknown): TagFilter => {
  const v = (value || {}) as Record<string, unknown>;
  return {
    include: Array.isArray(v.include) ? (v.include as string[]) : [],
    exclude: Array.isArray(v.exclude) ? (v.exclude as string[]) : [],
    includeMode: v.includeMode === 'all' ? 'all' : 'any',
  };
};

export const isTagFilterActive = (filter?: TagFilter | null): boolean =>
  !!filter && ((filter.include?.length || 0) > 0 || (filter.exclude?.length || 0) > 0);

/**
 * Checks whether a receipt (given its tag ids) passes the tag filter.
 * - exclude always wins
 * - include empty => everything passes
 */
export const matchesTagFilter = (
  tagIds: string[] | undefined | null,
  filter?: TagFilter | null,
): boolean => {
  if (!filter) return true;
  const ids = new Set((tagIds || []).filter(Boolean));

  const exclude = filter.exclude || [];
  if (exclude.some(id => ids.has(id))) return false;

  const include = filter.include || [];
  if (include.length === 0) return true;

  return filter.includeMode === 'all'
    ? include.every(id => ids.has(id))
    : include.some(id => ids.has(id));
};
