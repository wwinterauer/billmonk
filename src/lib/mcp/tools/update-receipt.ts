import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { RECEIPT_FIELDS, fail, netFromGross, ok } from "./_shared";

export default defineTool({
  name: "update_receipt",
  title: "Correct receipt data",
  description:
    "Correct extracted fields of a receipt. If gross and VAT rate change but net is not given, net and VAT amount are recalculated.",
  inputSchema: {
    id: z.string().uuid().describe("Receipt id."),
    vendor: z.string().min(1).optional().describe("Legal vendor name."),
    vendor_brand: z.string().min(1).optional().describe("Vendor brand name."),
    receipt_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Receipt date YYYY-MM-DD."),
    invoice_number: z.string().optional().describe("Invoice number."),
    amount_gross: z.number().optional().describe("Gross amount."),
    amount_net: z.number().optional().describe("Net amount."),
    vat_amount: z.number().optional().describe("VAT amount."),
    vat_rate: z.number().min(0).max(100).optional().describe("VAT rate in percent."),
    category: z.string().min(1).optional().describe("One of the user's existing categories."),
    description: z.string().optional().describe("Short description."),
    skonto_amount: z.number().min(0).optional().describe("Manual cash discount (Skonto) in EUR deducted at payment; 0 removes it. Original invoice amounts stay unchanged."),
    skonto_percent: z.number().min(0).max(100).optional().describe("Manual cash discount in percent of gross; 0 removes it."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, ...input }, ctx) => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const sb = supabaseForUser(ctx);
    const { data: cur, error: e1 } = await sb
      .from("receipts").select("amount_gross, vat_rate, user_modified_fields").eq("id", id).maybeSingle();
    if (e1) return fail(e1.message);
    if (!cur) return fail("Receipt not found.");

    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) if (v !== undefined) patch[k] = v;
    if (Object.keys(patch).length === 0) return fail("No fields to update.");
    const g = Math.abs(Number(patch.amount_gross ?? cur.amount_gross ?? 0));
    if (patch.skonto_amount !== undefined || patch.skonto_percent !== undefined) {
      let amt = patch.skonto_amount as number | undefined;
      if (amt === undefined) amt = Math.round(g * Number(patch.skonto_percent) ) / 100;
      if (!amt) { patch.skonto_amount = null; patch.skonto_percent = null; }
      else { patch.skonto_amount = amt; patch.skonto_percent = g ? Math.round((amt / g) * 10000) / 100 : null; }
    }

    if (patch.category !== undefined) {
      const { data: cats } = await sb.from("categories").select("name").not("is_hidden", "is", true);
      const names = (cats ?? []).map((c: { name: string }) => c.name);
      if (names.length && !names.includes(patch.category as string)) {
        return fail(`Unknown category. Allowed: ${names.join(", ")}`);
      }
    }

    const grossChanged = patch.amount_gross !== undefined || patch.vat_rate !== undefined;
    if (grossChanged && patch.amount_net === undefined) {
      const gross = (patch.amount_gross ?? cur.amount_gross) as number | null;
      const rate = (patch.vat_rate ?? cur.vat_rate) as number | null;
      if (gross !== null && gross !== undefined && rate !== null && rate !== undefined) {
        const net = netFromGross(Number(gross), Number(rate));
        patch.amount_net = net;
        if (patch.vat_amount === undefined) patch.vat_amount = Math.round((Number(gross) - net) * 100) / 100;
      }
    }

    const modified = new Set<string>([...((cur.user_modified_fields as string[] | null) ?? []), ...Object.keys(input).filter((k) => (input as Record<string, unknown>)[k] !== undefined)]);
    patch.user_modified_fields = [...modified];

    const { data, error } = await sb.from("receipts").update(patch).eq("id", id).select(RECEIPT_FIELDS).single();
    if (error) return fail(error.message);
    return ok(JSON.stringify(data, null, 2), { receipt: JSON.parse(JSON.stringify(data)) });
  },
});
