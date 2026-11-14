import { describe, it, expect } from "vitest";
import { lockedFieldsError, deleteReceiptError } from "@/lib/mcp/tools/_locks";

describe("MCP locks", () => {
  it("approved receipts allow category, tags, receipt_date and invoice_number", () => {
    expect(lockedFieldsError("approved", ["category", "tags", "receipt_date", "invoice_number"])).toBeNull();
  });
  it("approved receipts still lock amounts, vendor, description", () => {
    for (const f of ["amount_gross", "vat_rate", "vendor", "description"]) {
      expect(lockedFieldsError("approved", [f])).toContain(f);
    }
  });
  it("delete allowed for duplicate", () => { expect(deleteReceiptError("duplicate")).toBeNull(); expect(deleteReceiptError("approved")).not.toBeNull(); });
  it("delete only allowed in review", () => {
    expect(deleteReceiptError("review")).toBeNull();
    expect(deleteReceiptError("approved")).toMatch(/cannot be deleted/);
    expect(deleteReceiptError("processing")).not.toBeNull();
  });
});

import { lockedFieldsError as lfe } from "@/lib/mcp/tools/_locks";
describe("approved Keine Rechnung amounts", () => {
  it("allows clearing amounts to null on approved Keine Rechnung", () => {
    expect(lfe("approved", ["amount_gross", "amount_net", "vat_amount"], { isNoInvoice: true, values: { amount_gross: null, amount_net: null, vat_amount: null } })).toBeNull();
  });
  it("blocks non-null amounts even on Keine Rechnung", () => {
    expect(lfe("approved", ["amount_gross"], { isNoInvoice: true, values: { amount_gross: 5 } })).not.toBeNull();
  });
  it("blocks clearing amounts on normal approved receipts", () => {
    expect(lfe("approved", ["amount_gross"], { isNoInvoice: false, values: { amount_gross: null } })).not.toBeNull();
  });
});
