/** Split IDs into chunks so `.in()` filters stay under URL length limits. */
export function chunkIds<T>(ids: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/** Run a query per chunk and concatenate rows; throws on the first error. */
export async function fetchInChunks<R>(
  ids: string[],
  run: (chunk: string[]) => PromiseLike<{ data: R[] | null; error: unknown }>,
  size = 100,
): Promise<R[]> {
  const results = await Promise.all(chunkIds(ids, size).map((c) => run(c)));
  const rows: R[] = [];
  for (const r of results) {
    if (r.error) throw r.error;
    if (r.data) rows.push(...r.data);
  }
  return rows;
}
