import { describe, it, expect } from "vitest";
import { lockedReceiptError } from "@/lib/mcp/tools/_locks";

describe("MCP receipt lock", () => {
  it("blocks approved receipts", () => { expect(lockedReceiptError("approved")).toMatch(/locked/); });
  it("allows review receipts", () => { expect(lockedReceiptError("review")).toBeNull(); });
});
