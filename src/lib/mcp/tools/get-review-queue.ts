import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { RECEIPT_FIELDS, fail, ok } from "./_shared";

export default defineTool({
  name: "get_review_queue",
  title: "Get review queue",
  description:
    "List receipts waiting for review with their extracted data. Use get_receipt_document to read the original file and compare.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("How many receipts to return."),
    offset: z.number().int().min(0).default(0).describe("Skip this many receipts (paging)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, offset }, ctx) => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const l = limit ?? 10;
    const o = offset ?? 0;
    const { data, error, count } = await supabaseForUser(ctx)
      .from("receipts")
      .select(RECEIPT_FIELDS, { count: "exact" })
      .eq("status", "review")
      .order("created_at", { ascending: true })
      .range(o, o + l - 1);
    if (error) return fail(error.message);
    return ok(JSON.stringify({ total_in_review: count ?? 0, receipts: data ?? [] }, null, 2), {
      total_in_review: count ?? 0,
      receipts: JSON.parse(JSON.stringify(data ?? [])),
    });
  },
});
