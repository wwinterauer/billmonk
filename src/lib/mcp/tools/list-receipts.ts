import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, ok } from "./_shared";
import { ReceiptRecord, withReceiptTagNames } from "./_tags";
import { withSplitInfo } from "./_splits";

const RECEIPT_LIST_FIELDS =
  "id, receipt_date, vendor, vendor_brand, description, amount_gross, amount_net, vat_amount, vat_rate, currency, category, tax_type, status, invoice_number";

export default defineTool({
  name: "list_receipts",
  title: "List receipts",
  description:
    "List the signed-in user's expense receipts with tag names, optionally filtered by date range, vendor, status or one exact tag name.",
  inputSchema: {
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Start receipt date (YYYY-MM-DD)."),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("End receipt date (YYYY-MM-DD)."),
    vendor: z.string().trim().min(1).optional().describe("Filter by vendor name (partial match)."),
    status: z.string().trim().min(1).optional().describe("Filter by receipt status, e.g. completed."),
    tag: z.string().trim().min(1).optional().describe("Filter by one exact existing tag name."),
    limit: z.number().int().min(1).max(100).default(25).describe("Maximum number of receipts to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, vendor, status, tag, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const sb = supabaseForUser(ctx);
    let receiptIdsForTag: string[] | undefined;

    if (tag) {
      const { data: matchingTags, error: tagError } = await sb.from("tags").select("id").eq("name", tag);
      if (tagError) return fail(tagError.message);
      const tagIds = (matchingTags ?? []).map((row) => row.id);
      if (tagIds.length === 0) return ok("[]", { receipts: [], count: 0 });

      const { data: links, error: linksError } = await sb
        .from("receipt_tags").select("receipt_id").in("tag_id", tagIds);
      if (linksError) return fail(linksError.message);
      receiptIdsForTag = [...new Set((links ?? []).map((row) => row.receipt_id))];
      if (receiptIdsForTag.length === 0) return ok("[]", { receipts: [], count: 0 });
    }

    let query = sb
      .from("receipts")
      .select(RECEIPT_LIST_FIELDS)
      .order("receipt_date", { ascending: false, nullsFirst: false })
      .limit(limit ?? 25);

    if (from) query = query.gte("receipt_date", from);
    if (to) query = query.lte("receipt_date", to);
    if (vendor) query = query.ilike("vendor", `%${vendor}%`);
    if (status) query = query.eq("status", status);
    if (receiptIdsForTag) query = query.in("id", receiptIdsForTag);

    const { data, error } = await query;
    if (error) return fail(error.message);
    const tagged = await withReceiptTagNames(sb, (data ?? []) as ReceiptRecord[]);
    if (tagged.error) return fail(tagged.error);
    const split = await withSplitInfo(sb, tagged.receipts);
    if (split.error) return fail(split.error);

    return ok(JSON.stringify(split.receipts, null, 2), {
      receipts: split.receipts,
      count: split.receipts.length,
    });
  },
});
