import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, ok } from "./_shared";
import { loadTx } from "./_bank";
import { unmatchBankTransaction } from "../../bankReconcile";

export default defineTool({
  name: "unmatch_bank_transaction",
  title: "Unmatch bank transaction",
  description: "Remove the receipt link of a matched transaction like \"Zuordnung aufheben\"; it becomes unmatched. The receipt itself is kept.",
  inputSchema: { transaction_id: z.string().uuid() },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ transaction_id }, ctx) => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const sb = supabaseForUser(ctx);
    const r = await loadTx(sb, transaction_id);
    if (r.error) return r.error;
    if (r.tx.status !== "matched") return fail(`Transaction is ${r.tx.status}, not matched.`);
    try { await unmatchBankTransaction(sb, transaction_id, r.tx.receipt_id); }
    catch (e) { return fail(e instanceof Error ? e.message : String(e)); }
    const result = { transaction_id, status: "unmatched", previous_receipt_id: r.tx.receipt_id };
    return ok(JSON.stringify(result), result);
  },
});
