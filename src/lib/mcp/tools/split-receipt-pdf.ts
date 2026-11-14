import { checkReceiptEditable } from "./_locks";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, ok } from "./_shared";

export default defineTool({
  name: "split_receipt_pdf",
  title: "Divide PDF into separate receipts (Beleg teilen)",
  description:
    "Same as 'PDF aufteilen' in the app, for a PDF that contains several invoices: cuts the PDF by page numbers into separate files, creates one new receipt per part (each is re-analysed by the AI and lands in review), and deletes the original receipt and file. Needs at least 2 parts with pages. Irreversible. Does not approve anything.",
  inputSchema: {
    id: z.string().uuid().describe("Receipt id of the multi-invoice PDF."),
    splits: z.array(z.object({
      pages: z.array(z.number().int().min(1)).min(1).describe("1-based page numbers for this new receipt."),
      vendor_name: z.string().optional().describe("Optional vendor hint."),
      invoice_number: z.string().optional().describe("Optional invoice number hint."),
      total_amount: z.number().optional().describe("Optional total amount hint."),
      date: z.string().optional().describe("Optional date hint."),
    }).strict()).min(2).describe("Parts, as used by the app dialog."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  handler: async ({ id, splits }, ctx) => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const sb = supabaseForUser(ctx);
    const lockErr = await checkReceiptEditable(sb, id);
    if (lockErr) return fail(lockErr);
    const { data, error } = await sb.functions.invoke("split-pdf", { body: { receiptId: id, splits } });
    if (error) {
      let msg = error.message;
      try { const body = await (error as { context?: Response }).context?.json(); if (body?.error) msg = body.error; } catch { /* keep */ }
      return fail(msg);
    }
    if (!data?.success) return fail(data?.error ?? "Split failed");
    const result = { original_receipt_id: id, created_receipts: data.createdReceipts, count: data.count, message: data.message };
    return ok(JSON.stringify(result, null, 2), result);
  },
});
