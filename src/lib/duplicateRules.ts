/**
 * Gemeinsame Regeln für die Duplikat-Erkennung.
 *
 * Kernregeln:
 * 1. Gleiche (echte) Rechnungsnummer + passender Lieferant = Duplikat, unabhängig von Betrag/Datum.
 * 2. Platzhalter-Rechnungsnummern ("Inoffiziell", "ohne", "-", ...) zählen als KEINE Rechnungsnummer.
 * 3. Ohne Rechnungsnummer entscheiden Betrag (±20 %) und Datum (±3 Tage).
 * 4. Rechnung vs. Zahlungsbeleg: der Zahlungsbeleg ist der Nachrang.
 */

export const AMOUNT_TOLERANCE = 0.2; // ±20 %
export const DATE_TOLERANCE_DAYS = 3; // ±3 Tage

const PLACEHOLDER_PATTERNS = [
  'inoffiziell',
  'unofficial',
  'ohne',
  'ohne nummer',
  'ohnenummer',
  'keine',
  'keine nummer',
  'nicht vorhanden',
  'unbekannt',
  'unknown',
  'n/a',
  'na',
  'k.a.',
  'ka',
  '-',
  '--',
  '/',
  'none',
  'null',
  'x',
  'xxx',
  '0',
];

/** true, wenn die Rechnungsnummer kein verwertbares Merkmal ist. */
export function isPlaceholderInvoiceNumber(value?: string | null): boolean {
  if (value == null) return true;
  const raw = String(value).trim();
  if (!raw) return true;
  const normalized = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  // "Inoffiziell" darf auch als Teilstring vorkommen (z. B. "Inoffiziell 03/2026")
  if (normalized.includes('inoffiziell') || normalized.includes('unofficial')) return true;
  if (PLACEHOLDER_PATTERNS.includes(normalized)) return true;
  // Nur Sonderzeichen
  if (!/[a-z0-9]/i.test(normalized)) return true;
  return false;
}

/** Verwertbare Rechnungsnummer oder null. */
export function normalizeInvoiceNumber(value?: string | null): string | null {
  if (isPlaceholderInvoiceNumber(value)) return null;
  return String(value).trim();
}

export function invoiceNumbersMatch(a?: string | null, b?: string | null): boolean {
  const na = normalizeInvoiceNumber(a);
  const nb = normalizeInvoiceNumber(b);
  if (!na || !nb) return false;
  const clean = (s: string) => s.toLowerCase().replace(/[\s\-_.\/]/g, '');
  return clean(na) === clean(nb);
}

/**
 * Betragstoleranz: relativ zum größeren der beiden Werte.
 * Fehlt ein Wert, gilt die Prüfung als "unbekannt" (true = kein Ausschluss).
 */
export function amountWithinTolerance(
  a?: number | null,
  b?: number | null,
  tolerance: number = AMOUNT_TOLERANCE
): boolean {
  if (a == null || b == null) return true;
  const na = Math.abs(Number(a));
  const nb = Math.abs(Number(b));
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return true;
  const max = Math.max(na, nb);
  if (max === 0) return true;
  return Math.abs(na - nb) <= tolerance * max;
}

/** true, wenn Beträge exakt gleich sind (auf Cent gerundet). */
export function amountsEqual(a?: number | null, b?: number | null): boolean {
  if (a == null || b == null) return false;
  return Math.round(Number(a) * 100) === Math.round(Number(b) * 100);
}

function toUtcDay(value: string | Date): number | null {
  const d = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  const t = d.getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor(t / 86400000);
}

/** Differenz in Kalendertagen (UTC) oder null. */
export function daysBetween(a?: string | null, b?: string | null): number | null {
  if (!a || !b) return null;
  const da = toUtcDay(a);
  const db = toUtcDay(b);
  if (da == null || db == null) return null;
  return Math.abs(da - db);
}

/**
 * Datumstoleranz. Fehlt ein Datum, gilt die Prüfung als "unbekannt" (kein Ausschluss).
 */
export function dateWithinTolerance(
  a?: string | null,
  b?: string | null,
  toleranceDays: number = DATE_TOLERANCE_DAYS
): boolean {
  const diff = daysBetween(a, b);
  if (diff == null) return true;
  return diff <= toleranceDays;
}

export type DocumentKind = 'invoice' | 'payment_receipt' | 'unknown';

const INVOICE_HINTS = /\b(invoice|rechnung|faktura|factura|rechnungen|re-?nr)\b/i;
const PAYMENT_HINTS = /\b(receipt|quittung|zahlungsbeleg|zahlungsbestaetigung|zahlungsbestätigung|payment|beleg\s*zahlung|kassenbon)\b/i;

/**
 * Erkennt aus Dateiname/Beschreibung, ob es sich um die Rechnung selbst
 * oder um den zugehörigen Zahlungsbeleg handelt.
 */
export function classifyDocumentKind(input: {
  file_name?: string | null;
  custom_filename?: string | null;
  description?: string | null;
}): DocumentKind {
  const haystack = [input.file_name, input.custom_filename, input.description]
    .filter(Boolean)
    .join(' ');
  if (!haystack) return 'unknown';
  const isInvoice = INVOICE_HINTS.test(haystack);
  const isPayment = PAYMENT_HINTS.test(haystack);
  if (isInvoice && !isPayment) return 'invoice';
  if (isPayment && !isInvoice) return 'payment_receipt';
  return 'unknown';
}

/** Lieferantenvergleich (tolerant gegenüber Rechtsformen/Abkürzungen). */
export function vendorsLikelySame(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\b(gmbh|ag|kg|og|ug|ltd|limited|inc|llc|bv|nv|sa|se|e\.?u\.?|co|kgaa|ulc|aps|s\.?r\.?l\.?)\b/g, ' ')
      .replace(/[^a-z0-9äöüß]+/g, ' ')
      .trim();
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = new Set(na.split(' ').filter(t => t.length >= 3));
  const tb = new Set(nb.split(' ').filter(t => t.length >= 3));
  for (const t of ta) if (tb.has(t)) return true;
  return false;
}
