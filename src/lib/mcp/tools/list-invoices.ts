import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_invoices",
  title: "List invoices",
  description:
    "List the signed-in user's outgoing documents (invoices, quotes, orders, delivery notes) with status and totals.",
  inputSchema: {
    status: z.string().trim().min(1).optional().describe("Filter by status, e.g. draft, sent, paid."),
    document_type: z.string().trim().min(1).optional().describe("Filter by document type, e.g. invoice, quote."),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Earliest invoice date (YYYY-MM-DD)."),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Latest invoice date (YYYY-MM-DD)."),
    limit: z.number().int().min(1).max(100).default(25).describe("Maximum number of documents to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, document_type, from, to, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let query = supabaseForUser(ctx)
      .from("invoices")
      .select(
        "id, invoice_number, document_type, status, invoice_date, due_date, paid_at, subtotal, vat_total, total, currency, customer_id",
      )
      .order("invoice_date", { ascending: false, nullsFirst: false })
      .limit(limit ?? 25);

    if (status) query = query.eq("status", status);
    if (document_type) query = query.eq("document_type", document_type);
    if (from) query = query.gte("invoice_date", from);
    if (to) query = query.lte("invoice_date", to);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { invoices: data ?? [], count: data?.length ?? 0 },
    };
  },
});
