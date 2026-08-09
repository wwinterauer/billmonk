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
