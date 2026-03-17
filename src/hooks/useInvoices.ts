import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Customer } from '@/hooks/useCustomers';

export interface Invoice {
  id: string;
  user_id: string;
  customer_id: string;
  invoice_number: string;
  status: string | null;
  invoice_date: string | null;
  due_date: string | null;
  paid_at: string | null;
  subtotal: number | null;
  vat_total: number | null;
  total: number | null;
  currency: string | null;
  notes: string | null;
  footer_text: string | null;
  payment_reference: string | null;
  recurring_invoice_id: string | null;
  credit_note_for: string | null;
  pdf_storage_path: string | null;
  sent_at: string | null;
  sent_to_email: string | null;
  created_at: string | null;
  updated_at: string | null;
  customers?: Customer;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  invoice_item_id: string | null;
  position: number | null;
  description: string;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  vat_rate: number | null;
  line_total: number | null;
  created_at: string | null;
}

export type InvoiceInsert = {
  customer_id: string;
  invoice_number: string;
  status?: string;
  invoice_date?: string;
  due_date?: string;
  notes?: string;
  footer_text?: string;
  currency?: string;
};

export type LineItemInsert = {
  invoice_id: string;
  description: string;
  quantity?: number;
  unit?: string;
  unit_price?: number;
  vat_rate?: number;
  line_total?: number;
  position?: number;
  invoice_item_id?: string;
};

export function useInvoices() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('invoices')
      .select('*, customers(display_name, company_name, email)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      setInvoices(data as unknown as Invoice[]);
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const createInvoice = async (invoice: InvoiceInsert, lineItems: Omit<LineItemInsert, 'invoice_id'>[]) => {
    if (!user) return null;

    // Calculate totals
    let subtotal = 0;
    let vatTotal = 0;
    for (const item of lineItems) {
      const lineNet = (item.quantity || 1) * (item.unit_price || 0);
      subtotal += lineNet;
      vatTotal += lineNet * ((item.vat_rate || 0) / 100);
    }
    const total = subtotal + vatTotal;

    const { data: inv, error: invError } = await supabase
      .from('invoices')
      .insert({
        ...invoice,
        user_id: user.id,
        subtotal,
        vat_total: vatTotal,
        total,
      } as any)
      .select()
      .single();

    if (invError || !inv) {
      toast({ title: 'Fehler', description: invError?.message || 'Rechnung konnte nicht erstellt werden', variant: 'destructive' });
      return null;
    }

    const typedInv = inv as unknown as Invoice;

    if (lineItems.length > 0) {
      const rows = lineItems.map((li, idx) => ({
        invoice_id: typedInv.id,
        description: li.description,
        quantity: li.quantity || 1,
        unit: li.unit || 'Stk',
        unit_price: li.unit_price || 0,
        vat_rate: li.vat_rate ?? 20,
        line_total: (li.quantity || 1) * (li.unit_price || 0),
        position: idx + 1,
        invoice_item_id: li.invoice_item_id || null,
      }));

      const { error: liError } = await supabase
        .from('invoice_line_items')
        .insert(rows as any);

      if (liError) {
        toast({ title: 'Fehler bei Positionen', description: liError.message, variant: 'destructive' });
      }
    }

    // Increment sequence number
    await supabase.rpc('increment_invoice_sequence' as any, { p_user_id: user.id }).catch(() => {
      // If RPC doesn't exist yet, update manually
      supabase
        .from('invoice_settings')
        .update({ next_sequence_number: undefined } as any)
        .eq('user_id', user.id);
    });

    toast({ title: 'Rechnung erstellt' });
    await fetchInvoices();
    return typedInv;
  };

  const updateInvoiceStatus = async (id: string, status: string, extra?: Record<string, any>) => {
    const updates: any = { status, ...extra };
    if (status === 'paid') updates.paid_at = new Date().toISOString();
    if (status === 'sent') updates.sent_at = new Date().toISOString();

    const { error } = await supabase.from('invoices').update(updates).eq('id', id);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Status aktualisiert' });
    await fetchInvoices();
    return true;
  };

  const deleteInvoice = async (id: string) => {
    // Delete line items first
    await supabase.from('invoice_line_items').delete().eq('invoice_id', id);
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Rechnung gelöscht' });
    await fetchInvoices();
    return true;
  };

  const fetchLineItems = async (invoiceId: string): Promise<InvoiceLineItem[]> => {
    const { data, error } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('position');
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return [];
    }
    return data as unknown as InvoiceLineItem[];
  };

  return {
    invoices,
    loading,
    fetchInvoices,
    createInvoice,
    updateInvoiceStatus,
    deleteInvoice,
    fetchLineItems,
  };
}
