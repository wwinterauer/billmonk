import { describe, it, expect, vi } from "vitest";
import { calculateMatchScore, rankAssignmentCandidates, assignBankTransaction } from "@/lib/bankReconcile";

describe("bank reconcile rules", () => {
  it("exact amount on same day scores 100", () => {
    expect(calculateMatchScore(-42, new Date("2026-05-08"), 42, "2026-05-08").score).toBe(100);
  });
  it("3 % Skonto difference within 3 days scores 56+24", () => {
    expect(calculateMatchScore(-97, new Date("2026-05-10"), 100, "2026-05-08").score).toBe(80);
  });
  it("default dialog filter drops receipts more than 10 % off", () => {
    const { matching, others } = rankAssignmentCandidates(
      [{ amount_gross: 100, receipt_date: "2026-05-08" }, { amount_gross: 150, receipt_date: "2026-05-08" }],
      -100, new Date("2026-05-08"),
    );
    expect(matching.map((m) => m.amount_gross)).toEqual([100]);
    expect(others.map((m) => m.amount_gross)).toEqual([150]);
  });
  it("split-line match does not set the receipt's payment link", async () => {
    const calls: string[] = [];
    const chain = (t: string) => ({ update: () => ({ eq: async () => { calls.push(t); return { error: null }; } }) });
    const sb = { from: vi.fn((t: string) => chain(t)) };
    await assignBankTransaction(sb, "tx", "r", "line");
    expect(calls).toEqual(["bank_transactions"]);
    await assignBankTransaction(sb, "tx", "r", null);
    expect(calls).toEqual(["bank_transactions", "bank_transactions", "receipts"]);
  });
});
