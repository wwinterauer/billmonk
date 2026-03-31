import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Json } from '@/integrations/supabase/types';
import type { Receipt, VendorDecisionPending } from './useReceipts';
import { extractReceiptDataById, normalizeExtractionResult, fetchDescriptionSettings, extractReceiptDataWithLearning, findVendorIdByName } from '@/services/aiService';
import { matchOrCreateVendor, findOrCreateVendor, addVendorVariant, type MatchedVendor } from '@/services/vendorMatchingService';

export function useReceiptProcessing(
  updateReceipt: (id: string, data: Partial<Receipt>) => Promise<Receipt>
) {
  const { user } = useAuth();

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
      onProgress?.(60, 'Monk analysiert...');
      
      // Use ID-based extraction so the Edge Function can:
      // 1. Load the file from storage
      // 2. Count pages and store page_count in DB
      // 3. Run multi-invoice detection for multi-page PDFs
      const extractionResponse = await extractReceiptDataById(receiptId);

      // Multi-invoice detected – DB is already updated to needs_splitting by the Edge Function
      if (extractionResponse.needs_splitting) {
        onProgress?.(100, 'Mehrere Rechnungen erkannt');
        const { data: freshReceipt } = await supabase
          .from('receipts')
          .select('*')
          .eq('id', receiptId)
          .single();
        return { receipt: freshReceipt as Receipt, aiSuccess: false };
      }

      const baseExtracted = extractionResponse.result!;
      
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

      // Auto-approve logic: check if vendor has auto_approve enabled
      if (updateData.vendor_id) {
        const { data: vendorData } = await supabase
          .from('vendors')
          .select('auto_approve, auto_approve_min_confidence')
          .eq('id', updateData.vendor_id)
          .single();

        if (vendorData?.auto_approve) {
          const confidence = updateData.ai_confidence ?? 0;
          const minConfidence = vendorData.auto_approve_min_confidence ?? 0.8;
          const isDuplicate = updateData.is_duplicate === true;
          const needsSplitting = updateData.status === 'needs_splitting' || 
            (updateData.split_suggestion && typeof updateData.split_suggestion === 'object' && 
             (updateData.split_suggestion as any)?.contains_multiple_invoices === true);

          if (confidence >= minConfidence && !isDuplicate && !needsSplitting) {
            updateData.status = 'approved';
            (updateData as any).auto_approved = true;
          }
        }
      }

      onProgress?.(90, 'Speichern...');

      // Update receipt with extracted data
      const updated = await updateReceipt(receiptId, updateData);

      onProgress?.(100, updateData.status === 'approved' ? 'Auto-freigegeben' : 'Zur Überprüfung');

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
        legal_names: options?.legalName?.trim() ? [options.legalName.trim()] : []
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
      legal_names: data.legal_names || [],
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

      // Update vendor's legal_names if we have a new legal name from receipt
      if (extractedData.vendor && extractedData.vendor !== vendor.display_name) {
        const existingLegalNames = vendor.legal_names || [];
        const newLegalName = extractedData.vendor;
        if (!existingLegalNames.some(ln => ln.toLowerCase() === newLegalName.toLowerCase())) {
          await supabase
            .from('vendors')
            .update({ legal_names: [...existingLegalNames, newLegalName] })
            .eq('id', vendor.id);
        }
      }

      // Auto-approve logic for manual vendor selection
      const { data: vendorAutoData } = await supabase
        .from('vendors')
        .select('auto_approve, auto_approve_min_confidence')
        .eq('id', vendor.id)
        .single();

      if (vendorAutoData?.auto_approve) {
        // Load current receipt to check for duplicates/splitting
        const { data: currentReceipt } = await supabase
          .from('receipts')
          .select('ai_confidence, is_duplicate, split_suggestion, status')
          .eq('id', receiptId)
          .single();

        const confidence = currentReceipt?.ai_confidence ?? extractedData.ai_confidence ?? 0;
        const minConfidence = vendorAutoData.auto_approve_min_confidence ?? 0.8;
        const isDuplicate = currentReceipt?.is_duplicate === true;
        const needsSplitting = currentReceipt?.status === 'needs_splitting' ||
          (currentReceipt?.split_suggestion && typeof currentReceipt.split_suggestion === 'object' &&
           (currentReceipt.split_suggestion as any)?.contains_multiple_invoices === true);

        if (confidence >= minConfidence && !isDuplicate && !needsSplitting) {
          updateData.status = 'approved';
          (updateData as any).auto_approved = true;
        }
      }
    }

    return await updateReceipt(receiptId, updateData);
  };

  return {
    processReceiptWithAI,
    createVendorForReceipt,
    finalizeReceiptWithVendor,
  };
}
