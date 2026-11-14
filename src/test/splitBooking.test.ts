import { describe, it, expect } from "vitest";
import { validateSplitSum, splitLinesFromLineItems, recalcSplitLine } from "@/lib/splitBooking";

describe("split booking", () => {
  it("accepts parts within 0.02 of receipt gross", () => {
    expect(validateSplitSum([{ amount_gross: 60 }, { amount_gross: 59.99 }], 120).isValid).toBe(true);
  });
  it("rejects parts off by more than 0.02", () => {
    expect(validateSplitSum([{ amount_gross: 60 }, { amount_gross: 50 }], 120).isValid).toBe(false);
  });
  it("builds AI parts from line items with net from gross", () => {
    const p = splitLinesFromLineItems([{ description: "A", total: 120, tax_rate: "20%" }], {})!;
    expect(p[0]).toMatchObject({ amount_gross: 120, amount_net: 100, vat_amount: 20, vat_rate: 20 });
  });
  it("recalculates gross from net", () => {
    const l = recalcSplitLine({ sort_order: 0, description: "", category: "", tax_type: "", payment_method: "", amount_gross: 0, amount_net: 100, vat_rate: 10, vat_amount: 0, is_private: false }, "net");
    expect(l.amount_gross).toBe(110);
  });
});
