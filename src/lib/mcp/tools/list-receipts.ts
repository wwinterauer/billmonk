import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_receipts",
  title: "List receipts",
  description:
    "List the signed-in user's expense receipts, optionally filtered by date range, vendor or status.",
  inputSchema: {
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Start receipt date (YYYY-MM-DD)."),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("End receipt date (YYYY-MM-DD)."),
    vendor: z.string().trim().min(1).optional().describe("Filter by vendor name (partial match)."),
    status: z.string().trim().min(1).optional().describe("Filter by receipt status, e.g. completed."),
    limit: z.number().int().min(1).max(100).default(25).describe("Maximum number of receipts to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, vendor, status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let query = supabaseForUser(ctx)
      .from("receipts")
      .select(
        "id, receipt_date, vendor, vendor_brand, description, amount_gross, amount_net, vat_amount, vat_rate, currency, category, tax_type, status, invoice_number",
      )
      .order("receipt_date", { ascending: false, nullsFirst: false })
      .limit(limit ?? 25);

    if (from) query = query.gte("receipt_date", from);
    if (to) query = query.lte("receipt_date", to);
    if (vendor) query = query.ilike("vendor", `%${vendor}%`);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { receipts: data ?? [], count: data?.length ?? 0 },
    };
  },
});
