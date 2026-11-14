import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, ok } from "./_shared";
import { loadTx } from "./_bank";
import { resolveTagIds } from "./_tags";
import { NO_INVOICE_CATEGORY } from "./_locks";
import { createExpenseFromBankTransaction } from "../../bankReconcile";

export default defineTool({
  name: "create_receipt_from_bank_transaction",
  title: "Create receipt from bank transaction",
  description:
    "Create a receipt without file from an unmatched bank transaction like \"Als Ausgabe erstellen\" in the app and link it. Stored like the app: status review, source bank_import, is_no_receipt_entry true, payment_method bank_transfer, gross = absolute booking amount, date = booking date, matching bank keyword rule supplies defaults. Given vendor/category/description/tags/vat_rate replace those defaults. Not approved; use approve_receipt.",
  inputSchema: {
    transaction_id: z.string().uuid(),
    vendor: z.string().min(1).max(200),
    category: z.string().min(1).describe("One of the user's existing categories."),
    description: z.string().min(1).max(500),
    tags: z.array(z.string().min(1)).default([]).describe("Existing tag names; empty list = no tags."),
    vat_rate: z.number().min(0).max(100).optional().describe("VAT rate in percent; default from keyword rule or 0."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ transaction_id, vendor, category, description, tags, vat_rate }, ctx) => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const sb = supabaseForUser(ctx);
    const r = await loadTx(sb, transaction_id);
    if (r.error) return r.error;
    if (r.tx.status !== "unmatched") return fail(`Transaction is ${r.tx.status}; only unmatched transactions can be turned into a receipt.`);
    const { data: cats } = await sb.from("categories").select("name").not("is_hidden", "is", true);
    const names = (cats ?? []).map((c: { name: string }) => c.name);
    if (category !== NO_INVOICE_CATEGORY && names.length && !names.includes(category)) return fail(`Unknown category. Allowed: ${names.join(", ")}`);
    const { data: existingTags, error: te } = await sb.from("tags").select("id, name");
    if (te) return fail(te.message);
    const resolved = resolveTagIds(tags ?? [], existingTags ?? []);
    if (!resolved.ok) return fail(resolved.error);
    try {
      const { receiptId } = await createExpenseFromBankTransaction(sb, r.tx.user_id, r.tx, {
        vendor, category, description, vat_rate, tagIds: resolved.tagIds,
      });
      const { data: rc } = await sb.from("receipts")
        .select("id, status, source, is_no_receipt_entry, vendor, vendor_id, category, description, amount_gross, vat_rate, receipt_date, payment_method, bank_transaction_id")
        .eq("id", receiptId).single();
      const result = { receipt: rc, tags: tags ?? [], transaction_status: "matched" };
      return ok(JSON.stringify(result), result);
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  },
});
