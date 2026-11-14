import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, ok } from "./_shared";

export default defineTool({
  name: "list_bank_transactions",
  title: "List bank transactions",
  description: "List imported bank transactions, optionally only unmatched ones, by date range or text.",
  inputSchema: {
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Start date YYYY-MM-DD."),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("End date YYYY-MM-DD."),
    search: z.string().min(1).optional().describe("Text contained in the booking description."),
    unmatched_only: z.boolean().default(false).describe("Only transactions without a linked receipt."),
    limit: z.number().int().min(1).max(200).default(50).describe("Maximum rows."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, search, unmatched_only, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    let q = supabaseForUser(ctx)
      .from("bank_transactions")
      .select("id, transaction_date, description, amount, is_expense, status, receipt_id")
      .order("transaction_date", { ascending: false })
      .limit(limit ?? 50);
    if (from) q = q.gte("transaction_date", from);
    if (to) q = q.lte("transaction_date", to);
    if (search) q = q.ilike("description", `%${search}%`);
    if (unmatched_only) q = q.is("receipt_id", null);
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok(JSON.stringify(data ?? [], null, 2), { transactions: JSON.parse(JSON.stringify(data ?? [])) });
  },
});
