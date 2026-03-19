import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Customer {
  id: string;
  user_id: string;
  display_name: string;
  company_name: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  uid_number: string | null;
  customer_number: string | null;
  payment_terms_days: number | null;
  default_currency: string | null;
  notes: string | null;
  is_archived: boolean | null;
  has_different_shipping_address: boolean | null;
  shipping_street: string | null;
  shipping_zip: string | null;
  shipping_city: string | null;
  shipping_country: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type CustomerInsert = Omit<Customer, 'id' | 'created_at' | 'updated_at'>;

export function useCustomers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCustomers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', user.id)
      .order('display_name');
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      setCustomers(data as Customer[]);
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const addCustomer = async (customer: Partial<CustomerInsert>) => {
    if (!user) return null;

    // Auto-increment customer number in invoice_settings if we used a generated number
    const { data, error } = await supabase
      .from('customers')
      .insert({ ...customer, user_id: user.id, display_name: customer.display_name || '' } as any)
      .select()
      .single();
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return null;
    }

    // Increment next_customer_number (best effort)
    try {
      const { data: settings } = await supabase
        .from('invoice_settings')
        .select('id, next_customer_number')
        .eq('user_id', user.id)
        .maybeSingle();
      if (settings) {
        await supabase
          .from('invoice_settings')
          .update({ next_customer_number: (settings.next_customer_number || 1) + 1 } as any)
          .eq('id', settings.id);
      }
    } catch {}

    toast({ title: 'Kunde erstellt' });
    await fetchCustomers();
    return data as Customer;
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    const { error } = await supabase.from('customers').update(updates as any).eq('id', id);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Kunde aktualisiert' });
    await fetchCustomers();
    return true;
  };

  const deleteCustomer = async (id: string) => {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Kunde gelöscht' });
    await fetchCustomers();
    return true;
  };

  return { customers, loading, fetchCustomers, addCustomer, updateCustomer, deleteCustomer };
}
