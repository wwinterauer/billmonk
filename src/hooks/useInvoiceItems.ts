import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface InvoiceItem {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  unit: string | null;
  unit_price: number | null;
  vat_rate: number | null;
  is_active: boolean | null;
  sort_order: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export function useInvoiceItems() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true });
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      setItems(data as InvoiceItem[]);
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const addItem = async (item: Partial<InvoiceItem>) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('invoice_items')
      .insert({ ...item, user_id: user.id, name: item.name || '' } as any)
      .select()
      .single();
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return null;
    }
    toast({ title: 'Artikel erstellt' });
    await fetchItems();
    return data as InvoiceItem;
  };

  const updateItem = async (id: string, updates: Partial<InvoiceItem>) => {
    const { error } = await supabase.from('invoice_items').update(updates as any).eq('id', id);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Artikel aktualisiert' });
    await fetchItems();
    return true;
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from('invoice_items').delete().eq('id', id);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Artikel gelöscht' });
    await fetchItems();
    return true;
  };

  return { items, loading, fetchItems, addItem, updateItem, deleteItem };
}
