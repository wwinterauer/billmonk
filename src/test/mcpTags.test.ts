import { describe, expect, it } from "vitest";
import { flattenTagCounts, mergeReceiptTagNames, planTagAssignmentChanges, resolveTagIds } from "@/lib/mcp/tools/_tags";

describe("MCP receipt tags", () => {
  it("attaches sorted tag names and keeps untagged receipts as an empty list", () => {
    const result = mergeReceiptTagNames(
      [{ id: "r1" }, { id: "r2" }],
      [
        { receipt_id: "r1", tag: { name: "Wohnung" } },
        { receipt_id: "r1", tag: { name: "Alle FeWo's" } },
      ],
    );
    expect(result[0].tags).toEqual(["Alle FeWo's", "Wohnung"]);
    expect(result[1].tags).toEqual([]);
  });

  it("resolves only existing tag names and removes duplicate names", () => {
    const result = resolveTagIds(["Wohnung", "Wohnung"], [{ id: "t1", name: "Wohnung" }]);
    expect(result).toEqual({ ok: true, tagIds: ["t1"] });
  });

  it("rejects an unknown tag name instead of creating it", () => {
    const result = resolveTagIds(["Neuer Tag"], [{ id: "t1", name: "Wohnung" }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Neuer Tag");
  });

  it("accepts an empty list to remove every tag", () => {
    expect(resolveTagIds([], [{ id: "t1", name: "Wohnung" }])).toEqual({ ok: true, tagIds: [] });
  });

  it("preserves a zero receipt count in list_tags", () => {
    const result = flattenTagCounts([{
      id: "t1",
      name: "Unbenutzt",
      color: "#fff000",
      is_active: true,
      receipt_tags: [{ count: 0 }],
    }]);
    expect(result[0].receipt_count).toBe(0);
  });
});
