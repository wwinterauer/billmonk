import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Receipt, ReceiptFilters } from './useReceipts';

export function useReceiptCrud() {
  const { user } = useAuth();

  const buildCreatedAtBoundary = (date: string, endOfDay = false) =>
    `${date}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`;

  const getReceipts = async (filters?: ReceiptFilters): Promise<Receipt[]> => {
    if (!user) {
      throw new Error('Nicht angemeldet');
    }

    let query = supabase
      .from('receipts')
      .select('*')
      .eq('user_id', user.id)
      .order('receipt_date', { ascending: false, nullsFirst: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const applyDateRangeWithCreatedAtFallback = (dateFrom?: string, dateTo?: string) => {
      const receiptDateConditions: string[] = [];
      const createdAtConditions: string[] = ['receipt_date.is.null'];

      if (dateFrom) {
        receiptDateConditions.push(`receipt_date.gte.${dateFrom}`);
        createdAtConditions.push(`created_at.gte.${buildCreatedAtBoundary(dateFrom)}`);
      }

      if (dateTo) {
        receiptDateConditions.push(`receipt_date.lte.${dateTo}`);
        createdAtConditions.push(`created_at.lte.${buildCreatedAtBoundary(dateTo, true)}`);
      }

      const orConditions = [
        receiptDateConditions.length > 0 ? `and(${receiptDateConditions.join(',')})` : null,
        `and(${createdAtConditions.join(',')})`,
      ].filter(Boolean);

      query = query.or(orConditions.join(','));
    };

    if (filters?.dateFrom || filters?.dateTo) {
      applyDateRangeWithCreatedAtFallback(filters.dateFrom, filters.dateTo);
    } else if (filters?.year) {
      const startDate = new Date(filters.year, filters.month ? filters.month - 1 : 0, 1);
      const endDate = filters.month
        ? new Date(filters.year, filters.month, 0)
        : new Date(filters.year, 11, 31);

      applyDateRangeWithCreatedAtFallback(
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd')
      );
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Fehler beim Laden: ${error.message}`);
    }

    return (data || []) as Receipt[];
  };

  const getReceipt = async (id: string): Promise<Receipt | null> => {
    if (!user) {
      throw new Error('Nicht angemeldet');
    }

    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      throw new Error(`Fehler beim Laden: ${error.message}`);
    }

    return data as Receipt | null;
  };

  const updateReceipt = async (id: string, data: Partial<Receipt>): Promise<Receipt> => {
    if (!user) {
      throw new Error('Nicht angemeldet');
    }

    // Remove fields that shouldn't be updated
    const { id: _, user_id: _user_id, created_at: _created_at, updated_at: _updated_at, ...updateData } = data as Partial<Receipt> & { id?: string };

    const { data: updated, error } = await supabase
      .from('receipts')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Fehler beim Aktualisieren: ${error.message}`);
    }

    return updated as Receipt;
  };

  /**
   * Reject a receipt and clear duplicate-detection data so the file can be re-uploaded.
   * This clears file_hash to prevent duplicate detection and optionally deletes the file from storage.
   */
  const rejectReceipt = async (id: string, options?: { deleteFile?: boolean; reason?: string }): Promise<Receipt> => {
    if (!user) {
      throw new Error('Nicht angemeldet');
    }

    // Get receipt to find file URL if we need to delete
    const receipt = await getReceipt(id);
    if (!receipt) {
      throw new Error('Beleg nicht gefunden');
    }

    // Update status to rejected and clear file_hash to allow re-upload
    const updateData: Partial<Receipt> = {
      status: 'rejected',
      file_hash: null, // Clear hash so same file can be uploaded again
      is_duplicate: false,
      duplicate_of: null,
      duplicate_score: null,
      notes: options?.reason || 'Manuell abgelehnt',
    };

    const { data: updated, error } = await supabase
      .from('receipts')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Fehler beim Ablehnen: ${error.message}`);
    }

    // Optionally delete file from storage
    if (options?.deleteFile && receipt.file_url) {
      const { error: storageError } = await supabase.storage
        .from('receipts')
        .remove([receipt.file_url]);

      if (storageError) {
        console.error('Storage deletion on reject failed:', storageError);
      }
    }

    return updated as Receipt;
  };

  const deleteReceipt = async (id: string): Promise<void> => {
    if (!user) {
      throw new Error('Nicht angemeldet');
    }

    // First get the receipt to find the file URL
    const receipt = await getReceipt(id);
    
    if (!receipt) {
      throw new Error('Beleg nicht gefunden');
    }

    // Delete from database first
    const { error: dbError } = await supabase
      .from('receipts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (dbError) {
      throw new Error(`Fehler beim Löschen: ${dbError.message}`);
    }

    // Then delete from storage if file exists
    if (receipt.file_url) {
      const { error: storageError } = await supabase.storage
        .from('receipts')
        .remove([receipt.file_url]);

      if (storageError) {
        console.error('Storage deletion failed:', storageError);
        // Don't throw here as the DB entry is already deleted
      }
    }
  };

  const getReceiptFileUrl = async (filePath: string): Promise<string> => {
    if (!user) {
      throw new Error('Nicht angemeldet');
    }

    const { data, error } = await supabase.storage
      .from('receipts')
      .createSignedUrl(filePath, 3600); // 1 hour validity

    if (error) {
      throw new Error(`Fehler beim Generieren der URL: ${error.message}`);
    }

    return data.signedUrl;
  };

  return {
    getReceipts,
    getReceipt,
    updateReceipt,
    rejectReceipt,
    deleteReceipt,
    getReceiptFileUrl,
  };
}
