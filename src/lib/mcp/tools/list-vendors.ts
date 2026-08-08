import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_vendors",
  title: "List vendors",
  description: "List the signed-in user's vendors with receipt counts and accumulated totals.",
  inputSchema: {
    search: z.string().trim().min(1).optional().describe("Filter by vendor display name (partial match)."),
    limit: z.number().int().min(1).max(100).default(50).describe("Maximum number of vendors to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let query = supabaseForUser(ctx)
      .from("vendors")
      .select("id, display_name, receipt_count, total_amount, default_vat_rate, default_tax_type, website")
      .order("receipt_count", { ascending: false, nullsFirst: false })
      .limit(limit ?? 50);

    if (search) query = query.ilike("display_name", `%${search}%`);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { vendors: data ?? [], count: data?.length ?? 0 },
    };
  },
});
