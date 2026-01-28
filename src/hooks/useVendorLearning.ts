import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { VendorLearning, FieldPattern, LayoutHint } from '@/types/learning';
import type { Json } from '@/integrations/supabase/types';

// Helper to safely convert JSON to VendorLearning type
function parseVendorLearning(data: {
  id: string;
  user_id: string;
  vendor_id: string;
  is_active: boolean | null;
  learning_level: number | null;
  total_corrections: number | null;
  successful_predictions: number | null;
  confidence_boost: number | null;
  field_patterns: Json | null;
  layout_hints: Json | null;
  last_correction_at: string | null;
  last_successful_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}): VendorLearning {
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
    layout_hints: (data.layout_hints as unknown as Record<string, LayoutHint>) ?? {},
    last_correction_at: data.last_correction_at,
    last_successful_at: data.last_successful_at,
    created_at: data.created_at ?? '',
    updated_at: data.updated_at ?? '',
    // VAT learning fields
    default_vat_rate: (data as any).default_vat_rate ?? null,
    vat_rate_confidence: (data as any).vat_rate_confidence ?? 0,
    vat_rate_corrections: (data as any).vat_rate_corrections ?? 0,
  };
}

export function useVendorLearning(vendorId: string | null) {
  const { user } = useAuth();
  const [vendorLearning, setVendorLearning] = useState<VendorLearning | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchLearning() {
      if (!vendorId || !user) {
        setVendorLearning(null);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('vendor_learning')
          .select('*')
          .eq('vendor_id', vendorId)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (error) {
          console.error('Error fetching vendor learning:', error);
          setVendorLearning(null);
        } else if (data) {
          setVendorLearning(parseVendorLearning(data));
        } else {
          setVendorLearning(null);
        }
      } catch (err) {
        console.error('Error in useVendorLearning:', err);
        setVendorLearning(null);
      } finally {
        setLoading(false);
      }
    }

    fetchLearning();
  }, [vendorId, user]);

  return { vendorLearning, loading };
}
