import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, ok } from "./_shared";
import { loadTx } from "./_bank";
import { assignBankTransaction } from "../../bankReconcile";

export default defineTool({
  name: "match_bank_transaction",
  title: "Match bank transaction to receipt",
  description:
    "Link an unmatched bank transaction to a receipt exactly like \"Zuordnen\" in the app. No amount check (Skonto or small deviations are allowed) and several transactions may be linked to the same receipt (e.g. payroll journal). If the receipt is a split booking, split_line_id is required, like the app's line picker. Does not change the receipt's amounts or status.",
  inputSchema: {
    transaction_id: z.string().uuid(),
    receipt_id: z.string().uuid(),
    split_line_id: z.string().uuid().optional().describe("Split line of the receipt, required when the receipt has split lines."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ transaction_id, receipt_id, split_line_id }, ctx) => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const sb = supabaseForUser(ctx);
    const r = await loadTx(sb, transaction_id);
    if (r.error) return r.error;
    if (r.tx.status !== "unmatched") return fail(`Transaction is ${r.tx.status}; only unmatched transactions can be matched (use unmatch/unignore first).`);
    const { data: rc, error } = await sb.from("receipts").select("id, vendor, amount_gross, receipt_date, invoice_number, bank_transaction_id").eq("id", receipt_id).maybeSingle();
    if (error) return fail(error.message);
    if (!rc) return fail("Receipt not found.");
    const { data: lines } = await sb.from("receipt_split_lines").select("id, description, amount_gross").eq("receipt_id", receipt_id).order("sort_order");
    if ((lines ?? []).length > 0) {
      if (!split_line_id) return fail(`Receipt is a split booking; pass split_line_id. Lines: ${JSON.stringify(lines)}`);
      if (!lines!.some((l) => l.id === split_line_id)) return fail("split_line_id does not belong to this receipt.");
    } else if (split_line_id) return fail("Receipt has no split lines.");
    try {
      await assignBankTransaction(sb, transaction_id, receipt_id, split_line_id ?? null);
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
    const diff = rc.amount_gross != null && r.tx.amount != null ? Math.round((Math.abs(Number(r.tx.amount)) - Math.abs(Number(rc.amount_gross))) * 100) / 100 : null;
    const result = {
      matched: true, transaction_id, receipt_id, split_line_id: split_line_id ?? null,
      receipt: { vendor: rc.vendor, amount: rc.amount_gross, date: rc.receipt_date, invoice_number: rc.invoice_number },
      amount_difference: diff,
      receipt_previously_linked_to: rc.bank_transaction_id && rc.bank_transaction_id !== transaction_id ? rc.bank_transaction_id : null,
    };
    return ok(JSON.stringify(result), result);
  },
});
