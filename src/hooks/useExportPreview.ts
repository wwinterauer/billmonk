import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { ExportColumn } from './useExportTemplates';

// German month names
const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

export interface PreviewRow {
  isGroupHeader?: boolean;
  isSubtotal?: boolean;
  groupName?: string;
  [key: string]: unknown;
}

export interface ExportPreviewConfig {
  columns: ExportColumn[];
  sortBy: string | null;
  sortDirection: 'asc' | 'desc';
  groupBy: string | null;
  groupSubtotals: boolean;
  includeHeader: boolean;
  includeTotals: boolean;
  dateFormat: string;
  numberFormat: string;
}

// Format currency based on locale
export const formatCurrency = (value: number, locale: string = 'de-AT'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value);
};

// Format date based on format string
export const formatDate = (dateStr: string, format: string): string => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  
  return format
    .replace('DD', String(d.getDate()).padStart(2, '0'))
    .replace('MM', String(d.getMonth() + 1).padStart(2, '0'))
    .replace('YYYY', String(d.getFullYear()))
    .replace('YY', String(d.getFullYear()).slice(-2));
};

// Format number based on locale
export const formatNumber = (value: number, locale: string = 'de-AT'): string => {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export function useExportPreview() {
  const { user } = useAuth();
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [rawData, setRawData] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState<Record<string, number>>({});

  // Format a single receipt
  const formatReceipt = useCallback((
    receipt: Record<string, unknown>,
    columns: ExportColumn[],
    dateFormat: string,
    numberFormat: string
  ): PreviewRow => {
    const formatted: PreviewRow = {};

    columns.forEach(col => {
      // Handle empty columns
      if (col.type === 'empty') {
        formatted[col.field] = '';
        return;
      }

      let value = receipt[col.field];

      // Special field handling
      if (col.field === 'category') {
        value = (receipt.category as Record<string, unknown>)?.name || receipt.category;
      }
      if (col.field === 'vendor') {
        value = (receipt.vendor_data as Record<string, unknown>)?.display_name || receipt.vendor_brand || receipt.vendor;
      }

      // Apply formatting
      if (col.type === 'date' && value) {
        value = formatDate(String(value), col.format || dateFormat);
      } else if (col.type === 'currency' && value !== null && value !== undefined) {
        value = formatNumber(Number(value), numberFormat);
      } else if (col.type === 'percent' && value !== null && value !== undefined) {
        value = `${value}%`;
      }

      formatted[col.field] = value ?? '';
    });

    return formatted;
  }, []);

  // Group receipts by field
  const groupReceipts = useCallback((
    receipts: Record<string, unknown>[],
    groupField: string
  ): Record<string, Record<string, unknown>[]> => {
    const groups: Record<string, Record<string, unknown>[]> = {};
    
    receipts.forEach(receipt => {
      let key: string;

      switch (groupField) {
        case 'category':
          key = String((receipt.category as Record<string, unknown>)?.name || receipt.category || 'Ohne Kategorie');
          break;
        case 'vendor':
          key = String((receipt.vendor_data as Record<string, unknown>)?.display_name || receipt.vendor_brand || receipt.vendor || 'Unbekannt');
          break;
        case 'month': {
          const d = new Date(String(receipt.receipt_date));
          key = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
          break;
        }
        case 'quarter': {
          const qd = new Date(String(receipt.receipt_date));
          key = `Q${Math.ceil((qd.getMonth() + 1) / 3)} ${qd.getFullYear()}`;
          break;
        }
        case 'year':
          key = String(new Date(String(receipt.receipt_date)).getFullYear());
          break;
        case 'vat_rate':
          key = `${receipt.vat_rate || 0}%`;
          break;
        case 'payment_method':
          key = String(receipt.payment_method || 'Unbekannt');
          break;
        default:
          key = 'Alle';
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(receipt);
    });
    
    return groups;
  }, []);

  // Format export data with grouping
  const formatExportData = useCallback((
    receipts: Record<string, unknown>[],
    config: ExportPreviewConfig
  ): PreviewRow[] => {
    const { columns, groupBy, groupSubtotals, dateFormat, numberFormat } = config;
    const result: PreviewRow[] = [];

    if (groupBy) {
      const groups = groupReceipts(receipts, groupBy);

      for (const [groupName, items] of Object.entries(groups)) {
        // Group header
        result.push({ isGroupHeader: true, groupName });

        // Items
        items.forEach(receipt => {
          result.push(formatReceipt(receipt, columns, dateFormat, numberFormat));
        });

        // Subtotal
        if (groupSubtotals) {
          const subtotal: PreviewRow = {
            isSubtotal: true,
            groupName,
            amount_gross: formatNumber(
              items.reduce((sum, r) => sum + (Number(r.amount_gross) || 0), 0),
              numberFormat
            ),
            amount_net: formatNumber(
              items.reduce((sum, r) => sum + (Number(r.amount_net) || 0), 0),
              numberFormat
            ),
            vat_amount: formatNumber(
              items.reduce((sum, r) => sum + (Number(r.vat_amount) || 0), 0),
              numberFormat
            ),
          };
          result.push(subtotal);
        }
      }
    } else {
      // Without grouping
      receipts.forEach(receipt => {
        result.push(formatReceipt(receipt, columns, dateFormat, numberFormat));
      });
    }

    return result;
  }, [formatReceipt, groupReceipts]);

  // Calculate totals
  const calculateTotals = useCallback((
    receipts: Record<string, unknown>[],
    columns: ExportColumn[]
  ): Record<string, number> => {
    const currencyColumns = columns.filter(c => c.type === 'currency' && c.visible);
    const result: Record<string, number> = {};

    currencyColumns.forEach(col => {
      result[col.field] = receipts.reduce((sum, r) => sum + (Number(r[col.field]) || 0), 0);
    });

    return result;
  }, []);

  // Generate preview
  const generatePreview = useCallback(async (config: ExportPreviewConfig): Promise<PreviewRow[]> => {
    if (!user) return [];

    setLoading(true);
    try {
      let query = supabase
        .from('receipts')
        .select('*, category:categories(id, name), vendor_data:vendors(id, display_name)')
        .eq('user_id', user.id);

      // Apply sorting
      if (config.sortBy) {
        query = query.order(config.sortBy, { ascending: config.sortDirection === 'asc' });
      }

      // Limit for preview
      query = query.limit(50);

      const { data, error } = await query;

      if (error) throw error;

      const receipts = (data || []) as Record<string, unknown>[];
      setRawData(receipts);

      // Calculate totals
      const totalValues = calculateTotals(receipts, config.columns);
      setTotals(totalValues);

      // Format data
      const formatted = formatExportData(receipts, config);
      setPreviewData(formatted);

      return formatted;
    } catch (error) {
      console.error('Error generating preview:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user, formatExportData, calculateTotals]);

  // Get total for a specific field
  const getTotal = useCallback((field: string, numberFormat: string): string => {
    const value = totals[field] || 0;
    return formatNumber(value, numberFormat);
  }, [totals]);

  return {
    previewData,
    rawData,
    loading,
    totals,
    generatePreview,
    getTotal,
    formatCurrency,
    formatDate,
    formatNumber,
  };
}
