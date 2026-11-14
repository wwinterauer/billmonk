/** Receipts in these states are final and must never be changed by MCP write tools. */
export const LOCKED_RECEIPT_STATUSES = ["approved", "completed"] as const;

export function lockedReceiptError(status: string | null | undefined): string | null {
  if (status && (LOCKED_RECEIPT_STATUSES as readonly string[]).includes(status)) {
    return `Receipt is ${status} and locked. Splitting and other changes are not allowed via MCP for approved receipts; only category, tags, receipt_date, invoice_number and the net/VAT split (gross unchanged) can be changed with update_receipt.`;
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
export const FIELDS_EDITABLE_WHEN_LOCKED = ["category", "tags", "receipt_date", "no_invoice", "invoice_number"] as const;

/** Amount fields that may be cleared (set to null) on approved "Keine Rechnung" receipts. */
export const AMOUNT_FIELDS_CLEARABLE_FOR_NO_INVOICE = ["amount_gross", "amount_net", "vat_amount"] as const;

/** Net/VAT split fields correctable on approved receipts while gross stays unchanged. */
export const SPLIT_FIELDS_CORRECTABLE_WHEN_LOCKED = ["amount_net", "vat_amount", "vat_rate"] as const;
export const SPLIT_TOLERANCE = 0.02;

/** Error when net + VAT does not add up to gross (tolerance 2 cents). */
export function splitConsistencyError(gross: unknown, net: unknown, vat: unknown): string | null {
  if (typeof gross !== "number" || typeof net !== "number" || typeof vat !== "number") {
    return "On approved receipts amount_gross, amount_net and vat_amount must all be numbers after the correction.";
  }
  if (Math.abs(net + vat - gross) > SPLIT_TOLERANCE + 1e-9) {
    return `amount_net (${net}) + vat_amount (${vat}) must equal amount_gross (${gross}) within 0.02.`;
  }
  return null;
}

export function lockedFieldsError(
  status: string | null | undefined,
  fields: string[],
  opts: { isNoInvoice?: boolean; values?: Record<string, unknown>; currentGross?: number | null } = {},
): string | null {
  if (!lockedReceiptError(status)) return null;
  const grossUntouched = !fields.includes("amount_gross") && typeof opts.currentGross === "number";
  const blocked = fields.filter((f) => {
    if ((FIELDS_EDITABLE_WHEN_LOCKED as readonly string[]).includes(f)) return false;
    if (grossUntouched && (SPLIT_FIELDS_CORRECTABLE_WHEN_LOCKED as readonly string[]).includes(f) && opts.values?.[f] !== null) return false;
    if (opts.isNoInvoice && (AMOUNT_FIELDS_CLEARABLE_FOR_NO_INVOICE as readonly string[]).includes(f) && opts.values?.[f] === null) return false;
    return true;
  });
  if (blocked.length === 0) return null;
  return `Receipt is ${status}: only category, tags, receipt_date and invoice_number can be changed, plus amount_net/vat_amount/vat_rate while amount_gross stays unchanged and net + VAT = gross (amounts may only be cleared to null on Keine Rechnung receipts). Locked fields: ${blocked.join(", ")}.`;
}

/** Category name the app uses for "Keine Rechnung" entries (excluded from totals and tax exports). */
export const NO_INVOICE_CATEGORY = "Keine Rechnung";

/** Review-only rule for delete_receipt: approved/completed receipts can never be deleted via MCP. */
export function deleteReceiptError(status: string | null | undefined): string | null {
  if (status === "review" || status === "duplicate") return null;
  if (lockedReceiptError(status)) return `Receipt is ${status} and cannot be deleted via MCP. Only receipts in review or duplicate can be deleted.`;
  return `Receipt has status "${status ?? "unknown"}". Only receipts in review or duplicate can be deleted.`;
}
