import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { RECEIPT_FIELDS, fail, netFromGross, ok } from "./_shared";
import { lockedFieldsError, NO_INVOICE_CATEGORY } from "./_locks";
import { planTagAssignmentChanges, ReceiptRecord, resolveTagIds, withReceiptTagNames } from "./_tags";

export default defineTool({
  name: "update_receipt",
  title: "Correct receipt data",
  description:
    "Correct extracted fields of a receipt. On approved receipts only category, tags and receipt_date may be changed, all other fields are locked, except that amount_gross, amount_net and vat_amount may be set to null on approved Keine Rechnung receipts. \"Keine Rechnung\" (no_invoice: true, or category \"Keine Rechnung\") marks documents that are not invoices, e.g. Booking payout or Airbnb booking overviews: the receipt keeps its data but is left out of all expense/VAT totals, dashboards and the tax/DATEV export, and is skipped in other exports when \"Keine Rechnung ausschließen\" is selected; amount_gross may be set to null for such entries. This does not approve the receipt; use approve_receipt for that. Always double-check the id matches the document you compared. The optional tags list replaces all tag assignments and accepts only existing tag names. If gross and VAT rate change but net is not given, net and VAT amount are recalculated.",
  inputSchema: {
    id: z.string().uuid().describe("Receipt id."),
    vendor: z.string().min(1).optional().describe("Legal vendor name."),
    vendor_brand: z.string().min(1).optional().describe("Vendor brand name."),
    receipt_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Receipt date YYYY-MM-DD."),
    invoice_number: z.string().optional().describe("Invoice number."),
    amount_gross: z.number().nullable().optional().describe("Gross amount. null clears it (intended for \"Keine Rechnung\" entries without an amount)."),
    amount_net: z.number().nullable().optional().describe("Net amount. null clears it (Keine Rechnung only)."),
    vat_amount: z.number().nullable().optional().describe("VAT amount. null clears it (Keine Rechnung only)."),
    vat_rate: z.number().min(0).max(100).optional().describe("VAT rate in percent."),
    category: z.string().min(1).optional().describe("One of the user's existing categories."),
    description: z.string().optional().describe("Short description."),
    skonto_amount: z.number().min(0).optional().describe("Manual cash discount (Skonto) in EUR deducted at payment; 0 removes it. Original invoice amounts stay unchanged."),
    skonto_percent: z.number().min(0).max(100).optional().describe("Manual cash discount in percent of gross; 0 removes it."),
    no_invoice: z.boolean().optional().describe("true marks the receipt as \"Keine Rechnung\" exactly like the app (category \"Keine Rechnung\" plus no-receipt flag). false only clears the flag; set a new category to leave \"Keine Rechnung\"."),
    tags: z.array(z.string().trim().min(1)).optional().describe("Complete list of existing tag names for this receipt. Replaces all current tags; [] removes every tag. Unknown names are rejected and never created."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, tags: requestedTags, no_invoice, ...input }, ctx) => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const sb = supabaseForUser(ctx);
    const { data: cur, error: e1 } = await sb
      .from("receipts").select("amount_gross, vat_rate, user_modified_fields, status, category, is_no_receipt_entry").eq("id", id).maybeSingle();
    if (e1) return fail(e1.message);
    if (!cur) return fail("Receipt not found.");
    const requestedFields = [
      ...Object.keys(input).filter((k) => (input as Record<string, unknown>)[k] !== undefined),
      ...(requestedTags !== undefined ? ["tags"] : []),
      ...(no_invoice !== undefined ? ["no_invoice"] : []),
    ];
    const locked = lockedFieldsError(cur.status as string | null, requestedFields, {
      isNoInvoice: cur.category === NO_INVOICE_CATEGORY || cur.is_no_receipt_entry === true,
      values: input as Record<string, unknown>,
    });
    if (locked) return fail(locked);

    let desiredTagIds: string[] | undefined;
    let currentTagIds: string[] = [];
    if (requestedTags !== undefined) {
      const { data: existingTags, error: tagsError } = await sb.from("tags").select("id, name");
      if (tagsError) return fail(tagsError.message);
      const resolved = resolveTagIds(requestedTags, existingTags ?? []);
      if (!resolved.ok) return fail(resolved.error);
      desiredTagIds = resolved.tagIds;

      const { data: currentLinks, error: linksError } = await sb
        .from("receipt_tags").select("tag_id").eq("receipt_id", id);
      if (linksError) return fail(linksError.message);
      currentTagIds = (currentLinks ?? []).map((link) => link.tag_id);
    }

    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) if (v !== undefined) patch[k] = v;
    if (no_invoice === true) { patch.category = NO_INVOICE_CATEGORY; patch.is_no_receipt_entry = true; }
    else if (no_invoice === false) patch.is_no_receipt_entry = false;
    if (patch.category === NO_INVOICE_CATEGORY) patch.is_no_receipt_entry = true;
    if (Object.keys(patch).length === 0 && no_invoice === undefined && requestedTags === undefined) return fail("No fields to update.");
    const g = Math.abs(Number(patch.amount_gross ?? cur.amount_gross ?? 0));
    if (patch.skonto_amount !== undefined || patch.skonto_percent !== undefined) {
      let amt = patch.skonto_amount as number | undefined;
      if (amt === undefined) amt = Math.round(g * Number(patch.skonto_percent)) / 100;
      if (!amt) { patch.skonto_amount = null; patch.skonto_percent = null; }
      else { patch.skonto_amount = amt; patch.skonto_percent = g ? Math.round((amt / g) * 10000) / 100 : null; }
    }

    if (patch.category !== undefined) {
      const { data: cats } = await sb.from("categories").select("name").not("is_hidden", "is", true);
      const names = (cats ?? []).map((c: { name: string }) => c.name);
      if (patch.category !== NO_INVOICE_CATEGORY && names.length && !names.includes(patch.category as string)) {
        return fail(`Unknown category. Allowed: ${names.join(", ")}`);
      }
    }

    const grossChanged = patch.amount_gross !== undefined || patch.vat_rate !== undefined;
    if (grossChanged && patch.amount_net === undefined) {
      const gross = (patch.amount_gross ?? cur.amount_gross) as number | null;
      const rate = (patch.vat_rate ?? cur.vat_rate) as number | null;
      if (patch.amount_gross === null) { patch.amount_net = null; patch.vat_amount = null; }
      else if (gross !== null && gross !== undefined && rate !== null && rate !== undefined) {
        const net = netFromGross(Number(gross), Number(rate));
        patch.amount_net = net;
        if (patch.vat_amount === undefined) patch.vat_amount = Math.round((Number(gross) - net) * 100) / 100;
      }
    }

    const modified = new Set<string>([
      ...((cur.user_modified_fields as string[] | null) ?? []),
      ...Object.keys(input).filter((k) => (input as Record<string, unknown>)[k] !== undefined),
      ...(requestedTags !== undefined ? ["tags"] : []),
    ]);
    patch.user_modified_fields = [...modified];

    const { data, error } = await sb.from("receipts").update(patch).eq("id", id).select(RECEIPT_FIELDS).single();
    if (error) return fail(error.message);

    if (desiredTagIds !== undefined) {
      const changes = planTagAssignmentChanges(currentTagIds, desiredTagIds);
      if (changes.upsertTagIds.length > 0) {
        const { error: upsertError } = await sb.from("receipt_tags").upsert(
          changes.upsertTagIds.map((tagId) => ({ receipt_id: id, tag_id: tagId })),
          { onConflict: "receipt_id,tag_id", ignoreDuplicates: true },
        );
        if (upsertError) return fail(upsertError.message);
      }
      if (changes.deleteTagIds.length > 0) {
        const { error: deleteError } = await sb
          .from("receipt_tags").delete().eq("receipt_id", id).in("tag_id", changes.deleteTagIds);
        if (deleteError) return fail(deleteError.message);
      }
    }

    const tagged = await withReceiptTagNames(sb, [data as ReceiptRecord]);
    if (tagged.error) return fail(tagged.error);
    return ok(JSON.stringify(tagged.receipts[0], null, 2), { receipt: tagged.receipts[0] });
  },
});
