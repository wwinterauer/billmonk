import { fail } from "./_shared";

// deno-lint-ignore no-explicit-any
export async function loadTx(sb: any, id: string) {
  const { data, error } = await sb
    .from("bank_transactions")
    .select("id, user_id, status, receipt_id, receipt_split_line_id, amount, description, transaction_date")
    .eq("id", id)
    .maybeSingle();
  if (error) return { error: fail(error.message) };
  if (!data) return { error: fail("Bank transaction not found.") };
  return { tx: data as { id: string; user_id: string; status: string | null; receipt_id: string | null; receipt_split_line_id: string | null; amount: number | null; description: string | null; transaction_date: string | null } };
}

export const compact = (v: unknown) => JSON.stringify(v);
