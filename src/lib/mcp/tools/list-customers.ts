import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_customers",
  title: "List customers",
  description: "List the signed-in user's customers with contact and billing defaults.",
  inputSchema: {
    search: z.string().trim().min(1).optional().describe("Filter by display name (partial match)."),
    include_archived: z.boolean().default(false).describe("Include archived customers."),
    limit: z.number().int().min(1).max(100).default(50).describe("Maximum number of customers to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, include_archived, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let query = supabaseForUser(ctx)
      .from("customers")
      .select(
        "id, display_name, company_name, contact_person, email, phone, city, country, customer_number, payment_terms_days, default_currency, is_archived",
      )
      .order("display_name", { ascending: true })
      .limit(limit ?? 50);

    if (!include_archived) query = query.eq("is_archived", false);
    if (search) query = query.ilike("display_name", `%${search}%`);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { customers: data ?? [], count: data?.length ?? 0 },
    };
  },
});
