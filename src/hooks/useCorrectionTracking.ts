import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCallback } from 'react';
import type { Json } from '@/integrations/supabase/types';

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
      
      // 4. Update learning level
      await updateLearningLevel(learning.id, vendorId);
      
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
