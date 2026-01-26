import { useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Json } from '@/integrations/supabase/types';
import { extractReceiptData, normalizeExtractionResult } from '@/services/aiService';

export interface Receipt {
  id: string;
  user_id: string;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  status: 'pending' | 'processing' | 'review' | 'approved' | 'rejected';
  vendor: string | null;
  description: string | null;
  amount_gross: number | null;
  amount_net: number | null;
  vat_amount: number | null;
  vat_rate: number | null;
  currency: string;
  receipt_date: string | null;
  category: string | null;
  payment_method: string | null;
  notes: string | null;
  invoice_number: string | null;
  ai_confidence: number | null;
  ai_raw_response: Json | null;
  bank_transaction_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReceiptFilters {
  status?: string;
  month?: number;
  year?: number;
  dateFrom?: string; // Format: YYYY-MM-DD
  dateTo?: string;   // Format: YYYY-MM-DD
}

export type UploadStatus = 'pending' | 'uploading' | 'processing' | 'complete' | 'complete-manual' | 'error';

export interface UploadProgress {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: UploadStatus;
  statusText?: string;
  error?: string;
  receipt?: Receipt;
  aiConfidence?: number;
}

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 10;

export function useReceipts() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { 
        valid: false, 
        error: `Ungültiger Dateityp: ${file.type}. Erlaubt sind PDF, JPG, PNG, WebP.` 
      };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { 
        valid: false, 
        error: `Datei zu groß: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum ist 10MB.` 
      };
    }
    return { valid: true };
  };

  const validateFiles = (files: File[]): { validFiles: File[]; errors: string[] } => {
    const errors: string[] = [];
    
    if (files.length > MAX_FILES) {
      errors.push(`Maximal ${MAX_FILES} Dateien gleichzeitig erlaubt.`);
      files = files.slice(0, MAX_FILES);
    }

    const validFiles = files.filter(file => {
      const validation = validateFile(file);
      if (!validation.valid && validation.error) {
        errors.push(`${file.name}: ${validation.error}`);
      }
      return validation.valid;
    });

    return { validFiles, errors };
  };

  const getFileExtension = (fileName: string): string => {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
  };

  const generateStoragePath = (userId: string, fileName: string): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const uuid = crypto.randomUUID();
    const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${userId}/${year}/${month}/${uuid}_${safeFileName}`;
  };

  const uploadReceipt = async (
    file: File, 
    onProgress?: (progress: number, statusText?: string) => void
  ): Promise<Receipt> => {
    if (!user) {
      throw new Error('Nicht angemeldet');
    }

    const validation = validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const storagePath = generateStoragePath(user.id, file.name);
    const fileExtension = getFileExtension(file.name);

    // Phase 1: Upload to Storage (0-50%)
    onProgress?.(5, 'Wird hochgeladen...');

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload fehlgeschlagen: ${uploadError.message}`);
    }

    onProgress?.(40, 'Wird hochgeladen...');

    // Create database entry with 'processing' status
    const { data: receipt, error: dbError } = await supabase
      .from('receipts')
      .insert({
        user_id: user.id,
        file_url: uploadData.path,
        file_name: file.name,
        file_type: fileExtension,
        status: 'processing',
      })
      .select()
      .single();

    if (dbError) {
      // Try to clean up uploaded file
      await supabase.storage.from('receipts').remove([storagePath]);
      throw new Error(`Datenbank-Fehler: ${dbError.message}`);
    }

    onProgress?.(50, 'KI analysiert...');

    return receipt as Receipt;
  };

  const processReceiptWithAI = async (
    file: File,
    receiptId: string,
    onProgress?: (progress: number, statusText?: string) => void
  ): Promise<{ receipt: Receipt; aiSuccess: boolean; aiConfidence?: number }> => {
    if (!user) {
      throw new Error('Nicht angemeldet');
    }

    // Check if file is supported for AI extraction
    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    const isSupported = supportedTypes.includes(file.type);

    if (!isSupported) {
      // Not a supported type, set to pending for manual entry
      onProgress?.(100, 'Manuelle Eingabe');
      const updated = await updateReceipt(receiptId, { status: 'pending' });
      return { receipt: updated, aiSuccess: false };
    }

    try {
      onProgress?.(60, 'KI analysiert...');
      
      // Call AI extraction
      const extracted = await extractReceiptData(file);
      const normalized = normalizeExtractionResult(extracted);

      onProgress?.(90, 'Speichern...');

      // Update receipt with extracted data
      const updated = await updateReceipt(receiptId, {
        vendor: normalized.vendor,
        description: normalized.description,
        amount_gross: normalized.amount_gross,
        amount_net: normalized.amount_net,
        vat_amount: normalized.vat_amount,
        vat_rate: normalized.vat_rate,
        receipt_date: normalized.receipt_date,
        category: normalized.category,
        payment_method: normalized.payment_method,
        ai_confidence: normalized.confidence,
        ai_raw_response: normalized as unknown as Json,
        status: 'review',
      });

      onProgress?.(100, 'Zur Überprüfung');

      return { 
        receipt: updated, 
        aiSuccess: true, 
        aiConfidence: normalized.confidence 
      };

    } catch (error) {
      console.error('AI extraction failed:', error);
      
      // AI failed, set to pending for manual entry
      onProgress?.(100, 'Manuelle Eingabe');
      const updated = await updateReceipt(receiptId, { status: 'pending' });
      
      return { receipt: updated, aiSuccess: false };
    }
  };

  const uploadAndProcessReceipt = async (
    file: File,
    onProgress?: (progress: number, statusText?: string) => void
  ): Promise<{ receipt: Receipt; aiSuccess: boolean; aiConfidence?: number }> => {
    // First upload
    const receipt = await uploadReceipt(file, onProgress);
    
    // Then process with AI
    return processReceiptWithAI(file, receipt.id, onProgress);
  };

  const uploadMultipleReceipts = async (
    files: File[],
    onFileProgress?: (fileId: string, progress: number, status: UploadProgress['status'], statusText?: string, error?: string, receipt?: Receipt, aiConfidence?: number) => void
  ): Promise<{ successful: Receipt[]; failed: { fileName: string; error: string }[] }> => {
    if (!user) {
      throw new Error('Nicht angemeldet');
    }

    setUploading(true);
    const successful: Receipt[] = [];
    const failed: { fileName: string; error: string }[] = [];

    for (const file of files) {
      const fileId = crypto.randomUUID();
      
      try {
        onFileProgress?.(fileId, 0, 'uploading', 'Wird hochgeladen...');
        
        const result = await uploadAndProcessReceipt(file, (progress, statusText) => {
          const status: UploadProgress['status'] = progress < 50 ? 'uploading' : 'processing';
          onFileProgress?.(fileId, progress, status, statusText);
        });
        
        successful.push(result.receipt);
        
        const finalStatus: UploadProgress['status'] = result.aiSuccess ? 'complete' : 'complete-manual';
        const finalText = result.aiSuccess ? 'Zur Überprüfung' : 'Manuelle Eingabe';
        onFileProgress?.(fileId, 100, finalStatus, finalText, undefined, result.receipt, result.aiConfidence);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
        failed.push({ fileName: file.name, error: errorMessage });
        onFileProgress?.(fileId, 0, 'error', undefined, errorMessage);
      }
    }

    setUploading(false);
    return { successful, failed };
  };

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

    // New date range filter (preferred over month/year)
    if (filters?.dateFrom || filters?.dateTo) {
      if (filters.dateFrom) {
        query = query.gte('receipt_date', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('receipt_date', filters.dateTo);
      }
    } else if (filters?.year) {
      // Legacy month/year filter for backwards compatibility
      const startDate = new Date(filters.year, filters.month ? filters.month - 1 : 0, 1);
      const endDate = filters.month 
        ? new Date(filters.year, filters.month, 0)
        : new Date(filters.year, 11, 31);
      
      query = query
        .gte('receipt_date', format(startDate, 'yyyy-MM-dd'))
        .lte('receipt_date', format(endDate, 'yyyy-MM-dd'));
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
    uploading,
    validateFile,
    validateFiles,
    uploadReceipt,
    uploadAndProcessReceipt,
    processReceiptWithAI,
    uploadMultipleReceipts,
    getReceipts,
    getReceipt,
    updateReceipt,
    deleteReceipt,
    getReceiptFileUrl,
    ALLOWED_TYPES,
    MAX_FILE_SIZE,
    MAX_FILES,
  };
}
