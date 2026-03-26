import { supabase } from '@/integrations/supabase/client';

export interface VatLearningData {
  default_vat_rate: number | null;
  vat_rate_confidence: number;
  vat_rate_corrections: number;
  common_rates: Array<{ rate: number; frequency: number }>;
}

/**
 * Record a VAT rate correction for a vendor
 */
export async function recordVatRateCorrection(
  vendorId: string,
  userId: string,
  correctedRate: number,
  originalRate: number | null
): Promise<void> {
  try {
    // Find or create vendor_learning entry
    let { data: learning, error: fetchError } = await supabase
      .from('vendor_learning')
      .select('id, default_vat_rate, vat_rate_confidence, vat_rate_corrections')
      .eq('vendor_id', vendorId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching vendor learning:', fetchError);
      return;
    }

    // Create new learning entry if not exists
    if (!learning) {
      const { data: newLearning, error: insertError } = await supabase
        .from('vendor_learning')
        .insert({
          vendor_id: vendorId,
          user_id: userId,
          is_active: true,
          default_vat_rate: correctedRate,
          vat_rate_confidence: 50,
          vat_rate_corrections: 1,
          learning_level: 1,
          total_corrections: 1,
        })
        .select('id')
        .single();

      if (insertError || !newLearning) {
        console.error('Error creating vendor learning:', insertError);
        return;
      }

      learning = {
        id: newLearning.id,
        default_vat_rate: correctedRate,
        vat_rate_confidence: 50,
        vat_rate_corrections: 1,
      };

      // Add to vendor_vat_rates tracking
      await supabase
        .from('vendor_vat_rates')
        .insert({
          vendor_learning_id: newLearning.id,
          user_id: userId,
          vat_rate: correctedRate,
          frequency: 1,
        });

      return;
    }

    // Update existing learning entry
    const isSameRate = learning.default_vat_rate === correctedRate;
    const currentCorrections = learning.vat_rate_corrections ?? 0;
    const currentConfidence = learning.vat_rate_confidence ?? 0;

    // If same rate, increase confidence; if different, recalculate
    const newConfidence = isSameRate
      ? Math.min(100, currentConfidence + 10)
      : Math.max(50, currentConfidence - 20); // Reduce confidence when rate changes

    const { error: updateError } = await supabase
      .from('vendor_learning')
      .update({
        default_vat_rate: correctedRate,
        vat_rate_corrections: currentCorrections + 1,
        vat_rate_confidence: newConfidence,
        last_correction_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', learning.id);

    if (updateError) {
      console.error('Error updating vendor learning:', updateError);
      return;
    }

    // Track in vendor_vat_rates (for vendors with multiple common rates)
    const { data: existingRate } = await supabase
      .from('vendor_vat_rates')
      .select('id, frequency')
      .eq('vendor_learning_id', learning.id)
      .eq('vat_rate', correctedRate)
      .maybeSingle();

    if (existingRate) {
      // Increment frequency
      await supabase
        .from('vendor_vat_rates')
        .update({
          frequency: existingRate.frequency + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', existingRate.id);
    } else {
      // Insert new rate
      await supabase
        .from('vendor_vat_rates')
        .insert({
          vendor_learning_id: learning.id,
          user_id: userId,
          vat_rate: correctedRate,
          frequency: 1,
        });
    }

  } catch (error) {
    console.error('Error in recordVatRateCorrection:', error);
  }
}

/**
 * Get learned VAT rate for a vendor
 */
export async function getLearnedVatRate(
  vendorId: string,
  userId: string
): Promise<VatLearningData | null> {
  try {
    const { data: learning, error } = await supabase
      .from('vendor_learning')
      .select('id, default_vat_rate, vat_rate_confidence, vat_rate_corrections')
      .eq('vendor_id', vendorId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !learning) return null;

    // Get common rates for this vendor
    const { data: rates } = await supabase
      .from('vendor_vat_rates')
      .select('vat_rate, frequency')
      .eq('vendor_learning_id', learning.id)
      .order('frequency', { ascending: false })
      .limit(5);

    return {
      default_vat_rate: learning.default_vat_rate,
      vat_rate_confidence: learning.vat_rate_confidence ?? 0,
      vat_rate_corrections: learning.vat_rate_corrections ?? 0,
      common_rates: (rates || []).map(r => ({
        rate: Number(r.vat_rate),
        frequency: r.frequency,
      })),
    };
  } catch (error) {
    console.error('Error getting learned VAT rate:', error);
    return null;
  }
}

/**
 * Check if we should use learned VAT rate (confidence threshold)
 */
export function shouldUseLearnedVatRate(learning: VatLearningData | null): boolean {
  if (!learning) return false;
  if (learning.default_vat_rate === null) return false;
  // Use learned rate if confidence >= 70% OR at least 3 corrections
  return learning.vat_rate_confidence >= 70 || learning.vat_rate_corrections >= 3;
}
