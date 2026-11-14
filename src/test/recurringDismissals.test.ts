import { describe, it, expect } from "vitest";
import { detectRecurringGroups, filterRecurringSuggestions } from "@/lib/recurring-detection";

const tx = (id: string, d: string, amt: number, desc = "Limberger Miete") => ({ id, transaction_date: d, description: desc, amount: amt });
const groups = detectRecurringGroups([tx("1", "2026-01-05", -500), tx("2", "2026-02-05", -500), tx("3", "2026-03-05", -500)]);

describe("recurring suggestions", () => {
  it("dismissed recipient stays hidden even with a new amount", () => {
    const newer = detectRecurringGroups([tx("4", "2026-04-05", -520), tx("5", "2026-05-05", -520)]);
    expect(filterRecurringSuggestions(newer, new Set(["limberger"]), [])).toHaveLength(0);
  });
  it("hidden when most earlier bookings are matched", () => {
    expect(filterRecurringSuggestions(groups, new Set(), Array(4).fill("Limberger Miete"))).toHaveLength(0);
  });
  it("shown when few bookings are matched", () => {
    expect(filterRecurringSuggestions(groups, new Set(), ["Limberger Miete"])).toHaveLength(1);
  });
});
