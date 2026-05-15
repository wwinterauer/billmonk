import { supabase } from '@/integrations/supabase/client';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateOf: string | null;
  score: number;
  matchType: 'exact' | 'very_likely' | 'likely' | 'possible' | 'none';
  matchReasons: string[];
}

export interface ReceiptData {
  vendor?: string | null;
  amount_gross?: number | null;
  receipt_date?: string | null;
  invoice_number?: string | null;
  file_name?: string | null;
}

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

  // Define which statuses count as "active" duplicates
  // Rejected and not_a_receipt files should NOT block new uploads
  const activeStatuses = ['pending', 'processing', 'review', 'approved', 'duplicate'];

  try {
    // 1. Exact hash match (100% - identical file)
    if (fileHash) {
      const { data: hashMatch } = await supabase
        .from('receipts')
        .select('id, vendor, amount_gross, receipt_date, status')
        .eq('user_id', userId)
        .eq('file_hash', fileHash)
        .in('status', activeStatuses)
        .neq('id', excludeReceiptId || '00000000-0000-0000-0000-000000000000')
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

    // 2. Invoice number + vendor match (95% - very likely)
    if (receiptData.invoice_number && receiptData.vendor) {
      let invoiceQuery = supabase
        .from('receipts')
        .select('id, vendor, amount_gross, receipt_date, status')
        .eq('user_id', userId)
        .eq('invoice_number', receiptData.invoice_number);
      invoiceQuery = applyVendorFilter(invoiceQuery, receiptData.vendor);
      const { data: invoiceMatch } = await invoiceQuery
        .in('status', activeStatuses)
        .neq('id', excludeReceiptId || '00000000-0000-0000-0000-000000000000')
        .limit(1)
        .maybeSingle();

      if (invoiceMatch) {
        return {
          isDuplicate: true,
          duplicateOf: invoiceMatch.id,
          score: 95,
          matchType: 'very_likely',
          matchReasons: ['Gleiche Rechnungsnummer', 'Gleicher Lieferant']
        };
      }
    }

    // 3. Amount + date + vendor match (90% - very likely)
    // Strict rule: if new receipt has invoice_number, candidate must have same one or none
    if (receiptData.amount_gross && receiptData.receipt_date && receiptData.vendor) {
      let amountQuery = supabase
        .from('receipts')
        .select('id, vendor, amount_gross, receipt_date, invoice_number, status')
        .eq('user_id', userId)
        .eq('amount_gross', receiptData.amount_gross)
        .eq('receipt_date', receiptData.receipt_date);
      amountQuery = applyVendorFilter(amountQuery, receiptData.vendor);
      if (receiptData.invoice_number) {
        amountQuery = amountQuery.or(`invoice_number.eq.${receiptData.invoice_number},invoice_number.is.null`);
      }
      const { data: amountMatch } = await amountQuery
        .in('status', activeStatuses)
        .neq('id', excludeReceiptId || '00000000-0000-0000-0000-000000000000')
        .limit(1)
        .maybeSingle();

      if (amountMatch) {
        return {
          isDuplicate: true,
          duplicateOf: amountMatch.id,
          score: 90,
          matchType: 'very_likely',
          matchReasons: ['Gleicher Betrag', 'Gleiches Datum', 'Gleicher Lieferant']
        };
      }
    }

    // 4. (entfernt) ±3 Tage Fuzzy-Match — abweichendes Datum = kein Duplikat per Regel

    // 5. Invoice number only match (70% - likely)
    if (receiptData.invoice_number) {
      const { data: invoiceOnlyMatch } = await supabase
        .from('receipts')
        .select('id, vendor, amount_gross, receipt_date, status')
        .eq('user_id', userId)
        .eq('invoice_number', receiptData.invoice_number)
        .in('status', activeStatuses)
        .neq('id', excludeReceiptId || '00000000-0000-0000-0000-000000000000')
        .limit(1)
        .maybeSingle();

      if (invoiceOnlyMatch) {
        return {
          isDuplicate: true,
          duplicateOf: invoiceOnlyMatch.id,
          score: 70,
          matchType: 'likely',
          matchReasons: ['Gleiche Rechnungsnummer']
        };
      }
    }

    // 6. Amount + date only (60% - possible)
    // Strict rule: if new receipt has invoice_number, candidate must have same one or none
    if (receiptData.amount_gross && receiptData.receipt_date) {
      let adQuery = supabase
        .from('receipts')
        .select('id, vendor, amount_gross, receipt_date, invoice_number, status')
        .eq('user_id', userId)
        .eq('amount_gross', receiptData.amount_gross)
        .eq('receipt_date', receiptData.receipt_date);
      if (receiptData.invoice_number) {
        adQuery = adQuery.or(`invoice_number.eq.${receiptData.invoice_number},invoice_number.is.null`);
      }
      const { data: amountDateMatch } = await adQuery
        .in('status', activeStatuses)
        .neq('id', excludeReceiptId || '00000000-0000-0000-0000-000000000000')
        .limit(1)
        .maybeSingle();

      if (amountDateMatch) {
        return {
          isDuplicate: true,
          duplicateOf: amountDateMatch.id,
          score: 60,
          matchType: 'possible',
          matchReasons: ['Gleicher Betrag', 'Gleiches Datum']
        };
      }
    }

    return defaultResult;
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
    const { error } = await supabase
      .from('receipts')
      .update({
        is_duplicate: true,
        duplicate_of: duplicateOfId,
        duplicate_score: score,
        duplicate_checked_at: new Date().toISOString()
      })
      .eq('id', receiptId);

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
