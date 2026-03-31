import type { Json } from '@/integrations/supabase/types';
import type { MatchedVendor, VendorSuggestion, FindOrCreateVendorResult } from '@/services/vendorMatchingService';
import type { DuplicateCheckResult } from '@/services/duplicateDetectionService';
import { useReceiptCrud } from './useReceiptCrud';
import { useReceiptProcessing } from './useReceiptProcessing';
import { useReceiptUpload } from './useReceiptUpload';

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
  tax_type: string | null;
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
  // Auto-approve
  auto_approved: boolean;
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

// Export types for external use
export type { MatchedVendor, VendorSuggestion, FindOrCreateVendorResult };

export function useReceipts() {
  const crud = useReceiptCrud();
  const processing = useReceiptProcessing(crud.updateReceipt);
  const upload = useReceiptUpload(processing.processReceiptWithAI, crud.updateReceipt);

  return {
    // CRUD
    ...crud,
    // Processing
    ...processing,
    // Upload
    ...upload,
  };
}
