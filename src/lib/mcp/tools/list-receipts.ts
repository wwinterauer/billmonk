import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, ok } from "./_shared";
import { ReceiptRecord, withReceiptTagNames } from "./_tags";

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
    const select = tag
      ? `${RECEIPT_LIST_FIELDS}, receipt_tags!inner(tag:tags!inner(name))`
      : RECEIPT_LIST_FIELDS;
    let query = supabaseForUser(ctx)
      .from("receipts")
      .select(select)
      .order("receipt_date", { ascending: false, nullsFirst: false })
      .limit(limit ?? 25);

    if (from) query = query.gte("receipt_date", from);
    if (to) query = query.lte("receipt_date", to);
    if (vendor) query = query.ilike("vendor", `%${vendor}%`);
    if (status) query = query.eq("status", status);
    if (tag) query = query.eq("receipt_tags.tag.name", tag);

    const { data, error } = await query;
    if (error) return fail(error.message);
    const rows = (data ?? []).map((row) => {
      const receipt = { ...row } as Record<string, unknown>;
      delete receipt.receipt_tags;
      return receipt as ReceiptRecord;
    });
    const tagged = await withReceiptTagNames(supabaseForUser(ctx), rows);
    if (tagged.error) return fail(tagged.error);

    return ok(JSON.stringify(tagged.receipts, null, 2), {
      receipts: tagged.receipts,
      count: tagged.receipts.length,
    });
  },
});
