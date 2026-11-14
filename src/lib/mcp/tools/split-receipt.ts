import { checkReceiptEditable } from "./_locks";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, ok } from "./_shared";
import { allowedCategoryNames, currentUserId, withSplitInfo } from "./_splits";
import { recalcSplitLine, saveSplitLines, SPLIT_SUM_TOLERANCE, validateSplitSum, type SplitLineInput } from "../../splitBooking";

export default defineTool({
  name: "split_receipt",
  title: "Split booking (Beleg aufteilen)",
  description:
    "Same as 'Beleg aufteilen' in the app: books one receipt onto several parts (categories/VAT rates) while the receipt and its file stay one document. Replaces existing parts. The gross sum must equal the receipt gross (±0.02). Never changes the receipt status.",
  inputSchema: {
    id: z.string().uuid().describe("Receipt id."),
    parts: z.array(z.object({
      amount_gross: z.number().describe("Gross amount of this part."),
      amount_net: z.number().optional().describe("Net amount; if omitted it is calculated from gross and VAT rate."),
      vat_rate: z.number().min(0).max(100).optional().describe("VAT rate in percent; defaults to the receipt's rate."),
      category: z.string().min(1).optional().describe("One of the user's existing categories; defaults to the receipt category."),
      description: z.string().optional().describe("Description of this part."),
      is_private: z.boolean().optional().describe("Mark this part as private (shown as tag 'Privat' in exports)."),
    }).strict()).min(1).describe("Parts of the split booking."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, parts }, ctx) => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const sb = supabaseForUser(ctx);
    const lockErr = await checkReceiptEditable(sb, id);
    if (lockErr) return fail(lockErr);
    const { data: r, error } = await sb.from("receipts").select("id, amount_gross, vat_rate, category").eq("id", id).maybeSingle();
    if (error) return fail(error.message);
    if (!r) return fail("Receipt not found.");
    const cats = await allowedCategoryNames(sb);
    const unknown = parts.map((p) => p.category).filter((c): c is string => !!c && cats.length > 0 && !cats.includes(c));
    if (unknown.length) return fail(`Unknown category: ${[...new Set(unknown)].join(", ")}. Allowed: ${cats.join(", ")}`);

    const lines: SplitLineInput[] = parts.map((p, i) => {
      const base: SplitLineInput = {
        sort_order: i, description: p.description ?? "", category: p.category ?? r.category ?? "",
        tax_type: "", payment_method: "", amount_gross: p.amount_gross, amount_net: p.amount_net ?? 0,
        vat_rate: p.vat_rate ?? Number(r.vat_rate ?? 20), vat_amount: 0, is_private: p.is_private ?? false,
      };
      return recalcSplitLine(base, p.amount_net !== undefined ? "net" : "gross");
    });
    // When net was given, gross was recomputed; keep the caller's gross and derive VAT from both.
    lines.forEach((l, i) => {
      if (parts[i].amount_net !== undefined) {
        l.amount_gross = parts[i].amount_gross;
        l.vat_amount = +(l.amount_gross - l.amount_net).toFixed(2);
      }
    });
    const total = Number(r.amount_gross ?? 0);
    const sum = validateSplitSum(lines, total);
    if (!sum.isValid) {
      return fail(`Sum of parts (${sum.sumGross.toFixed(2)}) does not match the receipt gross amount (${total.toFixed(2)}); difference ${sum.diff.toFixed(2)}, allowed ±${SPLIT_SUM_TOLERANCE}. Nothing was saved.`);
    }
    const userId = await currentUserId(sb, ctx);
    if (!userId) return fail("Not authenticated");
    try { await saveSplitLines(sb, userId, id, lines); } catch (e) { return fail((e as Error).message ?? "Save failed"); }
    const res = await withSplitInfo(sb, [{ id }]);
    if (res.error) return fail(res.error);
    return ok(JSON.stringify(res.receipts[0], null, 2), { receipt: res.receipts[0] });
  },
});
