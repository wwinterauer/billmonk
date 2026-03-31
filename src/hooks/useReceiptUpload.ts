import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Receipt, UploadProgress, VendorDecisionPending } from './useReceipts';
import { 
  generateFileHash, 
  checkForDuplicates, 
  type DuplicateCheckResult 
} from '@/services/duplicateDetectionService';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 200;

export function useReceiptUpload(
  processReceiptWithAI: (
    file: File,
    receiptId: string,
    onProgress?: (progress: number, statusText?: string) => void,
    options?: { skipVendorMatching?: boolean }
  ) => Promise<{ 
    receipt: Receipt; 
    aiSuccess: boolean; 
    aiConfidence?: number;
    vendorDecision?: VendorDecisionPending;
  }>,
  updateReceipt: (id: string, data: Partial<Receipt>) => Promise<Receipt>
) {
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

  const checkExactDuplicate = async (
    fileHash: string
  ): Promise<{ id: string; file_name: string | null; vendor: string | null; amount_gross: number | null; receipt_date: string | null } | null> => {
    if (!user) return null;

    const { data } = await supabase
      .from('receipts')
      .select('id, file_name, vendor, amount_gross, receipt_date')
      .eq('user_id', user.id)
      .eq('file_hash', fileHash)
      .limit(1)
      .maybeSingle();

    return data;
  };

  // Helper to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  // Check if file is an image that needs conversion
  const isConvertibleImage = (file: File): boolean => {
    return ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type);
  };

  // Convert image to PDF via edge function
  const convertImageToPdf = async (
    file: File,
    _userId: string,
    onProgress?: (progress: number, statusText?: string) => void
  ): Promise<{ storagePath: string; fileName: string; fileType: string; fileHash: string }> => {
    onProgress?.(10, 'Bild wird zu PDF konvertiert...');
    
    const base64 = await fileToBase64(file);
    const base64Data = base64.split(',')[1];

    const { data, error } = await supabase.functions.invoke('convert-image-to-pdf', {
      body: {
        imageData: base64Data,
        fileName: file.name,
        contentType: file.type,
      }
    });

    if (error) {
      console.error('Image to PDF conversion failed:', error);
      throw new Error(`Bildkonvertierung fehlgeschlagen: ${error.message}`);
    }

    if (!data.success) {
      throw new Error(data.error || 'Bildkonvertierung fehlgeschlagen');
    }

    onProgress?.(30, 'PDF erstellt...');

    return {
      storagePath: data.storagePath,
      fileName: data.fileName,
      fileType: data.fileType,
      fileHash: data.fileHash,
    };
  };

  const uploadReceipt = async (
    file: File, 
    onProgress?: (progress: number, statusText?: string) => void,
    options?: {
      fileHash?: string;
      skipDuplicateCheck?: boolean;
      markAsDuplicate?: boolean;
      duplicateOfId?: string;
    }
  ): Promise<Receipt> => {
    if (!user) {
      throw new Error('Nicht angemeldet');
    }

    const validation = validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    let storagePath: string;
    let fileName: string;
    let fileType: string;
    let fileHash: string;

    // Check if image needs conversion to PDF
    if (isConvertibleImage(file)) {
      const result = await convertImageToPdf(file, user.id, onProgress);
      storagePath = result.storagePath;
      fileName = result.fileName;
      fileType = result.fileType;
      fileHash = result.fileHash;
    } else {
      fileHash = options?.fileHash || await generateFileHash(file);
      storagePath = generateStoragePath(user.id, file.name);
      fileName = file.name;
      fileType = getFileExtension(file.name);

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

      storagePath = uploadData.path;
      onProgress?.(40, 'Wird hochgeladen...');
    }

    // Check for exact duplicates BEFORE creating DB entry
    if (!options?.skipDuplicateCheck && !options?.markAsDuplicate) {
      const existingReceipt = await checkExactDuplicate(fileHash);
      if (existingReceipt) {
        await supabase.storage.from('receipts').remove([storagePath]);
        throw new Error(`DUPLICATE:${JSON.stringify(existingReceipt)}`);
      }
    }

    // Create database entry with 'processing' status
    const insertData = {
      user_id: user.id,
      file_url: storagePath,
      file_name: fileName,
      file_type: fileType,
      file_hash: fileHash,
      status: options?.markAsDuplicate ? 'duplicate' : 'processing',
      is_duplicate: options?.markAsDuplicate || false,
      duplicate_of: options?.duplicateOfId || null,
      duplicate_score: options?.markAsDuplicate ? 100 : null,
      duplicate_checked_at: options?.markAsDuplicate ? new Date().toISOString() : null,
    };

    const { data: receipt, error: dbError } = await supabase
      .from('receipts')
      .insert(insertData)
      .select()
      .single();

    if (dbError) {
      await supabase.storage.from('receipts').remove([storagePath]);
      throw new Error(`Datenbank-Fehler: ${dbError.message}`);
    }

    onProgress?.(50, 'Monk analysiert...');

    return receipt as Receipt;
  };

  const uploadAndProcessReceipt = async (
    file: File,
    onProgress?: (progress: number, statusText?: string) => void,
    options?: {
      fileHash?: string;
      skipDuplicateCheck?: boolean;
      markAsDuplicate?: boolean;
      duplicateOfId?: string;
      skipVendorMatching?: boolean;
    }
  ): Promise<{ 
    receipt: Receipt; 
    aiSuccess: boolean; 
    aiConfidence?: number; 
    duplicateCheck?: DuplicateCheckResult;
    vendorDecision?: VendorDecisionPending;
  }> => {
    if (!user) {
      throw new Error('Nicht angemeldet');
    }

    const fileHash = options?.fileHash || await generateFileHash(file);

    const receipt = await uploadReceipt(file, onProgress, { 
      ...options, 
      fileHash 
    });

    if (options?.markAsDuplicate) {
      return { receipt, aiSuccess: false };
    }
    
    const result = await processReceiptWithAI(file, receipt.id, onProgress, {
      skipVendorMatching: options?.skipVendorMatching
    });

    if (result.vendorDecision) {
      return result;
    }

    // After AI processing, check for content-based duplicates
    if (!options?.skipDuplicateCheck) {
      const duplicateCheck = await checkForDuplicates(
        user.id,
        fileHash,
        {
          vendor: result.receipt.vendor,
          amount_gross: result.receipt.amount_gross,
          receipt_date: result.receipt.receipt_date,
          invoice_number: result.receipt.invoice_number,
          file_name: file.name
        },
        receipt.id
      );

      if (duplicateCheck.isDuplicate) {
        await supabase
          .from('receipts')
          .update({
            is_duplicate: true,
            duplicate_of: duplicateCheck.duplicateOf,
            duplicate_score: duplicateCheck.score,
            duplicate_checked_at: new Date().toISOString(),
          })
          .eq('id', receipt.id);

        return { ...result, duplicateCheck };
      }
    }

    return result;
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

  return {
    uploading,
    validateFile,
    validateFiles,
    uploadReceipt,
    uploadAndProcessReceipt,
    uploadMultipleReceipts,
    checkExactDuplicate,
    generateFileHash,
    ALLOWED_TYPES,
    MAX_FILE_SIZE,
    MAX_FILES,
  };
}
