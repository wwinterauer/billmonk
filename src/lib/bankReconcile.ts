/**
 * Single implementation of the "Kontoabgleich" actions, shared by the app
 * (Reconciliation page, ReceiptAssignmentModal) and the MCP server.
 * All functions take the caller's Supabase client so RLS applies.
 */
// deno-lint-ignore-file no-explicit-any
type Sb = any;

export type BankTxStatus = "unmatched" | "matched" | "ignored";

/** Score used by the manual assignment dialog ("x% Match"). */
export function calculateMatchScore(
  transactionAmount: number,
  transactionDate: Date,
  receiptAmount: number | null,
  receiptDate: string | null,
): { score: number; amountDiff: number; dateDiff: number | null } {
  let score = 0;
  const absTx = Math.abs(transactionAmount);
  const amountDiff = receiptAmount !== null ? (Math.abs(absTx - receiptAmount) / absTx) * 100 : 100;
  if (receiptAmount !== null) {
    if (amountDiff < 1) score += 70;
    else if (amountDiff < 5) score += 56;
    else if (amountDiff < 10) score += 42;
    else if (amountDiff < 20) score += 28;
    else if (amountDiff < 50) score += 14;
  }
  let dateDiff: number | null = null;
  if (receiptDate) {
    const a = Date.UTC(transactionDate.getFullYear(), transactionDate.getMonth(), transactionDate.getDate());
    const rd = new Date(receiptDate);
    const b = Date.UTC(rd.getFullYear(), rd.getMonth(), rd.getDate());
    dateDiff = Math.abs(Math.round((a - b) / 86400000));
    if (dateDiff === 0) score += 30;
    else if (dateDiff <= 3) score += 24;
    else if (dateDiff <= 7) score += 18;
    else if (dateDiff <= 14) score += 12;
    else if (dateDiff <= 30) score += 6;
  }
  return { score, amountDiff, dateDiff };
}

/** Default dialog filters: similar amount (≤10 %) on, similar date off; top 10 + 5 others. */
export function rankAssignmentCandidates<R extends { amount_gross: number | null; receipt_date: string | null }>(
  receipts: R[],
  txAmount: number,
  txDate: Date,
  opts: { similarAmount?: boolean; similarDate?: boolean } = {},
) {
  const similarAmount = opts.similarAmount ?? true;
  const similarDate = opts.similarDate ?? false;
  const scored = receipts.map((r) => {
    const s = calculateMatchScore(txAmount, txDate, r.amount_gross, r.receipt_date);
    return { ...r, matchScore: s.score, amountDiff: s.amountDiff, dateDiff: s.dateDiff };
  });
  const passes = (r: (typeof scored)[number]) =>
    (!similarAmount || r.amountDiff <= 10) && (!similarDate || (r.dateDiff !== null && r.dateDiff <= 7));
  const byScore = (a: { matchScore: number }, b: { matchScore: number }) => b.matchScore - a.matchScore;
  const matching = scored.filter(passes).sort(byScore).slice(0, 10);
  const others = !similarAmount && !similarDate ? [] : scored.filter((r) => !passes(r)).sort(byScore).slice(0, 5);
  return { matching, others };
}

/** Same receipt query as the assignment dialog. */
export async function fetchAssignmentReceipts(sb: Sb, userId: string, opts: { search?: string; unassignedOnly?: boolean } = {}) {
  let q = sb
    .from("receipts")
    .select("id, receipt_date, vendor, amount_gross, file_url, category, bank_transaction_id, invoice_number, status")
    .eq("user_id", userId)
    .order("receipt_date", { ascending: false })
    .limit(100);
  if (opts.unassignedOnly ?? true) q = q.is("bank_transaction_id", null);
  if (opts.search) q = q.or(`vendor.ilike.%${opts.search}%,description.ilike.%${opts.search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as any[];
}

/** "Zuordnen": no amount check; several transactions may point at the same receipt. */
export async function assignBankTransaction(sb: Sb, transactionId: string, receiptId: string, splitLineId?: string | null) {
  const { error: txError } = await sb
    .from("bank_transactions")
    .update({ status: "matched", receipt_id: receiptId, receipt_split_line_id: splitLineId ?? null })
    .eq("id", transactionId);
  if (txError) throw txError;
  if (!splitLineId) {
    const { error } = await sb.from("receipts").update({ bank_transaction_id: transactionId }).eq("id", receiptId);
    if (error) throw error;
  }
}

/** "Zuordnung aufheben". */
export async function unmatchBankTransaction(sb: Sb, transactionId: string, receiptId: string | null) {
  if (receiptId) {
    const { error } = await sb
      .from("receipts")
      .update({ bank_transaction_id: null })
      .eq("id", receiptId)
      .eq("bank_transaction_id", transactionId);
    if (error) throw error;
  }
  const { error } = await sb
    .from("bank_transactions")
    .update({ status: "unmatched", receipt_id: null, receipt_split_line_id: null })
    .eq("id", transactionId);
  if (error) throw error;
}

/** "Ignorieren" (ignored) and "Wiederherstellen" (unmatched). */
export async function setBankTransactionStatus(sb: Sb, transactionId: string, status: "ignored" | "unmatched") {
  const updates: Record<string, unknown> = { status };
  if (status === "unmatched") updates.receipt_id = null;
  const { error } = await sb.from("bank_transactions").update(updates).eq("id", transactionId);
  if (error) throw error;
}

export function extractVendorFromBankDescription(desc: string): string {
  if (!desc) return "Unbekannter Lieferant";
  const patterns = [
    /Empf[äa]nger:\s*([^]+?)(?=\s+(?:Verwendungszweck|Zahlungsreferenz|IBAN|BIC|Beitr\.|KtoNr|Mandat|Ref\.?|Kundendaten|Auftraggeber)|$)/i,
    /Auftraggeber:\s*([^]+?)(?=\s+(?:Verwendungszweck|Zahlungsreferenz|IBAN|BIC|Beitr\.|KtoNr|Mandat|Ref\.?|Kundendaten|Empf)|$)/i,
    /Zahlungspflichtiger:\s*([^]+?)(?=\s+(?:Verwendungszweck|IBAN|BIC|Ref\.?)|$)/i,
  ];
  for (const re of patterns) {
    const m = desc.match(re);
    if (m && m[1]) return m[1].trim().replace(/\s+/g, " ").slice(0, 120);
  }
  const cleaned = desc
    .replace(/^Online Banking vom \d{1,2}\.\d{1,2}(?:\.\d{2,4})? um \d{1,2}:\d{2}\s*/i, "")
    .replace(/^SEPA[- ]?(?:Überweisung|Lastschrift|Gutschrift|Dauerauftrag)[:\s]*/i, "")
    .trim();
  return (cleaned.split(/\s{2,}|·|\||–/)[0] || cleaned).slice(0, 80) || "Unbekannter Lieferant";
}

export interface CreateFromTxOverrides {
  vendor?: string;
  category?: string;
  description?: string;
  vat_rate?: number;
  tagIds?: string[];
}

/**
 * "Als Ausgabe erstellen": receipt without file, status review, source bank_import,
 * is_no_receipt_entry true, linked both ways to the transaction. Optional overrides
 * (MCP) replace the heuristic vendor/description/category/VAT and keyword tags.
 */
export async function createExpenseFromBankTransaction(
  sb: Sb,
  userId: string,
  tx: { id: string; description: string | null; amount: number | null; transaction_date: string | null },
  overrides: CreateFromTxOverrides = {},
): Promise<{ receiptId: string }> {
  const description = tx.description || "";
  const amount = Math.abs(Number(tx.amount) || 0);
  const txDate = tx.transaction_date ? tx.transaction_date.slice(0, 10) : new Date().toISOString().slice(0, 10);

  const { data: keywords } = await sb
    .from("bank_import_keywords")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("is_ignore", false);
  const kw = (keywords ?? []).find((k: any) => description.toLowerCase().includes((k.keyword || "").toLowerCase()));

  let vendorId: string | null = null;
  let vendorDisplay = extractVendorFromBankDescription(description);
  if (kw?.vendor_id) {
    vendorId = kw.vendor_id;
    const { data: v } = await sb.from("vendors").select("display_name").eq("id", kw.vendor_id).maybeSingle();
    if (v?.display_name) vendorDisplay = v.display_name;
  }
  if (overrides.vendor) {
    vendorDisplay = overrides.vendor;
    const { data: v } = await sb.from("vendors").select("id").eq("user_id", userId).ilike("display_name", overrides.vendor).limit(1);
    vendorId = v?.[0]?.id ?? null;
  }

  const isIncome = (Number(tx.amount) || 0) > 0;
  const vatRate = overrides.vat_rate ?? kw?.tax_rate ?? 0;
  const baseDescription = kw?.description_template
    ? `${kw.description_template} – ${description}`.slice(0, 500)
    : description.slice(0, 500);

  const { data: newReceipt, error: insertErr } = await sb
    .from("receipts")
    .insert({
      user_id: userId,
      vendor: vendorDisplay,
      vendor_id: vendorId,
      description: overrides.description ?? baseDescription,
      amount_gross: amount,
      receipt_date: txDate,
      category: overrides.category ?? kw?.category ?? null,
      tax_type: kw?.tax_type ?? null,
      vat_rate: vatRate,
      payment_method: "bank_transfer",
      currency: "EUR",
      status: "review",
      source: "bank_import",
      is_no_receipt_entry: true,
      bank_import_keyword_id: kw?.id ?? null,
      bank_transaction_reference: description.slice(0, 500),
      bank_transaction_id: tx.id,
      notes: isIncome
        ? "Aus Bankbuchung erfasst (Hinweis: Einnahme/positiver Betrag) – bitte prüfen."
        : "Aus Bankbuchung erfasst – bitte vervollständigen.",
    })
    .select("id")
    .single();
  if (insertErr) throw insertErr;

  const tagIds = overrides.tagIds ?? (Array.isArray(kw?.default_tag_ids) ? (kw.default_tag_ids as any[]).filter(Boolean) : []);
  if (tagIds.length > 0) {
    const { error } = await sb
      .from("receipt_tags")
      .upsert(tagIds.map((tag_id: string) => ({ receipt_id: newReceipt.id, tag_id })), { onConflict: "receipt_id,tag_id", ignoreDuplicates: true });
    if (error) throw error;
  }

  const { error: txErr } = await sb
    .from("bank_transactions")
    .update({ status: "matched", receipt_id: newReceipt.id, receipt_split_line_id: null })
    .eq("id", tx.id);
  if (txErr) throw txErr;
  return { receiptId: newReceipt.id };
}
