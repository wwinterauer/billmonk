import { describe, it, expect } from 'vitest';
import { chunkIds, fetchInChunks } from './chunkedIn';
describe('chunkedIn', () => {
  it('splits 659 ids into 7 chunks of max 100', () => {
    const c = chunkIds(Array.from({ length: 659 }, (_, i) => String(i)));
    expect(c.length).toBe(7);
    expect(c.flat().length).toBe(659);
  });
  it('returns rows from all chunks', async () => {
    const rows = await fetchInChunks(Array.from({ length: 250 }, (_, i) => String(i)), async (c) => ({ data: c, error: null }));
    expect(rows.length).toBe(250);
  });
  it('throws when a chunk fails', async () => {
    await expect(fetchInChunks(['a'], async () => ({ data: null, error: new Error('x') }))).rejects.toThrow();
  });
});
