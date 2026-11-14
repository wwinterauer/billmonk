import { describe, it, expect } from 'vitest';
import { sortTags, joinTagNames } from '@/lib/tagOrder';
import { mergeReceiptTagNames } from '@/lib/mcp/tools/_tags';

const fewo = { id: '1', name: "Alle FeWo's", color: '' };
const buero = { id: '2', name: 'büro', color: '' };
const zeta = { id: '3', name: 'Zeta', color: '' };

describe('tag order', () => {
  it('same two tags in either selection order give the same order', () => {
    expect(sortTags([zeta, fewo])).toEqual(sortTags([fewo, zeta]));
    expect(sortTags([zeta, fewo]).map(t => t.name)).toEqual(["Alle FeWo's", 'Zeta']);
  });
  it('German collation, case-insensitive (umlauts, lowercase)', () => {
    expect(sortTags([zeta, buero, fewo]).map(t => t.name)).toEqual(["Alle FeWo's", 'büro', 'Zeta']);
  });
  it('export string and MCP list match regardless of order', () => {
    expect(joinTagNames([zeta, fewo])).toBe("Alle FeWo's; Zeta");
    expect(joinTagNames([fewo, zeta])).toBe("Alle FeWo's; Zeta");
    const [r] = mergeReceiptTagNames([{ id: 'r' }], [
      { receipt_id: 'r', tag: { name: 'Zeta' } }, { receipt_id: 'r', tag: { name: "Alle FeWo's" } },
    ]);
    expect(r.tags).toEqual(["Alle FeWo's", 'Zeta']);
  });
});
