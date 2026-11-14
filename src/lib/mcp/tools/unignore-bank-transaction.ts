import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, ok } from "./_shared";
import { loadTx } from "./_bank";
import { setBankTransactionStatus } from "../../bankReconcile";

export default defineTool({
  name: "unignore_bank_transaction",
  title: "Restore ignored bank transaction",
  description: "Set an ignored transaction back to unmatched like \"Wiederherstellen\" in the app.",
  inputSchema: { transaction_id: z.string().uuid() },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ transaction_id }, ctx) => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const sb = supabaseForUser(ctx);
    const r = await loadTx(sb, transaction_id);
    if (r.error) return r.error;
    if (r.tx.status !== "ignored") return fail(`Transaction is ${r.tx.status}, not ignored.`);
    try { await setBankTransactionStatus(sb, transaction_id, "unmatched"); }
    catch (e) { return fail(e instanceof Error ? e.message : String(e)); }
    const result = { transaction_id, status: "unmatched" };
    return ok(JSON.stringify(result), result);
  },
});
