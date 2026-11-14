import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, ok } from "./_shared";
import { allowedCategoryNames, SPLIT_PART_FIELDS, withSplitInfo } from "./_splits";
import { recalcSplitLine, SPLIT_SUM_TOLERANCE, validateSplitSum, type SplitLineInput } from "../../splitBooking";

export default defineTool({
  name: "update_split_part",
  title: "Correct one split part",
  description:
    "Correct a single part of a split booking. Changing the amount must keep the parts' gross sum equal to the receipt gross (±0.02), otherwise use split_receipt to redistribute. Never changes the receipt status.",
  inputSchema: {
    part_id: z.string().uuid().describe("Split part id (from split_parts)."),
    amount_gross: z.number().optional().describe("New gross amount."),
    amount_net: z.number().optional().describe("New net amount (gross is then derived from net and VAT rate)."),
    vat_rate: z.number().min(0).max(100).optional().describe("New VAT rate in percent."),
    category: z.string().min(1).optional().describe("One of the user's existing categories."),
    description: z.string().optional().describe("New description."),
    is_private: z.boolean().optional().describe("Mark this part as private."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ part_id, ...input }, ctx) => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    if (Object.values(input).every((v) => v === undefined)) return fail("No fields to update.");
    const sb = supabaseForUser(ctx);
    const { data: part, error } = await sb.from("receipt_split_lines").select(SPLIT_PART_FIELDS).eq("id", part_id).maybeSingle();
    if (error) return fail(error.message);
    if (!part) return fail("Split part not found.");
    if (input.category !== undefined) {
      const cats = await allowedCategoryNames(sb);
      if (cats.length && !cats.includes(input.category)) return fail(`Unknown category. Allowed: ${cats.join(", ")}`);
    }
    let line: SplitLineInput = {
      sort_order: part.sort_order, description: part.description ?? "", category: part.category ?? "",
      tax_type: part.tax_type ?? "", payment_method: "", amount_gross: Number(part.amount_gross),
      amount_net: Number(part.amount_net), vat_rate: Number(part.vat_rate), vat_amount: Number(part.vat_amount),
      is_private: part.is_private, _lastEdited: "gross",
    };
    if (input.vat_rate !== undefined) line.vat_rate = input.vat_rate;
    if (input.amount_net !== undefined) { line.amount_net = input.amount_net; line = recalcSplitLine(line, "net"); }
    else if (input.amount_gross !== undefined) { line.amount_gross = input.amount_gross; line = recalcSplitLine(line, "gross"); }
    else if (input.vat_rate !== undefined) line = recalcSplitLine(line, "vat_rate");

    const amountsChanged = input.amount_gross !== undefined || input.amount_net !== undefined || input.vat_rate !== undefined;
    if (amountsChanged) {
      const [{ data: r }, { data: siblings }] = await Promise.all([
        sb.from("receipts").select("amount_gross").eq("id", part.receipt_id).maybeSingle(),
        sb.from("receipt_split_lines").select("id, amount_gross").eq("receipt_id", part.receipt_id),
      ]);
      const total = Number(r?.amount_gross ?? 0);
      const all = (siblings ?? []).map((s) => ({ amount_gross: s.id === part_id ? line.amount_gross : Number(s.amount_gross) }));
      const sum = validateSplitSum(all, total);
      if (!sum.isValid) {
        return fail(`Sum of parts would be ${sum.sumGross.toFixed(2)} instead of the receipt gross ${total.toFixed(2)} (difference ${sum.diff.toFixed(2)}, allowed ±${SPLIT_SUM_TOLERANCE}). Nothing was saved; use split_receipt to redistribute all parts.`);
      }
    }
    const patch: Record<string, unknown> = {
      amount_gross: line.amount_gross, amount_net: line.amount_net, vat_rate: line.vat_rate, vat_amount: line.vat_amount,
    };
    if (input.category !== undefined) patch.category = input.category;
    if (input.description !== undefined) patch.description = input.description || null;
    if (input.is_private !== undefined) patch.is_private = input.is_private;
    const { error: uErr } = await sb.from("receipt_split_lines").update(patch).eq("id", part_id);
    if (uErr) return fail(uErr.message);
    const res = await withSplitInfo(sb, [{ id: part.receipt_id as string }]);
    if (res.error) return fail(res.error);
    return ok(JSON.stringify(res.receipts[0], null, 2), { receipt: res.receipts[0] });
  },
});
