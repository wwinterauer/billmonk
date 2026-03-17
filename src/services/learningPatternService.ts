import { supabase } from '@/integrations/supabase/client';
import type { VendorLearning, FieldPattern } from '@/types/learning';
import type { ExtractionResult } from './aiService';

interface EnhancedExtractionResult extends ExtractionResult {
  learning_applied?: boolean;
  _warnings?: Array<{ field: string; message: string }>;
}

/**
 * Load vendor learning data for pattern application
 */
export async function getVendorLearningForExtraction(
  vendorId: string,
  userId: string
): Promise<VendorLearning | null> {
  try {
    const { data, error } = await supabase
      .from('vendor_learning')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      user_id: data.user_id,
      vendor_id: data.vendor_id,
      is_active: data.is_active ?? true,
      learning_level: data.learning_level ?? 0,
      total_corrections: data.total_corrections ?? 0,
      successful_predictions: data.successful_predictions ?? 0,
      confidence_boost: data.confidence_boost ?? 0,
      field_patterns: (data.field_patterns as unknown as Record<string, FieldPattern>) ?? {},
      layout_hints: (data.layout_hints as unknown as Record<string, unknown>) ?? {},
      last_correction_at: data.last_correction_at,
      last_successful_at: data.last_successful_at,
      created_at: data.created_at ?? '',
      updated_at: data.updated_at ?? '',
    } as VendorLearning;
  } catch (error) {
    console.error('Error loading vendor learning:', error);
    return null;
  }
}

/**
 * Apply learned patterns to extraction result
 */
export function applyLearnedPatterns(
  extraction: ExtractionResult,
  learning: VendorLearning
): EnhancedExtractionResult {
  // Use a mutable object for dynamic field updates
  const enhanced: EnhancedExtractionResult & { [key: string]: unknown } = { ...extraction };
  const patterns = (learning.field_patterns || {}) as Record<string, FieldPattern>;
  const warnings: Array<{ field: string; message: string }> = [];

  for (const [fieldName, fieldPatterns] of Object.entries(patterns)) {
    const currentValue = enhanced[fieldName];
    
    if (currentValue === undefined || currentValue === null) continue;

    // 1. Check for known mistakes
    const mistake = fieldPatterns.common_mistakes?.find(
      m => m.detected === String(currentValue) && m.count >= 2
    );

    if (mistake) {
      const correctedValue = parseFieldValue(fieldName, mistake.correct);
      enhanced[fieldName] = correctedValue;
      console.log(`[Learning] Applied mistake correction for ${fieldName}: "${currentValue}" → "${correctedValue}"`);
      continue;
    }

    // 2. Add missing prefix if commonly required
    if (fieldPatterns.prefixes?.length > 0 && typeof currentValue === 'string') {
      const value = String(currentValue);
      const hasPrefix = fieldPatterns.prefixes.some(p => value.startsWith(p));

      if (!hasPrefix && value.length > 0) {
        const mostCommonPrefix = findMostCommonPrefix(fieldPatterns, value);
        if (mostCommonPrefix) {
          enhanced[fieldName] = mostCommonPrefix + value;
          console.log(`[Learning] Applied prefix for ${fieldName}: "${value}" → "${mostCommonPrefix}${value}"`);
        }
      }
    }

    // 3. Add missing suffix if commonly required
    if (fieldPatterns.suffixes?.length > 0 && typeof enhanced[fieldName] === 'string') {
      const value = String(enhanced[fieldName]);
      const hasSuffix = fieldPatterns.suffixes.some(s => value.endsWith(s));

      if (!hasSuffix && value.length > 0) {
        const mostCommonSuffix = fieldPatterns.suffixes[0];
        enhanced[fieldName] = value + mostCommonSuffix;
        console.log(`[Learning] Applied suffix for ${fieldName}: "${value}" → "${value}${mostCommonSuffix}"`);
      }
    }

    // 4. Check amount plausibility
    if (fieldName === 'amount_gross' && fieldPatterns.typical_range) {
      const amount = typeof currentValue === 'number' ? currentValue : parseFloat(String(currentValue));
      const { min, max } = fieldPatterns.typical_range;

      if (!isNaN(amount) && amount > 0) {
        if (amount < min * 0.1 || amount > max * 10) {
          warnings.push({
            field: fieldName,
            message: `Betrag €${amount.toFixed(2)} liegt außerhalb des typischen Bereichs (€${min.toFixed(2)} - €${max.toFixed(2)})`
          });
        }
      }
    }
  }

  if (warnings.length > 0) {
    enhanced._warnings = warnings;
  }

  return enhanced;
}

/**
 * Find the most common prefix for a value based on learned patterns
 */
function findMostCommonPrefix(
  fieldPatterns: FieldPattern,
  value: string
): string | null {
  if (!fieldPatterns.common_mistakes || fieldPatterns.common_mistakes.length === 0) {
    return fieldPatterns.prefixes?.[0] || null;
  }

  // Check if a mistake entry matches and extract prefix
  for (const mistake of fieldPatterns.common_mistakes) {
    if (mistake.detected === value && mistake.correct.includes(value)) {
      const prefixIndex = mistake.correct.indexOf(value);
      if (prefixIndex > 0) {
        const prefix = mistake.correct.substring(0, prefixIndex);
        if (prefix) return prefix;
      }
    }
  }

  return fieldPatterns.prefixes?.[0] || null;
}

/**
 * Parse field value to correct type
 */
function parseFieldValue(fieldName: string, value: string): unknown {
  switch (fieldName) {
    case 'amount_gross':
    case 'amount_net':
    case 'vat_amount': {
      const numStr = value.replace(/[^\d,.-]/g, '').replace(',', '.');
      return parseFloat(numStr) || 0;
    }

    case 'vat_rate': {
      const rateStr = value.replace(/[^\d,.-]/g, '').replace(',', '.');
      return parseFloat(rateStr) || 0;
    }

    case 'receipt_date': {
      // Parse date to YYYY-MM-DD format
      const dateMatch = value.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
      if (dateMatch) {
        const [, day, month, year] = dateMatch;
        const fullYear = year.length === 2 ? `20${year}` : year;
        return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      return value;
    }

    default:
      return value;
  }
}

/**
 * Extract receipt data with learning patterns applied
 */
export async function extractReceiptDataWithLearning(
  baseExtraction: ExtractionResult,
  userId: string,
  vendorId?: string | null
): Promise<EnhancedExtractionResult> {
  // If no vendor ID, return base extraction
  if (!vendorId) {
    return baseExtraction;
  }

  // Load vendor learning data
  const learning = await getVendorLearningForExtraction(vendorId, userId);

  // If no learning data or level is 0 (new), return base extraction
  if (!learning || learning.learning_level === 0) {
    return baseExtraction;
  }

  // Apply learned patterns
  const enhancedExtraction = applyLearnedPatterns(baseExtraction, learning);

  // Boost confidence based on learning level
  const baseConfidence = baseExtraction.confidence || 0.7;
  const boostedConfidence = Math.min(1, baseConfidence + (learning.confidence_boost / 100));

  return {
    ...enhancedExtraction,
    confidence: boostedConfidence,
    learning_applied: true
  };
}

/**
 * Try to find vendor ID by matching vendor name
 */
export async function findVendorIdByName(
  vendorName: string,
  userId: string
): Promise<string | null> {
  if (!vendorName) return null;

  try {
    // First try exact match on display_name
    const { data: exactMatch } = await supabase
      .from('vendors')
      .select('id')
      .eq('user_id', userId)
      .ilike('display_name', vendorName)
      .maybeSingle();

    if (exactMatch) return exactMatch.id;

    // Try match on legal_names array
    const { data: allVendorsForLegal } = await supabase
      .from('vendors')
      .select('id, legal_names')
      .eq('user_id', userId);

    if (allVendorsForLegal) {
      for (const v of allVendorsForLegal) {
        if ((v.legal_names || []).some((ln: string) => ln.toLowerCase() === vendorName.toLowerCase())) {
          return v.id;
        }
      }
    }

    // Try partial match on detected_names array
    const { data: allVendors } = await supabase
      .from('vendors')
      .select('id, detected_names')
      .eq('user_id', userId);

    if (allVendors) {
      for (const vendor of allVendors) {
        const detectedNames = vendor.detected_names || [];
        const normalizedSearch = vendorName.toLowerCase().trim();
        
        for (const name of detectedNames) {
          if (name.toLowerCase().trim() === normalizedSearch) {
            return vendor.id;
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding vendor by name:', error);
    return null;
  }
}
