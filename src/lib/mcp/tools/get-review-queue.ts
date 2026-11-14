import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { RECEIPT_FIELDS, fail, ok } from "./_shared";
import { ReceiptRecord, withReceiptTagNames } from "./_tags";
import { withSplitInfo } from "./_splits";

export default defineTool({
  name: "get_review_queue",
  title: "Get review queue",
  description:
    "List receipts waiting for review with their extracted data and tag names. Use get_receipt_document to read the original file and compare. Set include_not_a_receipt to also list documents with status not_a_receipt (e.g. Booking payout overviews set by a vendor rule), which approve_receipt can approve.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("How many receipts to return."),
    offset: z.number().int().min(0).default(0).describe("Skip this many receipts (paging)."),
    include_not_a_receipt: z.boolean().default(false).describe("Also include receipts with status not_a_receipt."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, offset, include_not_a_receipt }, ctx) => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const l = limit ?? 10;
    const o = offset ?? 0;
    const sb = supabaseForUser(ctx);
    const { data, error, count } = await sb
      .from("receipts")
      .select(RECEIPT_FIELDS, { count: "exact" })
      .in("status", include_not_a_receipt ? ["review", "not_a_receipt"] : ["review"])
      .order("created_at", { ascending: true })
      .range(o, o + l - 1);
    if (error) return fail(error.message);
    const tagged = await withReceiptTagNames(sb, (data ?? []) as ReceiptRecord[]);
    if (tagged.error) return fail(tagged.error);
    const split = await withSplitInfo(sb, tagged.receipts);
    if (split.error) return fail(split.error);
    return ok(JSON.stringify({ total_in_review: count ?? 0, receipts: split.receipts }, null, 2), {
      total_in_review: count ?? 0,
      receipts: split.receipts,
    });
  },
});
