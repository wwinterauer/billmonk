import { supabase } from '@/integrations/supabase/client';
import {
  isPlaceholderInvoiceNumber,
  normalizeInvoiceNumber,
  invoiceNumbersMatch,
  amountWithinTolerance,
  amountsEqual,
  dateWithinTolerance,
  daysBetween,
  classifyDocumentKind,
  vendorsLikelySame,
  DATE_TOLERANCE_DAYS,
  AMOUNT_TOLERANCE,
} from '@/lib/duplicateRules';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateOf: string | null;
  score: number;
  matchType: 'exact' | 'very_likely' | 'likely' | 'possible' | 'none';
  matchReasons: string[];
}

export interface ReceiptData {
  vendor?: string | null;
  vendor_brand?: string | null;
  amount_gross?: number | null;
  receipt_date?: string | null;
  invoice_number?: string | null;
  file_name?: string | null;
  custom_filename?: string | null;
  description?: string | null;
}

const NO_ID = '00000000-0000-0000-0000-000000000000';

// Define which statuses count as "active" duplicates
// Rejected and not_a_receipt files should NOT block new uploads
const ACTIVE_STATUSES = ['pending', 'processing', 'review', 'approved', 'duplicate'];

const CANDIDATE_COLUMNS =
  'id, vendor, vendor_brand, amount_gross, receipt_date, invoice_number, file_name, custom_filename, description, status';

/**
 * Apply vendor filter using the first meaningful token (handles abbreviations
 * like "W H" vs "Würth Hochenburger"). Falls back to ilike on whole string.
 */
function applyVendorFilter(query: any, vendor: string) {
  const cleaned = vendor.trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const firstLong = tokens.find(t => t.length >= 3) || tokens[0] || cleaned;
  const needle = firstLong.substring(0, 10);
  return query.ilike('vendor', `%${needle}%`);
}

/**
 * Generate SHA-256 hash of a file
 */
export async function generateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/** Belege mit Tag "Inoffiziell" werden von der automatischen Markierung ausgenommen. */
async function hasInoffiziellTag(receiptId?: string): Promise<boolean> {
  if (!receiptId) return false;
  try {
    const { data } = await supabase
      .from('receipt_tags')
      .select('tag_id, tags!inner(name)')
      .eq('receipt_id', receiptId);
    return (data || []).some((row: any) => String(row.tags?.name || '').toLowerCase().includes('inoffiziell'));
  } catch {
    return false;
  }
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function candidateVendorMatches(receiptData: ReceiptData, c: any): boolean {
  return (
    vendorsLikelySame(receiptData.vendor, c.vendor) ||
    vendorsLikelySame(receiptData.vendor, c.vendor_brand) ||
    vendorsLikelySame(receiptData.vendor_brand, c.vendor) ||
    vendorsLikelySame(receiptData.vendor_brand, c.vendor_brand)
  );
}

/**
 * Check for duplicate receipts based on multiple criteria
 */
export async function checkForDuplicates(
  userId: string,
  fileHash: string | null,
  receiptData: ReceiptData,
  excludeReceiptId?: string
): Promise<DuplicateCheckResult> {
  const defaultResult: DuplicateCheckResult = {
    isDuplicate: false,
    duplicateOf: null,
    score: 0,
    matchType: 'none',
    matchReasons: []
  };

  const excludeId = excludeReceiptId || NO_ID;
  const invoiceNumber = normalizeInvoiceNumber(receiptData.invoice_number);
  const ownKind = classifyDocumentKind(receiptData);

  try {
    // 1. Exact hash match (100% - identical file) — gilt immer
    if (fileHash) {
      const { data: hashMatch } = await supabase
        .from('receipts')
        .select('id')
        .eq('user_id', userId)
        .eq('file_hash', fileHash)
        .in('status', ACTIVE_STATUSES)
        .neq('id', excludeId)
        .limit(1)
        .maybeSingle();

      if (hashMatch) {
        return {
          isDuplicate: true,
          duplicateOf: hashMatch.id,
          score: 100,
          matchType: 'exact',
          matchReasons: ['Identische Datei (gleicher Hash)']
        };
      }
    }

    // Belege mit Tag "Inoffiziell" werden nicht automatisch als Duplikat markiert
    if (await hasInoffiziellTag(excludeReceiptId)) {
      return defaultResult;
    }

    // 2. Echte Rechnungsnummer + passender Lieferant → Duplikat (unabhängig von Betrag/Datum)
    if (invoiceNumber && (receiptData.vendor || receiptData.vendor_brand)) {
      let invoiceQuery = supabase
        .from('receipts')
        .select(CANDIDATE_COLUMNS)
        .eq('user_id', userId)
        .eq('invoice_number', invoiceNumber);
      const vendorNeedle = receiptData.vendor || receiptData.vendor_brand!;
      invoiceQuery = applyVendorFilter(invoiceQuery, vendorNeedle);
      const { data: rawMatches } = await invoiceQuery
        .in('status', ACTIVE_STATUSES)
        .neq('id', excludeId)
        .limit(5);

      const matches = (rawMatches || []).filter(
        (c: any) =>
          !isPlaceholderInvoiceNumber(c.invoice_number) &&
          invoiceNumbersMatch(invoiceNumber, c.invoice_number) &&
          candidateVendorMatches(receiptData, c)
      );

      if (matches.length > 0) {
        const best = matches[0];
        const reasons = ['Gleiche Rechnungsnummer', 'Gleicher Lieferant'];

        // Rechnung vs. Zahlungsbeleg: Zahlungsbeleg ist der Nachrang
        const otherKind = classifyDocumentKind(best);
        if (
          amountsEqual(receiptData.amount_gross, best.amount_gross) &&
          ownKind !== otherKind &&
          (ownKind === 'payment_receipt' || otherKind === 'payment_receipt') &&
          (ownKind === 'invoice' || otherKind === 'invoice')
        ) {
          reasons.push('Zahlungsbeleg zur Rechnung');
        }

        return {
          isDuplicate: true,
          duplicateOf: best.id,
          score: 95,
          matchType: 'very_likely',
          matchReasons: reasons
        };
      }
    }

    // Ohne verwertbare Rechnungsnummer entscheiden Betrag (±20 %) und Datum (±3 Tage)
    if (receiptData.amount_gross == null || !receiptData.receipt_date) {
      return defaultResult;
    }

    const amount = Number(receiptData.amount_gross);
    const lowAmount = Math.min(amount * (1 - AMOUNT_TOLERANCE), amount * (1 + AMOUNT_TOLERANCE));
    const highAmount = Math.max(amount * (1 - AMOUNT_TOLERANCE), amount * (1 + AMOUNT_TOLERANCE));
    const dateFrom = addDays(receiptData.receipt_date, -DATE_TOLERANCE_DAYS);
    const dateTo = addDays(receiptData.receipt_date, DATE_TOLERANCE_DAYS);

    const { data: rawCandidates } = await supabase
      .from('receipts')
      .select(CANDIDATE_COLUMNS)
      .eq('user_id', userId)
      .gte('amount_gross', lowAmount)
      .lte('amount_gross', highAmount)
      .gte('receipt_date', dateFrom)
      .lte('receipt_date', dateTo)
      .in('status', ACTIVE_STATUSES)
      .neq('id', excludeId)
      .limit(20);

    const candidates = (rawCandidates || []).filter((c: any) => {
      // Harter Ausschluss: beide haben echte, aber unterschiedliche Rechnungsnummern
      const candInv = normalizeInvoiceNumber(c.invoice_number);
      if (invoiceNumber && candInv && !invoiceNumbersMatch(invoiceNumber, candInv)) return false;
      if (!amountWithinTolerance(receiptData.amount_gross, c.amount_gross)) return false;
      if (!dateWithinTolerance(receiptData.receipt_date, c.receipt_date)) return false;
      return true;
    });

    if (candidates.length === 0) return defaultResult;

    const exactValue = (c: any) =>
      amountsEqual(receiptData.amount_gross, c.amount_gross) &&
      (daysBetween(receiptData.receipt_date, c.receipt_date) ?? 99) === 0;

    const withVendor = candidates.filter((c: any) => candidateVendorMatches(receiptData, c));
    const pool = withVendor.length > 0 ? withVendor : candidates;
    const best = pool.find(exactValue) || pool[0];
    const isExact = exactValue(best);
    const vendorMatched = withVendor.length > 0;

    const reasons: string[] = [];
    reasons.push(isExact ? 'Gleicher Betrag' : 'Betrag leicht abweichend');
    reasons.push(isExact ? 'Gleiches Datum' : 'Datum leicht abweichend');
    if (vendorMatched) reasons.push('Gleicher Lieferant');

    let score = vendorMatched ? 90 : 60;
    if (!isExact) score -= 10;

    return {
      isDuplicate: true,
      duplicateOf: best.id,
      score,
      matchType: score >= 90 ? 'very_likely' : score >= 70 ? 'likely' : 'possible',
      matchReasons: reasons
    };
  } catch (error) {
    console.error('Error checking for duplicates:', error);
    return defaultResult;
  }
}


/**
 * Mark a receipt as a duplicate
 */
export async function markAsDuplicate(
  receiptId: string,
  duplicateOfId: string,
  score: number
): Promise<boolean> {
  try {
    if (receiptId === duplicateOfId) return false;

    // Load both receipts to (a) prevent circular references and (b) ensure the
    // older one is treated as the "original".
    const { data: rows } = await supabase
      .from('receipts')
      .select('id, created_at, duplicate_of')
      .in('id', [receiptId, duplicateOfId]);

    const me = rows?.find(r => r.id === receiptId);
    const other = rows?.find(r => r.id === duplicateOfId);
    if (!me || !other) return false;

    // Circular guard: if candidate already points back to us, abort.
    if (other.duplicate_of === receiptId) {
      console.warn('markAsDuplicate: circular duplicate reference avoided', { receiptId, duplicateOfId });
      return false;
    }

    // Always mark the newer one as duplicate of the older one.
    const meIsOlder = new Date(me.created_at).getTime() <= new Date(other.created_at).getTime();
    const duplicateId = meIsOlder ? duplicateOfId : receiptId;
    const originalId = meIsOlder ? receiptId : duplicateOfId;

    const { error } = await supabase
      .from('receipts')
      .update({
        is_duplicate: true,
        duplicate_of: originalId,
        duplicate_score: score,
        duplicate_checked_at: new Date().toISOString()
      })
      .eq('id', duplicateId);

    return !error;
  } catch (error) {
    console.error('Error marking as duplicate:', error);
    return false;
  }
}

/**
 * Unmark a receipt as duplicate (user confirmed it's not a duplicate)
 */
export async function unmarkAsDuplicate(receiptId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('receipts')
      .update({
        is_duplicate: false,
        duplicate_of: null,
        duplicate_score: null,
        duplicate_checked_at: new Date().toISOString()
      })
      .eq('id', receiptId);

    return !error;
  } catch (error) {
    console.error('Error unmarking duplicate:', error);
    return false;
  }
}

/**
 * Update file hash for a receipt
 */
export async function updateFileHash(
  receiptId: string,
  fileHash: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('receipts')
      .update({ file_hash: fileHash })
      .eq('id', receiptId);

    return !error;
  } catch (error) {
    console.error('Error updating file hash:', error);
    return false;
  }
}

/**
 * Get all duplicate receipts for a user
 */
export async function getDuplicateReceipts(userId: string) {
  const { data, error } = await supabase
    .from('receipts')
    .select(`
      id,
      vendor,
      amount_gross,
      receipt_date,
      file_name,
      duplicate_of,
      duplicate_score,
      duplicate_checked_at
    `)
    .eq('user_id', userId)
    .eq('is_duplicate', true)
    .order('duplicate_checked_at', { ascending: false });

  if (error) {
    console.error('Error fetching duplicates:', error);
    return [];
  }

  return data || [];
}

/**
 * Get match type label in German
 */
export function getMatchTypeLabel(matchType: DuplicateCheckResult['matchType']): string {
  const labels: Record<DuplicateCheckResult['matchType'], string> = {
    exact: 'Exakte Übereinstimmung',
    very_likely: 'Sehr wahrscheinlich',
    likely: 'Wahrscheinlich',
    possible: 'Möglich',
    none: 'Kein Duplikat'
  };
  return labels[matchType];
}

/**
 * Get match type color for UI
 */
export function getMatchTypeColor(matchType: DuplicateCheckResult['matchType']): string {
  const colors: Record<DuplicateCheckResult['matchType'], string> = {
    exact: 'destructive',
    very_likely: 'destructive',
    likely: 'warning',
    possible: 'secondary',
    none: 'outline'
  };
  return colors[matchType];
}
