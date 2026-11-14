/** Receipts in these states are final and must never be changed by MCP write tools. */
export const LOCKED_RECEIPT_STATUSES = ["approved", "completed"] as const;

export function lockedReceiptError(status: string | null | undefined): string | null {
  if (status && (LOCKED_RECEIPT_STATUSES as readonly string[]).includes(status)) {
    return `Receipt is ${status} and locked. Approved receipts cannot be changed via MCP; edit it in the app if really needed.`;
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
