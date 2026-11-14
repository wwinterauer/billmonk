/**
 * Shared split-booking ("Beleg aufteilen") logic used by the app editor and the MCP tools.
 * One implementation: same table, same sum tolerance, same math, same persistence.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const SPLIT_SUM_TOLERANCE = 0.02;

export interface SplitLineInput {
  sort_order: number;
  description: string;
  category: string;
  tax_type: string;
  payment_method: string;
  amount_gross: number;
  amount_net: number;
  vat_rate: number;
  vat_amount: number;
  is_private: boolean;
  _lastEdited?: "gross" | "net";
}

export function recalcSplitLine<T extends SplitLineInput>(line: T, field: "gross" | "net" | "vat_rate"): T {
  const updated = { ...line };
  if (field === "gross" || (field === "vat_rate" && line._lastEdited === "gross")) {
    updated.amount_net = +(updated.amount_gross / (1 + updated.vat_rate / 100)).toFixed(2);
    updated._lastEdited = field === "gross" ? "gross" : updated._lastEdited;
  } else {
    updated.amount_gross = +(updated.amount_net * (1 + updated.vat_rate / 100)).toFixed(2);
    updated._lastEdited = field === "net" ? "net" : updated._lastEdited;
  }
  updated.vat_amount = +(updated.amount_gross - updated.amount_net).toFixed(2);
  return updated;
}

export function validateSplitSum(lines: Array<{ amount_gross: number }>, totalGross: number) {
  const sumGross = lines.reduce((s, l) => s + l.amount_gross, 0);
  const diff = Math.abs(sumGross - totalGross);
  return { sumGross: +sumGross.toFixed(2), diff: +diff.toFixed(2), isValid: diff <= SPLIT_SUM_TOLERANCE };
}

/** Builds the AI split suggestion from the receipt's extracted line items (the "KI-Vorschläge" button). */
export function splitLinesFromLineItems(
  lineItems: unknown,
  defaults: { mainVatRate?: number; mainCategory?: string; taxType?: string },
): SplitLineInput[] | null {
  if (!Array.isArray(lineItems) || lineItems.length === 0) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return lineItems.map((item: any, idx: number) => {
    const vatRate = parseFloat(String(item.tax_rate ?? item.vat_rate ?? defaults.mainVatRate ?? 20).replace("%", "").replace(",", ".")) || 0;
    const grossAmount = Math.abs(Number(item.total) || Number(item.amount_gross) || 0);
    const netAmount = vatRate === 0 ? grossAmount : +(grossAmount / (1 + vatRate / 100)).toFixed(2);
    return {
      sort_order: idx,
      description: item.description || "",
      category: item.category || defaults.mainCategory || "",
      tax_type: item.tax_type || defaults.taxType || "",
      payment_method: "",
      amount_gross: grossAmount,
      amount_net: netAmount,
      vat_rate: vatRate,
      vat_amount: +(grossAmount - netAmount).toFixed(2),
      is_private: false,
      _lastEdited: "gross" as const,
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

export async function saveSplitLines(sb: AnyClient, userId: string, receiptId: string, lines: SplitLineInput[]) {
  const { error: delError } = await sb.from("receipt_split_lines").delete().eq("receipt_id", receiptId);
  if (delError) throw delError;
  const inserts = lines.map((l, i) => ({
    receipt_id: receiptId,
    user_id: userId,
    sort_order: i,
    description: l.description || null,
    category: l.category || null,
    tax_type: l.tax_type || null,
    payment_method: l.payment_method || null,
    amount_gross: l.amount_gross,
    amount_net: l.amount_net,
    vat_rate: l.vat_rate,
    vat_amount: l.vat_amount,
    is_private: l.is_private,
  }));
  const { error: insertError } = await sb.from("receipt_split_lines").insert(inserts);
  if (insertError) throw insertError;
  const { error: updError } = await sb.from("receipts").update({ is_split_booking: true }).eq("id", receiptId);
  if (updError) throw updError;
}

export async function removeSplitBooking(sb: AnyClient, receiptId: string) {
  const { error: delError } = await sb.from("receipt_split_lines").delete().eq("receipt_id", receiptId);
  if (delError) throw delError;
  const { error } = await sb.from("receipts").update({ is_split_booking: false }).eq("id", receiptId);
  if (error) throw error;
}
