import { describe, it, expect } from "vitest";
import { lockedReceiptError, lockedFieldsError } from "@/lib/mcp/tools/_locks";

describe("MCP receipt lock", () => {
  it("blocks splitting approved receipts", () => { expect(lockedReceiptError("approved")).not.toBeNull(); });
  it("allows review receipts", () => { expect(lockedReceiptError("review")).toBeNull(); });
  it("allows category and tags on approved", () => { expect(lockedFieldsError("approved", ["category", "tags"])).toBeNull(); });
  it("blocks amounts on approved", () => { expect(lockedFieldsError("approved", ["tags", "amount_gross"])).toMatch(/amount_gross/); });
  it("allows any field on review", () => { expect(lockedFieldsError("review", ["vendor"])).toBeNull(); });
});
