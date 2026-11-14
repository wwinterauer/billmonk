/** Receipts in these states are final and must never be changed by MCP write tools. */
export const LOCKED_RECEIPT_STATUSES = ["approved", "completed"] as const;

export function lockedReceiptError(status: string | null | undefined): string | null {
  if (status && (LOCKED_RECEIPT_STATUSES as readonly string[]).includes(status)) {
    return `Receipt is ${status} and locked. Splitting and other changes are not allowed via MCP for approved receipts; only category and tags can be changed with update_receipt.`;
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
export const FIELDS_EDITABLE_WHEN_LOCKED = ["category", "tags"] as const;

export function lockedFieldsError(status: string | null | undefined, fields: string[]): string | null {
  if (!lockedReceiptError(status)) return null;
  const blocked = fields.filter((f) => !(FIELDS_EDITABLE_WHEN_LOCKED as readonly string[]).includes(f));
  if (blocked.length === 0) return null;
  return `Receipt is ${status}: only category and tags can be changed. Locked fields: ${blocked.join(", ")}.`;
}
