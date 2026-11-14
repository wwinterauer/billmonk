/**
 * Erkennung wiederkehrender Akontobuchungen (z.B. monatliche Strom-/Heizungs-
 * Akontozahlungen). Diese haben i.d.R. keinen Einzelbeleg – nur die Endabrechnung.
 */

export interface RecurringTx {
  id: string;
  transaction_date: string | null;
  description: string | null;
  amount: number | null;
}

export interface RecurringGroup {
  key: string;
  vendorLabel: string;
  amount: number;
  count: number;
  cadence: 'monthly' | 'quarterly' | 'irregular';
  confidence: 'high' | 'medium';
  avgIntervalDays: number;
  firstDate: string;
  lastDate: string;
  spanDays: number;
  transactions: RecurringTx[];
}

const STOPWORDS = new Set([
  'zahlungsempfaenger', 'zahlungsempfanger', 'empfanger', 'empfaenger',
  'verwendungszweck', 'rechnung', 'rechnungsnr', 'kunde', 'kundennr',
  'kundennummer', 'auftraggeber', 'iban', 'bic', 'sepa', 'lastschrift',
  'dauerauftrag', 'ueberweisung', 'uberweisung', 'mandat', 'mandatref',
  'beleg', 'belegnr', 'datum', 'bezug', 'ref', 'referenz', 'gmbh',
  'kartenentgelt', 'transaktion', 'eu-zahlung', 'foreign',
]);

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function vendorTokenOf(desc: string | null): string | null {
  if (!desc) return null;
  const n = normalize(desc);
  const tokens = n.split(' ').filter(t => t.length >= 4 && !/^\d+$/.test(t) && !STOPWORDS.has(t));
  return tokens[0] || null;
}

function originalVendorLabel(desc: string | null, token: string): string {
  if (!desc) return token;
  // Try to find the original (cased) word matching the token in the raw description
  const words = desc.split(/[\s,;:\-\/]+/);
  for (const w of words) {
    if (normalize(w).startsWith(token)) return w;
  }
  return token.charAt(0).toUpperCase() + token.slice(1);
}

export function detectRecurringGroups(txs: RecurringTx[]): RecurringGroup[] {
  const buckets = new Map<string, RecurringTx[]>();

  for (const t of txs) {
    if (t.amount == null || !t.transaction_date) continue;
    const token = vendorTokenOf(t.description);
    if (!token) continue;
    const amt = Math.round(Math.abs(t.amount) * 100); // cents, abs
    const key = `${token}|${amt}`;
    const arr = buckets.get(key) ?? [];
    arr.push(t);
    buckets.set(key, arr);
  }

  const groups: RecurringGroup[] = [];

  for (const [key, arr] of buckets) {
    if (arr.length < 2) continue;
    const sorted = [...arr].sort((a, b) =>
      (a.transaction_date! < b.transaction_date! ? -1 : 1)
    );
    const dates = sorted.map(t => new Date(t.transaction_date!).getTime());
    const intervals: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      intervals.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
    }
    const spanDays = (dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24);
    if (spanDays < 25) continue;
    const avg = intervals.reduce((s, x) => s + x, 0) / intervals.length;

    let cadence: RecurringGroup['cadence'] = 'irregular';
    if (avg >= 22 && avg <= 38) cadence = 'monthly';
    else if (avg >= 80 && avg <= 100) cadence = 'quarterly';
    else continue; // require a recognizable cadence

    const confidence: RecurringGroup['confidence'] =
      sorted.length >= 3 || spanDays >= 60 ? 'high' : 'medium';

    const [token] = key.split('|');
    const amount = Math.abs(sorted[0].amount!);
    const vendorLabel = originalVendorLabel(sorted[0].description, token);

    groups.push({
      key,
      vendorLabel,
      amount,
      count: sorted.length,
      cadence,
      confidence,
      avgIntervalDays: Math.round(avg),
      firstDate: sorted[0].transaction_date!,
      lastDate: sorted[sorted.length - 1].transaction_date!,
      spanDays: Math.round(spanDays),
      transactions: sorted,
    });
  }

  // Sort high-confidence first, then by count, then amount
  groups.sort((a, b) =>
    (a.confidence === b.confidence ? 0 : a.confidence === 'high' ? -1 : 1)
    || b.count - a.count
    || b.amount - a.amount
  );
  return groups;
}

/** Recipient/pattern a dismissal applies to (independent of amount, so new bookings stay hidden). */
export function patternKeyOf(group: Pick<RecurringGroup, 'key'>): string {
  return group.key.split('|')[0];
}

/**
 * Hide groups whose recipient was dismissed, or whose earlier expense bookings
 * are mostly (>50 %) already matched to receipts.
 */
export function filterRecurringSuggestions(
  groups: RecurringGroup[],
  dismissedPatterns: Set<string>,
  matchedDescriptions: (string | null)[],
): RecurringGroup[] {
  const matchedByToken = new Map<string, number>();
  for (const d of matchedDescriptions) {
    const t = vendorTokenOf(d);
    if (t) matchedByToken.set(t, (matchedByToken.get(t) ?? 0) + 1);
  }
  const unmatchedByToken = new Map<string, number>();
  for (const g of groups) {
    const t = patternKeyOf(g);
    unmatchedByToken.set(t, (unmatchedByToken.get(t) ?? 0) + g.count);
  }
  return groups.filter((g) => {
    const t = patternKeyOf(g);
    if (dismissedPatterns.has(t)) return false;
    const matched = matchedByToken.get(t) ?? 0;
    const open = unmatchedByToken.get(t) ?? 0;
    return !(matched > open);
  });
}
