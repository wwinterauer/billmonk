import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";
import { fail, ok } from "./_shared";
import { flattenTagCounts } from "./_tags";

export default defineTool({
  name: "list_tags",
  title: "List tags",
  description: "List all of the signed-in user's existing tags with the number of receipts assigned to each tag.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const { data, error } = await supabaseForUser(ctx)
      .from("tags")
      .select("id, name, color, is_active, receipt_tags(count)")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });
    if (error) return fail(error.message);

    const tags = flattenTagCounts((data ?? []) as Array<{
      id: string;
      name: string;
      color: string;
      is_active: boolean | null;
      receipt_tags: Array<{ count: number }>;
    }>);
    return ok(JSON.stringify(tags, null, 2), { tags, count: tags.length });
  },
});
