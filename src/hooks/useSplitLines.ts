import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SplitLine {
  id: string;
  receipt_id: string;
  description: string | null;
  category: string | null;
  amount_gross: number;
  amount_net: number;
  vat_rate: number;
  vat_amount: number;
  is_private: boolean;
  sort_order: number;
}

/**
 * Fetches split lines for receipts that have is_split_booking = true.
 * Used for split-aware category aggregation in Dashboard/Reports.
 */
export function useSplitLines(enabled: boolean, receiptIds?: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['split-lines', user?.id, receiptIds?.join(',')],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from('receipt_split_lines')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });

      if (receiptIds && receiptIds.length > 0) {
        query = query.in('receipt_id', receiptIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as SplitLine[];
    },
    enabled: enabled && !!user,
  });
}

/**
 * Given receipts and their split lines, produces category aggregation
 * that uses split-line categories for split bookings instead of the main receipt category.
 */
export function aggregateWithSplitLines(
  receipts: Array<{ id: string; category: string | null; amount_gross: number | null; vat_amount: number | null; is_split_booking?: boolean }>,
  splitLines: SplitLine[],
  splitBookingEnabled: boolean,
): Map<string, { amount: number; vat: number; count: number }> {
  const categoryMap = new Map<string, { amount: number; vat: number; count: number }>();

  const addToCategory = (cat: string, amount: number, vat: number) => {
    const existing = categoryMap.get(cat) || { amount: 0, vat: 0, count: 0 };
    existing.amount += amount;
    existing.vat += vat;
    existing.count += 1;
    categoryMap.set(cat, existing);
  };

  // Group split lines by receipt_id
  const splitLinesByReceipt = new Map<string, SplitLine[]>();
  if (splitBookingEnabled) {
    splitLines.forEach(line => {
      const lines = splitLinesByReceipt.get(line.receipt_id) || [];
      lines.push(line);
      splitLinesByReceipt.set(line.receipt_id, lines);
    });
  }

  receipts.forEach(receipt => {
    if (splitBookingEnabled && receipt.is_split_booking) {
      const lines = splitLinesByReceipt.get(receipt.id);
      if (lines && lines.length > 0) {
        // Use split lines for aggregation
        lines.forEach(line => {
          const cat = line.category || receipt.category || 'Ohne Kategorie';
          addToCategory(cat, line.amount_gross, line.vat_amount);
        });
        return;
      }
    }
    // Normal receipt or no split lines found
    const cat = receipt.category || 'Ohne Kategorie';
    addToCategory(cat, receipt.amount_gross || 0, receipt.vat_amount || 0);
  });

  return categoryMap;
}
