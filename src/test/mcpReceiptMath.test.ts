import { describe, it, expect } from "vitest";
import { netFromGross } from "@/lib/mcp/tools/_shared";

describe("netFromGross (MCP receipt correction)", () => {
  it("120 gross at 20% VAT is 100 net", () => expect(netFromGross(120, 20)).toBe(100));
  it("0% VAT keeps net equal to gross", () => expect(netFromGross(50, 0)).toBe(50));
  it("rounds to cents", () => expect(netFromGross(229.04, 20)).toBe(190.87));
});
