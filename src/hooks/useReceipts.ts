import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Json } from '@/integrations/supabase/types';

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
}

export interface UploadProgress {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
  receipt?: Receipt;
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
    onProgress?: (progress: number) => void
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

    // Upload to Supabase Storage
    // Note: Supabase doesn't provide upload progress natively, so we simulate it
    onProgress?.(10);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload fehlgeschlagen: ${uploadError.message}`);
    }

    onProgress?.(70);

    // Create database entry
    const { data: receipt, error: dbError } = await supabase
      .from('receipts')
      .insert({
        user_id: user.id,
        file_url: uploadData.path,
        file_name: file.name,
        file_type: fileExtension,
        status: 'pending',
      })
      .select()
      .single();

    if (dbError) {
      // Try to clean up uploaded file
      await supabase.storage.from('receipts').remove([storagePath]);
      throw new Error(`Datenbank-Fehler: ${dbError.message}`);
    }

    onProgress?.(100);

    return receipt as Receipt;
  };

  const uploadMultipleReceipts = async (
    files: File[],
    onFileProgress?: (fileId: string, progress: number, status: UploadProgress['status'], error?: string, receipt?: Receipt) => void
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
        onFileProgress?.(fileId, 0, 'uploading');
        
        const receipt = await uploadReceipt(file, (progress) => {
          onFileProgress?.(fileId, progress, 'uploading');
        });
        
        successful.push(receipt);
        onFileProgress?.(fileId, 100, 'complete', undefined, receipt);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
        failed.push({ fileName: file.name, error: errorMessage });
        onFileProgress?.(fileId, 0, 'error', errorMessage);
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
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.year) {
      const startDate = new Date(filters.year, filters.month ? filters.month - 1 : 0, 1);
      const endDate = filters.month 
        ? new Date(filters.year, filters.month, 0)
        : new Date(filters.year, 11, 31);
      
      query = query
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());
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
