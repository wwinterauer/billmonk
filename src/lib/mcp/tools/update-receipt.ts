import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { RECEIPT_FIELDS, fail, netFromGross, ok } from "./_shared";
import { lockedFieldsError } from "./_locks";
import { planTagAssignmentChanges, ReceiptRecord, resolveTagIds, withReceiptTagNames } from "./_tags";

export default defineTool({
  name: "update_receipt",
  title: "Correct receipt data",
  description:
    "Correct extracted fields of a receipt ; on approved receipts only category and tags may be changed, all other fields are locked. Always double-check the id matches the document you compared. The optional tags list replaces all tag assignments and accepts only existing tag names. If gross and VAT rate change but net is not given, net and VAT amount are recalculated.",
  inputSchema: {
    id: z.string().uuid().describe("Receipt id."),
    vendor: z.string().min(1).optional().describe("Legal vendor name."),
    vendor_brand: z.string().min(1).optional().describe("Vendor brand name."),
    receipt_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Receipt date YYYY-MM-DD."),
    invoice_number: z.string().optional().describe("Invoice number."),
    amount_gross: z.number().optional().describe("Gross amount."),
    amount_net: z.number().optional().describe("Net amount."),
    vat_amount: z.number().optional().describe("VAT amount."),
    vat_rate: z.number().min(0).max(100).optional().describe("VAT rate in percent."),
    category: z.string().min(1).optional().describe("One of the user's existing categories."),
    description: z.string().optional().describe("Short description."),
    skonto_amount: z.number().min(0).optional().describe("Manual cash discount (Skonto) in EUR deducted at payment; 0 removes it. Original invoice amounts stay unchanged."),
    skonto_percent: z.number().min(0).max(100).optional().describe("Manual cash discount in percent of gross; 0 removes it."),
    tags: z.array(z.string().trim().min(1)).optional().describe("Complete list of existing tag names for this receipt. Replaces all current tags; [] removes every tag. Unknown names are rejected and never created."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, tags: requestedTags, ...input }, ctx) => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const sb = supabaseForUser(ctx);
    const { data: cur, error: e1 } = await sb
      .from("receipts").select("amount_gross, vat_rate, user_modified_fields, status").eq("id", id).maybeSingle();
    if (e1) return fail(e1.message);
    if (!cur) return fail("Receipt not found.");
    const requestedFields = [
      ...Object.keys(input).filter((k) => (input as Record<string, unknown>)[k] !== undefined),
      ...(requestedTags !== undefined ? ["tags"] : []),
    ];
    const locked = lockedFieldsError(cur.status as string | null, requestedFields);
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
    if (Object.keys(patch).length === 0 && requestedTags === undefined) return fail("No fields to update.");
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
      if (names.length && !names.includes(patch.category as string)) {
        return fail(`Unknown category. Allowed: ${names.join(", ")}`);
      }
    }

    const grossChanged = patch.amount_gross !== undefined || patch.vat_rate !== undefined;
    if (grossChanged && patch.amount_net === undefined) {
      const gross = (patch.amount_gross ?? cur.amount_gross) as number | null;
      const rate = (patch.vat_rate ?? cur.vat_rate) as number | null;
      if (gross !== null && gross !== undefined && rate !== null && rate !== undefined) {
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
