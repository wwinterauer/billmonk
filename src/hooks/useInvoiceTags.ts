import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useInvoiceTags() {
  const fetchTagsForInvoice = useCallback(async (invoiceId: string) => {
    const { data, error } = await supabase
      .from('invoice_tags' as any)
      .select('tag_id, tags:tag_id(id, name, color)')
      .eq('invoice_id', invoiceId);
    if (error) {
      console.error('Error fetching invoice tags:', error);
      return [];
    }
    return (data || []).map((rt: any) => rt.tags).filter(Boolean) as Array<{ id: string; name: string; color: string }>;
  }, []);

  const assignTag = useCallback(async (invoiceId: string, tagId: string) => {
    const { error } = await supabase
      .from('invoice_tags' as any)
      .insert({ invoice_id: invoiceId, tag_id: tagId });
    if (error && !error.message.includes('duplicate')) {
      console.error('Error assigning invoice tag:', error);
      throw error;
    }
  }, []);

  const removeTag = useCallback(async (invoiceId: string, tagId: string) => {
    const { error } = await supabase
      .from('invoice_tags' as any)
      .delete()
      .eq('invoice_id', invoiceId)
      .eq('tag_id', tagId);
    if (error) {
      console.error('Error removing invoice tag:', error);
      throw error;
    }
  }, []);

  return { fetchTagsForInvoice, assignTag, removeTag };
}
