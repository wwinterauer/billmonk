import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, ok } from "./_shared";
import { splitLinesFromLineItems, validateSplitSum } from "../../splitBooking";

export default defineTool({
  name: "split_receipt_ai",
  title: "Suggest split booking from AI line items",
  description:
    "Same as the app's 'KI-Vorschläge' button in 'Beleg aufteilen': builds split parts from the line items the AI extracted for this receipt. Returns the proposal only and saves nothing; apply it (optionally adjusted) with split_receipt. Never changes the receipt status.",
  inputSchema: { id: z.string().uuid().describe("Receipt id.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const sb = supabaseForUser(ctx);
    const { data: r, error } = await sb.from("receipts")
      .select("line_items_raw, category, vat_rate, amount_gross").eq("id", id).maybeSingle();
    if (error) return fail(error.message);
    if (!r) return fail("Receipt not found.");
    const parts = splitLinesFromLineItems(r.line_items_raw, {
      mainVatRate: r.vat_rate ?? undefined, mainCategory: r.category ?? undefined,
    });
    if (!parts) {
      return fail(r.category === "Keine Rechnung"
        ? "Document was not recognised as a receipt, so no AI line items exist."
        : "No AI line items were extracted for this receipt. Re-analyse it in the app first.");
    }
    const sum = validateSplitSum(parts, Number(r.amount_gross ?? 0));
    const proposal = parts.map(({ _lastEdited: _l, ...p }) => p);
    const result = { receipt_amount_gross: r.amount_gross, sum_gross: sum.sumGross, difference: sum.diff, sum_matches: sum.isValid, parts: proposal };
    return ok(JSON.stringify(result, null, 2), result);
  },
});
