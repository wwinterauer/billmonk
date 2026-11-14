import { describe, it, expect } from "vitest";
import { lockedFieldsError, deleteReceiptError } from "@/lib/mcp/tools/_locks";

describe("MCP locks", () => {
  it("approved receipts allow category, tags and receipt_date", () => {
    expect(lockedFieldsError("approved", ["category", "tags", "receipt_date"])).toBeNull();
  });
  it("approved receipts still lock amounts, vendor, invoice number, description", () => {
    for (const f of ["amount_gross", "vat_rate", "vendor", "invoice_number", "description"]) {
      expect(lockedFieldsError("approved", [f])).toContain(f);
    }
  });
  it("delete only allowed in review", () => {
    expect(deleteReceiptError("review")).toBeNull();
    expect(deleteReceiptError("approved")).toMatch(/cannot be deleted/);
    expect(deleteReceiptError("processing")).not.toBeNull();
  });
});
