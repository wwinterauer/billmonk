import { supabase } from '@/integrations/supabase/client';
import type { VendorLearning } from '@/types/learning';

export async function getVendorLearning(
  vendorId: string, 
  userId: string
): Promise<VendorLearning | null> {
  const { data, error } = await supabase
    .from('vendor_learning')
    .select('*')
    .eq('vendor_id', vendorId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();
  
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
    field_patterns: (data.field_patterns as Record<string, unknown>) ?? {},
    layout_hints: (data.layout_hints as Record<string, unknown>) ?? {},
    last_correction_at: data.last_correction_at,
    last_successful_at: data.last_successful_at,
    created_at: data.created_at ?? '',
    updated_at: data.updated_at ?? ''
  } as VendorLearning;
}

export async function getVendorLearningByReceipt(
  receiptId: string,
  userId: string
): Promise<VendorLearning | null> {
  // First load receipt to get vendor_id
  const { data: receipt } = await supabase
    .from('receipts')
    .select('vendor_id')
    .eq('id', receiptId)
    .single();
  
  if (!receipt?.vendor_id) return null;
  
  return getVendorLearning(receipt.vendor_id, userId);
}

export async function getVendorLearningStats(
  userId: string
): Promise<{
  totalVendors: number;
  learningVendors: number;
  trainedVendors: number;
  reliableVendors: number;
  totalCorrections: number;
}> {
  const { data: learnings } = await supabase
    .from('vendor_learning')
    .select('learning_level, total_corrections')
    .eq('user_id', userId)
    .eq('is_active', true);
  
  if (!learnings) {
    return {
      totalVendors: 0,
      learningVendors: 0,
      trainedVendors: 0,
      reliableVendors: 0,
      totalCorrections: 0
    };
  }
  
  return {
    totalVendors: learnings.length,
    learningVendors: learnings.filter(l => l.learning_level === 1).length,
    trainedVendors: learnings.filter(l => l.learning_level === 2).length,
    reliableVendors: learnings.filter(l => l.learning_level === 3).length,
    totalCorrections: learnings.reduce((sum, l) => sum + (l.total_corrections || 0), 0)
  };
}
