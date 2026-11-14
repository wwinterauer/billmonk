import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, ok } from "./_shared";
import { loadTx } from "./_bank";
import { setBankTransactionStatus } from "../../bankReconcile";

export default defineTool({
  name: "ignore_bank_transaction",
  title: "Ignore bank transaction",
  description: "Mark an unmatched transaction as ignored like \"Ignorieren\" in the app. The app has no field for a reason, so reason is only echoed back, not stored.",
  inputSchema: {
    transaction_id: z.string().uuid(),
    reason: z.string().max(500).optional().describe("Not stored (the app has no reason field); echoed in the reply only."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ transaction_id, reason }, ctx) => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const sb = supabaseForUser(ctx);
    const r = await loadTx(sb, transaction_id);
    if (r.error) return r.error;
    if (r.tx.status !== "unmatched") return fail(`Transaction is ${r.tx.status}; only unmatched transactions can be ignored.`);
    try { await setBankTransactionStatus(sb, transaction_id, "ignored"); }
    catch (e) { return fail(e instanceof Error ? e.message : String(e)); }
    const result = { transaction_id, status: "ignored", reason_stored: false, reason: reason ?? null };
    return ok(JSON.stringify(result), result);
  },
});
