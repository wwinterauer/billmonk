/** Receipts in these states are final and must never be changed by MCP write tools. */
export const LOCKED_RECEIPT_STATUSES = ["approved", "completed"] as const;

export function lockedReceiptError(status: string | null | undefined): string | null {
  if (status && (LOCKED_RECEIPT_STATUSES as readonly string[]).includes(status)) {
    return `Receipt is ${status} and locked. Splitting and other changes are not allowed via MCP for approved receipts; only category, tags and receipt_date can be changed with update_receipt.`;
  }
  return null;
}

// deno-lint-ignore no-explicit-any
export async function checkReceiptEditable(sb: any, id: string): Promise<string | null> {
  const { data, error } = await sb.from("receipts").select("status").eq("id", id).maybeSingle();
  if (error) return error.message;
  if (!data) return "Receipt not found.";
  return lockedReceiptError(data.status);
}

/** Fields update_receipt may still change on approved receipts. */
export const FIELDS_EDITABLE_WHEN_LOCKED = ["category", "tags", "receipt_date", "no_invoice"] as const;

/** Amount fields that may be cleared (set to null) on approved "Keine Rechnung" receipts. */
export const AMOUNT_FIELDS_CLEARABLE_FOR_NO_INVOICE = ["amount_gross", "amount_net", "vat_amount"] as const;

export function lockedFieldsError(
  status: string | null | undefined,
  fields: string[],
  opts: { isNoInvoice?: boolean; values?: Record<string, unknown> } = {},
): string | null {
  if (!lockedReceiptError(status)) return null;
  const blocked = fields.filter((f) => {
    if ((FIELDS_EDITABLE_WHEN_LOCKED as readonly string[]).includes(f)) return false;
    if (opts.isNoInvoice && (AMOUNT_FIELDS_CLEARABLE_FOR_NO_INVOICE as readonly string[]).includes(f) && opts.values?.[f] === null) return false;
    return true;
  });
  if (blocked.length === 0) return null;
  return `Receipt is ${status}: only category, tags and receipt_date can be changed (amounts may only be cleared to null on Keine Rechnung receipts). Locked fields: ${blocked.join(", ")}.`;
}

/** Category name the app uses for "Keine Rechnung" entries (excluded from totals and tax exports). */
export const NO_INVOICE_CATEGORY = "Keine Rechnung";

/** Review-only rule for delete_receipt: approved/completed receipts can never be deleted via MCP. */
export function deleteReceiptError(status: string | null | undefined): string | null {
  if (status === "review" || status === "duplicate") return null;
  if (lockedReceiptError(status)) return `Receipt is ${status} and cannot be deleted via MCP. Only receipts in review or duplicate can be deleted.`;
  return `Receipt has status "${status ?? "unknown"}". Only receipts in review or duplicate can be deleted.`;
}
