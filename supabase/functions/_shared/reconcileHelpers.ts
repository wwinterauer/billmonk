// Shared helpers for automatic bank reconciliation.

export const PAYMENT_PROCESSORS = [
  "paypal",
  "paypal europe",
  "klarna",
  "stripe",
  "adyen",
  "amazon pay",
  "amazonpay",
  "apple pay",
  "applepay",
  "google pay",
  "googlepay",
  "sofortueberweisung",
  "sofort",
  "mollie",
  "sumup",
];

export function normalizeText(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** True when the payee of a bank transaction is a payment service provider. */
export function isProcessorTransaction(description: string | null | undefined): boolean {
  const norm = normalizeText(description);
  if (!norm) return false;
  // Only look at the payee part when present ("Zahlungsempfänger: X Verwendungszweck: Y")
  const payeePart = norm.split("verwendungszweck")[0] || norm;
  return PAYMENT_PROCESSORS.some((p) => payeePart.includes(normalizeText(p)));
}

/**
 * Normalized invoice number usable as a payment reference.
 * Returns null when it is too short or has no digits (avoids random hits).
 */
export function referenceKey(invoiceNumber: string | null | undefined): string | null {
  const norm = normalizeText(invoiceNumber).replace(/\s+/g, "");
  if (norm.length < 5) return null;
  if (!/[0-9]/.test(norm)) return null;
  return norm;
}

const hasLetterAndDigit = (s: string) => /[a-z]/.test(s) && /[0-9]/.test(s);

/**
 * All usable reference keys of an invoice number. Besides the fully normalized
 * value this also returns the individual parts, so numbers stored with an
 * appended date ("INET2602889/08.04.2026") still match the payment text.
 */
export function refKeys(invoiceNumber: string | null | undefined): string[] {
  if (!invoiceNumber) return [];
  const keys = new Set<string>();
  const full = referenceKey(invoiceNumber);
  if (full) keys.add(full);
  for (const raw of String(invoiceNumber).split(/[^A-Za-z0-9]+/)) {
    const part = normalizeText(raw).replace(/\s+/g, "");
    if (part.length >= 5 && hasLetterAndDigit(part)) keys.add(part);
  }
  return [...keys];
}

/** Reference-like tokens contained in a bank transaction description. */
export function extractRefTokens(description: string | null | undefined): string[] {
  if (!description) return [];
  const out = new Set<string>();
  for (const raw of String(description).split(/[^A-Za-z0-9]+/)) {
    const t = raw.toLowerCase();
    if (t.length >= 5 && hasLetterAndDigit(t)) out.add(t);
  }
  return [...out];
}

/** Tolerance for reference matches: up to 5% or 10 EUR deviation. */
export function amountWithinReferenceTolerance(a: number, b: number): boolean {
  const na = Math.abs(a);
  const nb = Math.abs(b);
  const diff = Math.abs(na - nb);
  const max = Math.max(na, nb);
  if (max === 0) return true;
  return diff <= Math.max(0.05 * max, 10);
}

export interface ReferenceCandidate {
  key: string;
  amount: number | null;
  invoiceNumber: string | null;
}

/** True when any reference key of the invoice number occurs in the payment text. */
export function referenceHit(
  invoiceNumber: string | null | undefined,
  description: string | null | undefined,
): boolean {
  const keys = refKeys(invoiceNumber);
  if (keys.length === 0) return false;
  const descNoSpace = normalizeText(description).replace(/\s+/g, "");
  if (!descNoSpace) return false;
  if (keys.some((k) => descNoSpace.includes(k))) return true;
  const tokens = extractRefTokens(description);
  return keys.some((k) => tokens.includes(k));
}

/**
 * Finds the single candidate whose invoice number appears in the bank transaction
 * description. Date is ignored on purpose (invoices are often paid months later).
 * Returns null when nothing or more than one candidate matches.
 */
export function findReferenceMatch(
  description: string | null | undefined,
  amount: number,
  candidates: ReferenceCandidate[],
): { key: string; deviationPct: number } | null {
  const descNoSpace = normalizeText(description).replace(/\s+/g, "");
  if (!descNoSpace) return null;

  const hits: Array<{ key: string; deviationPct: number }> = [];
  for (const c of candidates) {
    if (!referenceHit(c.invoiceNumber, description)) continue;
    if (c.amount == null) continue;
    if (!amountWithinReferenceTolerance(Number(c.amount), amount)) continue;
    const receiptAmt = Math.abs(Number(c.amount));
    const deviationPct = receiptAmt > 0
      ? ((receiptAmt - Math.abs(amount)) / receiptAmt) * 100
      : 0;
    hits.push({ key: c.key, deviationPct });
  }
  if (hits.length !== 1) return null;
  return hits[0];
}


export interface GroupPairInput {

  id: string;
  date: string;
  amount: number;
}

export interface GroupCandidateInput {
  key: string;
  date: string;
  amount: number;
  vendorKey: string;
}

/**
 * Pairs transactions and receipt candidates that share the exact same amount.
 * Only pairs when both groups have the same size, all candidates share one vendor
 * and every pair falls inside the date window. Returns [txId, candidateKey] pairs.
 */
export function buildGroupPairs(
  txs: GroupPairInput[],
  candidates: GroupCandidateInput[],
  maxDays: number,
): Array<{ txId: string; key: string }> {
  const cents = (n: number) => Math.round(Math.abs(n) * 100);
  const txByAmount = new Map<number, GroupPairInput[]>();
  for (const t of txs) {
    const k = cents(t.amount);
    (txByAmount.get(k) ?? txByAmount.set(k, []).get(k)!).push(t);
  }
  const candByAmount = new Map<number, GroupCandidateInput[]>();
  for (const c of candidates) {
    const k = cents(c.amount);
    (candByAmount.get(k) ?? candByAmount.set(k, []).get(k)!).push(c);
  }

  const result: Array<{ txId: string; key: string }> = [];
  for (const [amount, group] of txByAmount) {
    if (group.length < 2) continue; // single ones are handled by the unambiguous pass
    const cands = candByAmount.get(amount);
    if (!cands || cands.length !== group.length) continue;
    const vendors = new Set(cands.map((c) => c.vendorKey).filter(Boolean));
    if (vendors.size !== 1) continue;

    const sortedTx = [...group].sort((a, b) => a.date.localeCompare(b.date));
    const sortedC = [...cands].sort((a, b) => a.date.localeCompare(b.date));
    const days = (a: string, b: string) =>
      Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000;
    const ok = sortedTx.every((t, i) => days(t.date, sortedC[i].date) <= maxDays);
    if (!ok) continue;
    sortedTx.forEach((t, i) => result.push({ txId: t.id, key: sortedC[i].key }));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Smarter matching: scoring + suggestions
// ---------------------------------------------------------------------------

export interface ScoreContext {
  /** Payee is a payment service provider (PayPal, Klarna, ...) */
  processor: boolean;
  /** How many candidates in the pool share this exact amount */
  sameAmountCount: number;
}

export interface ScoreInput {
  description: string | null | undefined;
  amount: number;
  date: string | null;
}

export interface ScoreCandidate {
  key: string;
  amount: number | null;
  date: string | null;
  /** vendor display name, legal names, keywords, split line text */
  aliases: (string | null | undefined)[];
  invoiceNumber: string | null;
}

export interface ScoreResult {
  score: number;
  reasons: string[];
}

function daysApart(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000;
}

/**
 * Weighted score for a transaction/candidate pair.
 * 0 = impossible, higher = better. >= 80 is considered safe enough for
 * an automatic match, 40-79 becomes a suggestion for the user.
 */
export function scoreMatch(
  tx: ScoreInput,
  c: ScoreCandidate,
  ctx: ScoreContext,
): ScoreResult {
  const reasons: string[] = [];
  if (c.amount == null) return { score: 0, reasons };
  const txAmt = Math.abs(tx.amount);
  const cAmt = Math.abs(Number(c.amount));
  const diff = Math.abs(cAmt - txAmt);
  const maxAmt = Math.max(cAmt, txAmt);

  let score = 0;
  if (diff < 0.02) {
    score += 45;
    reasons.push("Betrag exakt");
  } else if (maxAmt > 0 && diff <= Math.max(0.05 * maxAmt, 10)) {
    score += 20;
    reasons.push("Betrag ähnlich");
  } else {
    return { score: 0, reasons };
  }

  // Date proximity
  if (tx.date && c.date) {
    const d = daysApart(tx.date, c.date);
    if (d <= 3) { score += 20; reasons.push("Datum passt"); }
    else if (d <= 14) { score += 14; reasons.push("Datum nah"); }
    else if (d <= 45) { score += 7; }
    else if (d <= 120) { score += 2; }
    else { score -= 5; }
  }

  const descNorm = normalizeText(tx.description);
  const descNoSpace = descNorm.replace(/\s+/g, "");

  // Invoice number in the payment text
  const ref = referenceKey(c.invoiceNumber);
  if (ref && descNoSpace.includes(ref)) {
    score += 45;
    reasons.push("Rechnungsnummer im Text");
  }

  // Vendor / alias hit
  const aliasHit = c.aliases
    .filter(Boolean)
    .map((a) => normalizeText(a))
    .filter((a) => a.length >= 4)
    .some((a) => descNorm.includes(a) || a.split(" ").filter((t) => t.length >= 4).every((t) => t && descNorm.includes(t)));
  if (aliasHit) {
    score += 25;
    reasons.push("Lieferant im Text");
  } else if (ctx.processor) {
    // Payee is PayPal & co — the vendor is expected to be missing, don't punish
    reasons.push("Zahlungsdienstleister");
  } else {
    score -= 5;
  }

  // Ambiguity penalty
  if (ctx.sameAmountCount > 1) {
    score -= Math.min(20, 4 * (ctx.sameAmountCount - 1));
    reasons.push(`${ctx.sameAmountCount} Belege mit gleichem Betrag`);
  }

  return { score: Math.max(0, Math.round(score)), reasons };
}

export interface SuggestionTx {
  id: string;
  date: string | null;
  amount: number;
  description: string | null;
}

export interface SuggestionCandidate extends ScoreCandidate {
  receiptId: string;
  splitLineId: string | null;
  vendor: string | null;
}

export interface SuggestionAlternative {
  key: string;
  receipt_id: string;
  split_line_id: string | null;
  receipt_date: string | null;
  receipt_vendor: string | null;
  receipt_amount: number;
  receipt_invoice_number: string | null;
}

export interface MatchSuggestion {
  transaction_id: string;
  transaction_date: string | null;
  transaction_amount: number;
  transaction_description: string | null;
  receipt_id: string;
  split_line_id: string | null;
  receipt_date: string | null;
  receipt_vendor: string | null;
  receipt_amount: number;
  receipt_invoice_number: string | null;
  score: number;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  alternatives: SuggestionAlternative[];
}

const toAlt = (c: SuggestionCandidate): SuggestionAlternative => ({
  key: c.key,
  receipt_id: c.receiptId,
  split_line_id: c.splitLineId,
  receipt_date: c.date,
  receipt_vendor: c.vendor,
  receipt_amount: Math.abs(Number(c.amount ?? 0)),
  receipt_invoice_number: c.invoiceNumber,
});

/**
 * Builds ranked suggestions for transactions that could not be matched
 * automatically. Transactions and candidates sharing the same amount are
 * paired chronologically (typical for recurring PayPal/IONOS payments), and
 * each pair keeps the other same-amount receipts as selectable alternatives.
 */
export function buildSuggestions(
  txs: SuggestionTx[],
  candidates: SuggestionCandidate[],
  opts: { maxAlternatives?: number } = {},
): MatchSuggestion[] {
  const maxAlt = opts.maxAlternatives ?? 8;
  const cents = (n: number) => Math.round(Math.abs(n) * 100);

  const candByAmount = new Map<number, SuggestionCandidate[]>();
  for (const c of candidates) {
    if (c.amount == null) continue;
    const k = cents(Number(c.amount));
    const arr = candByAmount.get(k) ?? [];
    arr.push(c);
    candByAmount.set(k, arr);
  }
  for (const arr of candByAmount.values()) {
    arr.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  }

  const txByAmount = new Map<number, SuggestionTx[]>();
  for (const t of txs) {
    const k = cents(t.amount);
    const arr = txByAmount.get(k) ?? [];
    arr.push(t);
    txByAmount.set(k, arr);
  }
  for (const arr of txByAmount.values()) {
    arr.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  }

  const suggestions: MatchSuggestion[] = [];
  const usedKeys = new Set<string>();

  for (const [amount, group] of txByAmount) {
    const pool = candByAmount.get(amount);
    if (!pool || pool.length === 0) continue;

    for (const tx of group) {
      // Best remaining candidate: closest date wins, ties keep chronological order
      let best: SuggestionCandidate | null = null;
      let bestDist = Number.POSITIVE_INFINITY;
      for (const c of pool) {
        if (usedKeys.has(c.key)) continue;
        const dist = tx.date && c.date ? daysApart(tx.date, c.date) : 999;
        if (dist < bestDist) { bestDist = dist; best = c; }
      }
      if (!best) continue;

      const ctx: ScoreContext = {
        processor: isProcessorTransaction(tx.description),
        sameAmountCount: pool.length,
      };
      const { score, reasons } = scoreMatch(
        { description: tx.description, amount: tx.amount, date: tx.date },
        best,
        ctx,
      );
      if (score <= 0) continue;

      const unique = pool.length === 1;
      const vendors = new Set(pool.map((c) => (c.vendor ?? "").trim().toLowerCase()).filter(Boolean));
      const confidence: MatchSuggestion["confidence"] =
        score >= 75 || (unique && score >= 55)
          ? "high"
          : score >= 45 || vendors.size === 1
            ? "medium"
            : "low";

      usedKeys.add(best.key);
      suggestions.push({
        transaction_id: tx.id,
        transaction_date: tx.date,
        transaction_amount: Math.abs(tx.amount),
        transaction_description: tx.description,
        receipt_id: best.receiptId,
        split_line_id: best.splitLineId,
        receipt_date: best.date,
        receipt_vendor: best.vendor,
        receipt_amount: Math.abs(Number(best.amount ?? 0)),
        receipt_invoice_number: best.invoiceNumber,
        score,
        confidence,
        reasons,
        alternatives: pool
          .filter((c) => c.key !== best!.key)
          .slice(0, maxAlt)
          .map(toAlt),
      });
    }
  }

  suggestions.sort((a, b) => b.score - a.score);
  return suggestions;
}
