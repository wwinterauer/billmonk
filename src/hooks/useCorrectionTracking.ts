import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCallback } from 'react';
import type { Json } from '@/integrations/supabase/types';
import { recordVatRateCorrection } from '@/services/vatLearningService';

const STOP_WORDS = new Set([
  'und', 'oder', 'der', 'die', 'das', 'ein', 'eine', 'für', 'mit', 'von',
  'auf', 'aus', 'bei', 'nach', 'über', 'unter', 'vor', 'zum', 'zur',
  'inkl', 'zzgl', 'netto', 'brutto', 'stück', 'stk', 'paket',
  'rechnung', 'beleg', 'quittung', 'datum', 'summe', 'gesamt',
]);

/** Extract keywords from receipt description + line items */
async function extractReceiptKeywords(receiptId: string): Promise<string[]> {
  const { data: receiptData } = await supabase
    .from('receipts')
    .select('description, line_items_raw')
    .eq('id', receiptId)
    .single();

  if (!receiptData) return [];

  const texts: string[] = [];
  if (receiptData.description) texts.push(receiptData.description);

  // Extract descriptions from line_items_raw
  const lineItems = receiptData.line_items_raw;
  if (Array.isArray(lineItems)) {
    for (const item of lineItems) {
      if (item && typeof item === 'object' && 'description' in item && typeof (item as any).description === 'string') {
        texts.push((item as any).description);
      }
    }
  }

  if (texts.length === 0) return [];

  const allWords = texts
    .join(' ')
    .toLowerCase()
    .replace(/[^a-zäöüß\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOP_WORDS.has(w));

  // Deduplicate and limit
  return [...new Set(allWords)].slice(0, 10);
}

interface CorrectionData {
  fieldName: string;
  detectedValue: unknown;
  correctedValue: unknown;
  receiptId: string;
  vendorId: string;
}

interface FieldPattern {
  prefixes: string[];
  suffixes: string[];
  regex_patterns: string[];
  common_mistakes: Array<{
    detected: string;
    correct: string;
    count: number;
  }>;
  typical_range?: {
    min: number;
    max: number;
  };
  decimal_format?: 'comma' | 'point';
  confidence: number;
}

interface VendorLearningData {
  id: string;
  user_id: string;
  vendor_id: string;
  field_patterns: Json | null;
  total_corrections: number | null;
  successful_predictions: number | null;
}

// Helper to safely parse field patterns from JSON
function parseFieldPatterns(json: Json | null): Record<string, FieldPattern> {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return {};
  }
  return json as unknown as Record<string, FieldPattern>;
}

// Pattern analysis and update
async function updateFieldPatterns(
  learning: VendorLearningData,
  fieldName: string,
  detectedValue: unknown,
  correctedValue: unknown
): Promise<void> {
  const patterns: Record<string, FieldPattern> = parseFieldPatterns(learning.field_patterns);
  
  const fieldPatterns: FieldPattern = patterns[fieldName] || {
    prefixes: [],
    suffixes: [],
    regex_patterns: [],
    common_mistakes: [],
    confidence: 50
  };
  
  const detected = String(detectedValue || '');
  const corrected = String(correctedValue || '');
  
  // 1. Detect prefix (e.g., "1036" → "RE-1036" = prefix "RE-")
  if (corrected.length > detected.length && corrected.endsWith(detected)) {
    const prefix = corrected.slice(0, corrected.length - detected.length);
    if (prefix && prefix.length <= 10 && !fieldPatterns.prefixes.includes(prefix)) {
      fieldPatterns.prefixes.push(prefix);
    }
  }
  
  // 2. Detect prefix (alternative: detected is part of corrected)
  if (detected && corrected.includes(detected)) {
    const prefixIndex = corrected.indexOf(detected);
    if (prefixIndex > 0) {
      const prefix = corrected.substring(0, prefixIndex);
      if (prefix.length <= 10 && !fieldPatterns.prefixes.includes(prefix)) {
        fieldPatterns.prefixes.push(prefix);
      }
    }
  }
  
  // 3. Detect suffix
  if (corrected.length > detected.length && corrected.startsWith(detected)) {
    const suffix = corrected.slice(detected.length);
    if (suffix && suffix.length <= 10 && !fieldPatterns.suffixes.includes(suffix)) {
      fieldPatterns.suffixes.push(suffix);
    }
  }
  
  // 4. Store common mistakes
  const existingMistakeIndex = fieldPatterns.common_mistakes.findIndex(
    m => m.detected === detected
  );
  
  if (existingMistakeIndex >= 0) {
    fieldPatterns.common_mistakes[existingMistakeIndex].count += 1;
    fieldPatterns.common_mistakes[existingMistakeIndex].correct = corrected;
  } else {
    fieldPatterns.common_mistakes.push({
      detected,
      correct: corrected,
      count: 1
    });
  }
  
  // 5. Keep only the 15 most frequent mistakes, sorted by frequency
  fieldPatterns.common_mistakes = fieldPatterns.common_mistakes
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
  
  // 6. For amounts: Learn typical range
  if (['amount_gross', 'amount_net', 'vat_amount'].includes(fieldName)) {
    const amount = parseFloat(corrected.replace(',', '.').replace(/[^\\d.-]/g, ''));
    if (!isNaN(amount) && amount > 0) {
      if (!fieldPatterns.typical_range) {
        fieldPatterns.typical_range = { min: amount, max: amount };
      } else {
        fieldPatterns.typical_range.min = Math.min(fieldPatterns.typical_range.min, amount);
        fieldPatterns.typical_range.max = Math.max(fieldPatterns.typical_range.max, amount);
      }
    }
  }
  
  // 7. Increase confidence (max 95%)
  fieldPatterns.confidence = Math.min(95, (fieldPatterns.confidence || 50) + 3);
  
  // 8. Save
  patterns[fieldName] = fieldPatterns;
  
  await supabase
    .from('vendor_learning')
    .update({
      field_patterns: patterns as unknown as Json,
      total_corrections: (learning.total_corrections || 0) + 1,
      last_correction_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', learning.id);
}

// Update learning level based on correction count
async function updateLearningLevel(learningId: string, vendorId: string): Promise<void> {
  // Count corrections
  const { count } = await supabase
    .from('field_corrections')
    .select('*', { count: 'exact', head: true })
    .eq('vendor_learning_id', learningId);
  
  const correctionCount = count || 0;
  
  // Determine level
  let newLevel = 0;
  let confidenceBoost = 0;
  
  if (correctionCount >= 10) {
    newLevel = 3;  // Reliable
    confidenceBoost = 15;
  } else if (correctionCount >= 5) {
    newLevel = 2;  // Trained
    confidenceBoost = 10;
  } else if (correctionCount >= 2) {
    newLevel = 1;  // Learning
    confidenceBoost = 5;
  }
  
  // Update vendor learning
  await supabase
    .from('vendor_learning')
    .update({
      learning_level: newLevel,
      confidence_boost: confidenceBoost
    })
    .eq('id', learningId);
  
  // Update vendor
  await supabase
    .from('vendors')
    .update({
      learning_level: newLevel,
      correction_count: correctionCount
    })
    .eq('id', vendorId);
}

export function useCorrectionTracking() {
  const { user } = useAuth();
  
  // Track a single correction and learn patterns
  const trackCorrection = useCallback(async (correction: CorrectionData): Promise<void> => {
    if (!user) return;
    
    const { fieldName, detectedValue, correctedValue, receiptId, vendorId } = correction;
    
    // No correction if values are equal
    if (String(detectedValue || '') === String(correctedValue || '')) return;
    
    try {
      // 1. Get or create vendor learning record
      let { data: learning } = await supabase
        .from('vendor_learning')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('user_id', user.id)
        .single();
      
      if (!learning) {
        const { data: newLearning, error } = await supabase
          .from('vendor_learning')
          .insert({
            user_id: user.id,
            vendor_id: vendorId
          })
          .select()
          .single();
        
        if (error) throw error;
        learning = newLearning;
      }
      
      if (!learning) return;
      
      // 2. Save correction
      await supabase
        .from('field_corrections')
        .insert({
          user_id: user.id,
          vendor_learning_id: learning.id,
          receipt_id: receiptId,
          field_name: fieldName,
          detected_value: String(detectedValue || ''),
          corrected_value: String(correctedValue || '')
        });
      
      // 3. Update patterns
      await updateFieldPatterns(
        learning as VendorLearningData, 
        fieldName, 
        detectedValue, 
        correctedValue
      );
      
      // 3b. Special handling for category corrections
      if (fieldName === 'category' && correctedValue) {
        try {
          // Update vendor's default_category_id
          const { data: matchedCategory } = await supabase
            .from('categories')
            .select('id')
            .eq('name', String(correctedValue))
            .limit(1)
            .maybeSingle();
          
          if (matchedCategory) {
            await supabase
              .from('vendors')
              .update({ default_category_id: matchedCategory.id })
              .eq('id', vendorId);
          }

          // Extract keywords from description + line items for product-level learning
          if (receiptId) {
            const keywords = await extractReceiptKeywords(receiptId);
              
            for (const keyword of keywords) {
              // Upsert: if keyword exists, update category_name and increment match_count
              const { data: existing } = await supabase
                .from('category_rules')
                .select('id, match_count')
                .eq('user_id', user.id)
                .eq('keyword', keyword)
                .maybeSingle();
              
              if (existing) {
                await supabase
                  .from('category_rules')
                  .update({
                    category_name: String(correctedValue),
                    match_count: (existing.match_count || 1) + 1,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', existing.id);
              } else {
                await supabase
                  .from('category_rules')
                  .insert({
                    user_id: user.id,
                    keyword,
                    category_name: String(correctedValue),
                    match_count: 1,
                    source: 'correction',
                  });
              }
            }
          }
        } catch (categoryError) {
          console.error('Error tracking category correction:', categoryError);
        }
      }

      // 3b2. Special handling for tax_type (Buchungsart) corrections
      if (fieldName === 'tax_type' && correctedValue && receiptId) {
        try {
          const keywords = await extractReceiptKeywords(receiptId);
          
          for (const keyword of keywords) {
            const { data: existing } = await supabase
              .from('category_rules')
              .select('id, tax_type_match_count')
              .eq('user_id', user.id)
              .eq('keyword', keyword)
              .maybeSingle();
            
            if (existing) {
              await supabase
                .from('category_rules')
                .update({
                  tax_type_name: String(correctedValue),
                  tax_type_match_count: ((existing.tax_type_match_count as number) || 0) + 1,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);
            } else {
              await supabase
                .from('category_rules')
                .insert({
                  user_id: user.id,
                  keyword,
                  category_name: '', // required column, empty since this is tax_type only
                  tax_type_name: String(correctedValue),
                  tax_type_match_count: 1,
                  match_count: 0,
                  source: 'correction',
                });
            }
          }
        } catch (taxTypeError) {
          console.error('Error tracking tax_type correction:', taxTypeError);
        }
      }

      if (fieldName === 'vat_rate') {
        const correctedStr = String(correctedValue ?? '').replace(',', '.');
        const vatRate = correctedStr !== '' ? parseFloat(correctedStr) : 0;
        const detectedStr = String(detectedValue ?? '').replace(',', '.');
        const parsed = detectedStr !== '' ? parseFloat(detectedStr) : NaN;
        const originalVatRate = !isNaN(parsed) ? parsed : null;
        await recordVatRateCorrection(vendorId, user.id, vatRate, originalVatRate);
      }
      
      // 4. Update learning level
      await updateLearningLevel(learning.id, vendorId);

      // 5. Community Intelligence: aggregate pattern (fire-and-forget)
      if (fieldName === 'category' && correctedValue) {
        try {
          // Get vendor name and user country
          const { data: vendorData } = await supabase
            .from('vendors')
            .select('display_name')
            .eq('id', vendorId)
            .single();
          
          const { data: profileData } = await supabase
            .from('profiles')
            .select('country')
            .eq('id', user.id)
            .single();

          if (vendorData?.display_name) {
            supabase.functions.invoke('aggregate-community-pattern', {
              body: {
                user_id: user.id,
                vendor_name: vendorData.display_name,
                category: String(correctedValue),
                country: profileData?.country?.toUpperCase() || null,
                pattern_type: 'vendor_category',
              },
            }).catch(e => console.error('Community pattern aggregation failed:', e));
          }
        } catch (communityError) {
          // Silent fail - community learning is best-effort
          console.error('Community aggregation error:', communityError);
        }
      }
      
    } catch (error) {
      console.error('Error tracking correction:', error);
    }
  }, [user]);
  
  // Track multiple corrections at once
  const trackCorrections = useCallback(async (corrections: CorrectionData[]): Promise<void> => {
    for (const correction of corrections) {
      await trackCorrection(correction);
    }
  }, [trackCorrection]);
  
  // Track successful prediction (when saved without changes)
  const trackSuccessfulPrediction = useCallback(async (
    receiptId: string, 
    vendorId: string
  ): Promise<void> => {
    if (!user || !vendorId) return;
    
    try {
      const { data: learning } = await supabase
        .from('vendor_learning')
        .select('id, successful_predictions')
        .eq('vendor_id', vendorId)
        .eq('user_id', user.id)
        .single();
      
      if (learning) {
        await supabase
          .from('vendor_learning')
          .update({
            successful_predictions: (learning.successful_predictions || 0) + 1,
            last_successful_at: new Date().toISOString()
          })
          .eq('id', learning.id);
      }
    } catch (error) {
      console.error('Error tracking successful prediction:', error);
    }
  }, [user]);
  
  return { trackCorrection, trackCorrections, trackSuccessfulPrediction };
}

export type { CorrectionData };
