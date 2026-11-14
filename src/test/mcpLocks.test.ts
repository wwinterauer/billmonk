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

import { splitConsistencyError } from "@/lib/mcp/tools/_locks";
import { bankReceiptNetVat } from "@/lib/bankReconcile";
describe("approved net/VAT split correction", () => {
  it("allows net/vat/rate when gross untouched", () => {
    expect(lfe("approved", ["amount_net", "vat_amount", "vat_rate"], { values: { amount_net: 100, vat_amount: 20, vat_rate: 20 }, currentGross: 120 })).toBeNull();
  });
  it("still blocks gross and vendor", () => {
    expect(lfe("approved", ["amount_gross", "amount_net"], { values: { amount_gross: 120, amount_net: 100 }, currentGross: 120 })).toContain("amount_gross");
    expect(lfe("approved", ["vendor"], { currentGross: 120 })).toContain("vendor");
  });
  it("requires net + vat = gross within 2 cents", () => {
    expect(splitConsistencyError(120, 100.01, 20.01)).toBeNull();
    expect(splitConsistencyError(120, 100, 20.03)).not.toBeNull();
    expect(splitConsistencyError(120, 120, 120)).not.toBeNull();
  });
  it("bank receipts: net = gross, VAT 0 at rate 0", () => {
    expect(bankReceiptNetVat(49.9, 0)).toEqual({ amount_net: 49.9, vat_amount: 0 });
  });
});
