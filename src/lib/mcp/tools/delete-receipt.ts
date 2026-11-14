import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, ok } from "./_shared";
import { deleteReceiptError } from "./_locks";
import { currentUserId } from "./_splits";
import { deleteReceiptAndFile } from "../../receiptDelete";

export default defineTool({
  name: "delete_receipt",
  title: "Delete receipt",
  description:
    "Permanently delete a receipt together with its stored file, exactly like \"Beleg löschen\" in the review. Only allowed for receipts in review; approved receipts are refused. Cannot be undone.",
  inputSchema: { id: z.string().uuid().describe("Receipt id (must have status review).") },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const sb = supabaseForUser(ctx);
    const userId = await currentUserId(sb);
    if (!userId) return fail("Not authenticated");
    const { data: r, error } = await sb
      .from("receipts").select("id, status, vendor, vendor_brand, amount_gross, receipt_date, file_name, file_url")
      .eq("id", id).maybeSingle();
    if (error) return fail(error.message);
    if (!r) return fail("Receipt not found.");
    const blocked = deleteReceiptError(r.status as string | null);
    if (blocked) return fail(blocked);
    let storageError: string | undefined;
    try {
      ({ storageError } = await deleteReceiptAndFile(sb, userId, id, (r.file_url as string | null) ?? null));
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
    const deleted = {
      id,
      vendor: (r.vendor_brand ?? r.vendor ?? null) as string | null,
      amount_gross: (r.amount_gross ?? null) as number | null,
      receipt_date: (r.receipt_date ?? null) as string | null,
      file_name: (r.file_name ?? null) as string | null,
      file_deleted: !storageError && !!r.file_url,
      ...(storageError ? { storage_warning: storageError } : {}),
    };
    return ok(`Deleted receipt: ${JSON.stringify(deleted)}`, { deleted });
  },
});
