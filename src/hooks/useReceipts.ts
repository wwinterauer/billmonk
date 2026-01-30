import { useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Json } from '@/integrations/supabase/types';
import { extractReceiptData, normalizeExtractionResult, fetchDescriptionSettings, extractReceiptDataWithLearning, findVendorIdByName } from '@/services/aiService';
import { matchOrCreateVendor, findOrCreateVendor, addVendorVariant, type MatchedVendor, type VendorSuggestion, type FindOrCreateVendorResult } from '@/services/vendorMatchingService';
import { 
  generateFileHash, 
  checkForDuplicates, 
  type DuplicateCheckResult 
} from '@/services/duplicateDetectionService';

export interface Receipt {
  id: string;
  user_id: string;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  status: 'pending' | 'processing' | 'review' | 'approved' | 'rejected' | 'duplicate' | 'not_a_receipt' | 'error' | 'needs_splitting' | 'split';
  vendor: string | null;
  vendor_brand: string | null;
  vendor_id: string | null;
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
  ai_processed_at: string | null;
  bank_transaction_id: string | null;
  custom_filename: string | null;
  // Duplicate detection fields
  file_hash: string | null;
  is_duplicate: boolean | null;
  duplicate_of: string | null;
  duplicate_score: number | null;
  duplicate_checked_at: string | null;
  // Tracking modified fields
  user_modified_fields: string[] | null;
  // PDF splitting fields
  page_count: number | null;
  split_suggestion: Json | null;
  split_from_receipt_id: string | null;
  original_pages: number[] | null;
  // Source tracking
  source: string | null;
  email_attachment_id: string | null;
  is_no_receipt_entry: boolean | null;
  bank_import_keyword_id: string | null;
  bank_transaction_reference: string | null;
  created_at: string;
  updated_at: string;
}

// Extended receipt with email attachment data
export interface ReceiptWithEmailData extends Receipt {
  email_attachments?: {
    email_from: string | null;
    email_subject: string | null;
    email_received_at: string | null;
  } | null;
}

export interface DuplicateInfo {
  type: 'exact' | 'content';
  original: {
    id: string;
    file_name: string | null;
    vendor: string | null;
    amount_gross: number | null;
    receipt_date: string | null;
  };
  file: File;
  fileHash: string;
  duplicateCheck?: DuplicateCheckResult;
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

export interface VendorDecisionPending {
  receiptId: string;
  extractedData: Partial<Receipt>;
  detectedName: string;
  suggestions: VendorSuggestion[];
}

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 200; // Allow up to 200 files at once (business users have unlimited storage)

// Export types for external use
export type { MatchedVendor, VendorSuggestion, FindOrCreateVendorResult };

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
  // Note: userId parameter kept for API compatibility but not used - auth extracted from JWT
  const convertImageToPdf = async (
    file: File,
    _userId: string, // Kept for backward compatibility, not sent to server
    onProgress?: (progress: number, statusText?: string) => void
  ): Promise<{ storagePath: string; fileName: string; fileType: string; fileHash: string }> => {
    onProgress?.(10, 'Bild wird zu PDF konvertiert...');
    
    const base64 = await fileToBase64(file);
    const base64Data = base64.split(',')[1]; // Remove data:image/xxx;base64, prefix

    // Security: userId is now extracted from auth token server-side
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
      // Convert image to PDF via edge function
      const result = await convertImageToPdf(file, user.id, onProgress);
      storagePath = result.storagePath;
      fileName = result.fileName;
      fileType = result.fileType;
      fileHash = result.fileHash;
    } else {
      // PDF or other supported file - upload directly
      fileHash = options?.fileHash || await generateFileHash(file);
      storagePath = generateStoragePath(user.id, file.name);
      fileName = file.name;
      fileType = getFileExtension(file.name);

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

      storagePath = uploadData.path;
      onProgress?.(40, 'Wird hochgeladen...');
    }

    // Check for exact duplicates BEFORE creating DB entry
    if (!options?.skipDuplicateCheck && !options?.markAsDuplicate) {
      const existingReceipt = await checkExactDuplicate(fileHash);
      if (existingReceipt) {
        // Clean up uploaded file since it's a duplicate
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
    onProgress?: (progress: number, statusText?: string) => void,
    options?: {
      skipVendorMatching?: boolean;
    }
  ): Promise<{ 
    receipt: Receipt; 
    aiSuccess: boolean; 
    aiConfidence?: number;
    vendorDecision?: VendorDecisionPending;
  }> => {
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
      const baseExtracted = await extractReceiptData(file);
      
      // Try to find vendor ID by name for learning pattern application
      const vendorName = baseExtracted.vendor_brand || baseExtracted.vendor;
      let potentialVendorId: string | null = null;
      
      if (vendorName) {
        potentialVendorId = await findVendorIdByName(vendorName, user.id);
      }
      
      // Apply learned patterns if vendor is known
      const extracted = await extractReceiptDataWithLearning(baseExtracted, user.id, potentialVendorId);
      
      // Check if learning was applied
      const learningApplied = 'learning_applied' in extracted && extracted.learning_applied;
      const learningWarnings = '_warnings' in extracted ? (extracted as { _warnings?: Array<{ field: string; message: string }> })._warnings : undefined;
      
      // Fetch user's description settings
      const descriptionSettings = await fetchDescriptionSettings(user.id);
      const normalized = normalizeExtractionResult(extracted, descriptionSettings);

      onProgress?.(80, learningApplied ? 'Lernmuster angewendet...' : 'Lieferant zuordnen...');

      // Match or create vendor based on detected name
      const finalVendorName = normalized.vendor_brand || normalized.vendor;
      
      // Prepare update data
      const updateData: Partial<Receipt> = {
        vendor: normalized.vendor,
        vendor_brand: normalized.vendor_brand,
        description: normalized.description,
        amount_gross: normalized.amount_gross,
        amount_net: normalized.amount_net,
        vat_amount: normalized.vat_amount,
        vat_rate: normalized.vat_rate,
        receipt_date: normalized.receipt_date,
        category: normalized.category,
        payment_method: normalized.payment_method,
        invoice_number: normalized.invoice_number,
        ai_confidence: normalized.confidence,
        ai_raw_response: normalized as unknown as Json,
        ai_processed_at: new Date().toISOString(),
        status: 'review',
      };

      // Use enhanced vendor matching with similarity check
      if (finalVendorName && !options?.skipVendorMatching) {
        const vendorResult = await findOrCreateVendor(user.id, finalVendorName, {
          autoCreate: false,
          minSimilarity: 60
        });

        if (vendorResult.needsUserDecision && vendorResult.suggestions.length > 0) {
          // User needs to decide - save receipt with extracted data but no vendor
          onProgress?.(90, 'Warte auf Lieferanten-Auswahl...');
          
          const updated = await updateReceipt(receiptId, {
            ...updateData,
            status: 'processing', // Keep in processing until vendor is selected
          });

          return {
            receipt: updated,
            aiSuccess: true,
            aiConfidence: normalized.confidence,
            vendorDecision: {
              receiptId,
              extractedData: updateData,
              detectedName: finalVendorName,
              suggestions: vendorResult.suggestions
            }
          };
        }

        // Apply vendor if found (high similarity auto-match or exact match)
        if (vendorResult.vendor) {
          updateData.vendor_id = vendorResult.vendor.id;
          updateData.vendor = vendorResult.vendor.display_name;
          
          // Vendor default category ALWAYS takes precedence when set
          if (vendorResult.vendor.default_category_id) {
            updateData.category = vendorResult.vendor.default_category_id;
          }
          
          // Apply vendor default VAT rate if AI didn't detect one
          if (vendorResult.vendor.default_vat_rate !== null && normalized.vat_rate === null) {
            updateData.vat_rate = vendorResult.vendor.default_vat_rate;
            if (updateData.amount_gross && updateData.vat_rate) {
              const grossAmount = updateData.amount_gross;
              const vatRate = updateData.vat_rate;
              updateData.amount_net = Number((grossAmount / (1 + vatRate / 100)).toFixed(2));
              updateData.vat_amount = Number((grossAmount - updateData.amount_net).toFixed(2));
            }
          }
        } else if (vendorResult.isNew) {
          // No match found and not auto-created - create new vendor
          const newVendor = await createVendorForReceipt(finalVendorName);
          if (newVendor) {
            updateData.vendor_id = newVendor.id;
            updateData.vendor = newVendor.display_name;
          }
        }
      } else if (finalVendorName) {
        // Skip vendor matching - use old behavior
        const matchedVendor = await matchOrCreateVendor(finalVendorName, user.id);
        if (matchedVendor) {
          updateData.vendor_id = matchedVendor.id;
          updateData.vendor = matchedVendor.display_name;
          
          if (matchedVendor.default_category_id) {
            updateData.category = matchedVendor.default_category_id;
          }
          
          if (matchedVendor.default_vat_rate !== null && normalized.vat_rate === null) {
            updateData.vat_rate = matchedVendor.default_vat_rate;
            if (updateData.amount_gross && updateData.vat_rate) {
              const grossAmount = updateData.amount_gross;
              const vatRate = updateData.vat_rate;
              updateData.amount_net = Number((grossAmount / (1 + vatRate / 100)).toFixed(2));
              updateData.vat_amount = Number((grossAmount - updateData.amount_net).toFixed(2));
            }
          }
        }
      }
      
      // Log learning warnings if any
      if (learningWarnings && learningWarnings.length > 0) {
        for (const warning of learningWarnings) {
          console.warn(`[Learning Warning] ${warning.field}: ${warning.message}`);
        }
      }

      onProgress?.(90, 'Speichern...');

      // Update receipt with extracted data
      const updated = await updateReceipt(receiptId, updateData);

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

  const createVendorForReceipt = async (
    name: string,
    options?: { legalName?: string }
  ): Promise<MatchedVendor | null> => {
    if (!user) {
      throw new Error('Nicht angemeldet');
    }
    
    const { data, error } = await supabase
      .from('vendors')
      .insert({
        user_id: user.id,
        display_name: name.trim(),
        detected_names: [name.trim()],
        legal_name: options?.legalName?.trim() || null
      })
      .select(`
        *,
        default_category:categories(id, name, color)
      `)
      .single();

    if (error) {
      console.error('Error creating vendor:', error);
      return null;
    }

    return {
      id: data.id,
      user_id: data.user_id,
      display_name: data.display_name,
      legal_name: data.legal_name,
      detected_names: data.detected_names || [],
      default_category_id: data.default_category_id,
      default_vat_rate: data.default_vat_rate,
      default_category: data.default_category
    };
  };

  const finalizeReceiptWithVendor = async (
    receiptId: string,
    extractedData: Partial<Receipt>,
    vendor: MatchedVendor | null,
    detectedName?: string
  ): Promise<Receipt> => {
    if (!user) {
      throw new Error('Nicht angemeldet');
    }

    const updateData: Partial<Receipt> = {
      ...extractedData,
      status: 'review',
      duplicate_checked_at: new Date().toISOString()
    };

    if (vendor) {
      updateData.vendor = vendor.display_name;
      updateData.vendor_id = vendor.id;

      // Apply vendor defaults
      if (vendor.default_category_id && !extractedData.category) {
        updateData.category = vendor.default_category_id;
      }
      if (vendor.default_vat_rate !== null && !extractedData.vat_rate) {
        updateData.vat_rate = vendor.default_vat_rate;
        // Recalculate VAT amounts
        if (updateData.amount_gross && updateData.vat_rate) {
          const grossAmount = updateData.amount_gross;
          const vatRate = updateData.vat_rate;
          updateData.amount_net = Number((grossAmount / (1 + vatRate / 100)).toFixed(2));
          updateData.vat_amount = Number((grossAmount - updateData.amount_net).toFixed(2));
        }
      }

      // Add detected name as variant if provided
      if (detectedName) {
        await addVendorVariant(vendor.id, detectedName);
      }

      // Update vendor's legal_name if not set and we have legal name from receipt
      if (!vendor.legal_name && extractedData.vendor && extractedData.vendor !== vendor.display_name) {
        await supabase
          .from('vendors')
          .update({ legal_name: extractedData.vendor })
          .eq('id', vendor.id)
          .is('legal_name', null);
      }
    }

    return await updateReceipt(receiptId, updateData);
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

    // Generate hash first for duplicate check
    const fileHash = options?.fileHash || await generateFileHash(file);

    // First upload
    const receipt = await uploadReceipt(file, onProgress, { 
      ...options, 
      fileHash 
    });

    // If marked as duplicate, skip AI processing
    if (options?.markAsDuplicate) {
      return { receipt, aiSuccess: false };
    }
    
    // Process with AI
    const result = await processReceiptWithAI(file, receipt.id, onProgress, {
      skipVendorMatching: options?.skipVendorMatching
    });

    // If vendor decision is needed, return early
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
        // Update receipt with duplicate info
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
    rejectReceipt,
    deleteReceipt,
    getReceiptFileUrl,
    checkExactDuplicate,
    generateFileHash,
    finalizeReceiptWithVendor,
    createVendorForReceipt,
    ALLOWED_TYPES,
    MAX_FILE_SIZE,
    MAX_FILES,
  };
}
