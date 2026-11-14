import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, ok } from "./_shared";
import { loadTx } from "./_bank";
import { fetchAssignmentReceipts, rankAssignmentCandidates } from "../../bankReconcile";

export default defineTool({
  name: "suggest_bank_matches",
  title: "Suggest receipts for a bank transaction",
  description:
    "Return the same candidate receipts the app's \"Beleg zuordnen\" dialog shows for one transaction (score 0-100 from amount and date distance; default filters: only receipts without linked payment, amount within 10 %). Saves nothing.",
  inputSchema: {
    transaction_id: z.string().uuid(),
    search: z.string().min(1).optional().describe("Vendor/description search, like the dialog's search box."),
    include_assigned: z.boolean().default(false).describe("Also consider receipts already linked to a payment (dialog toggle)."),
    similar_amount: z.boolean().default(true).describe("Dialog filter: amount within 10 %."),
    similar_date: z.boolean().default(false).describe("Dialog filter: date within 7 days."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ transaction_id, search, include_assigned, similar_amount, similar_date }, ctx) => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const sb = supabaseForUser(ctx);
    const r = await loadTx(sb, transaction_id);
    if (r.error) return r.error;
    const tx = r.tx;
    if (!tx.amount || !tx.transaction_date) return fail("Transaction has no amount or date.");
    const receipts = await fetchAssignmentReceipts(sb, tx.user_id, { search, unassignedOnly: !include_assigned });
    const { matching, others } = rankAssignmentCandidates(receipts, Number(tx.amount), new Date(tx.transaction_date), {
      similarAmount: similar_amount, similarDate: similar_date,
    });
    const ids = [...matching, ...others].map((x) => x.id as string);
    const splitIds = new Set<string>();
    if (ids.length) {
      const { data } = await sb.from("receipt_split_lines").select("receipt_id").in("receipt_id", ids);
      for (const l of data ?? []) splitIds.add(l.receipt_id as string);
    }
    const map = (x: (typeof matching)[number]) => ({
      receipt_id: x.id as string,
      score: x.matchScore,
      amount_diff_pct: Math.round(x.amountDiff * 100) / 100,
      date_diff_days: x.dateDiff,
      vendor: (x.vendor as string | null) ?? null,
      amount: x.amount_gross,
      date: x.receipt_date,
      invoice_number: (x.invoice_number as string | null) ?? null,
      status: (x.status as string | null) ?? null,
      category: (x.category as string | null) ?? null,
      already_linked: !!x.bank_transaction_id,
      has_split_lines: splitIds.has(x.id as string),
    });
    const result = {
      transaction: { id: tx.id, date: tx.transaction_date, amount: tx.amount, status: tx.status, description: tx.description },
      suggestions: matching.map(map),
      other_candidates: others.map(map),
    };
    return ok(JSON.stringify(result), result);
  },
});
