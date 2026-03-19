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
  // New fields
  document_type?: string | null;
  version?: string | null;
  parent_invoice_id?: string | null;
  copied_from_id?: string | null;
  discount_percent?: number | null;
  discount_days?: number | null;
  discount_amount?: number | null;
  shipping_address_mode?: string | null;
  shipping_street?: string | null;
  shipping_zip?: string | null;
  shipping_city?: string | null;
  shipping_country?: string | null;
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
  group_name?: string | null;
  is_group_header?: boolean | null;
  show_group_subtotal?: boolean | null;
  image_path?: string | null;
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
  category?: string;
  document_type?: string;
  discount_percent?: number;
  discount_days?: number;
  discount_amount?: number;
  shipping_address_mode?: string;
  shipping_street?: string;
  shipping_zip?: string;
  shipping_city?: string;
  shipping_country?: string;
  copied_from_id?: string;
  parent_invoice_id?: string;
  version?: string;
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
  group_name?: string;
  is_group_header?: boolean;
  show_group_subtotal?: boolean;
  image_path?: string;
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

    let subtotal = 0;
    let vatTotal = 0;
    for (const item of lineItems) {
      if (item.is_group_header) continue;
      const lineNet = (item.quantity || 1) * (item.unit_price || 0);
      subtotal += lineNet;
      vatTotal += lineNet * ((item.vat_rate || 0) / 100);
    }
    const total = subtotal + vatTotal;

    // Calculate discount
    const discountAmount = invoice.discount_percent
      ? total * (invoice.discount_percent / 100)
      : 0;

    const { data: inv, error: invError } = await supabase
      .from('invoices')
      .insert({
        ...invoice,
        user_id: user.id,
        subtotal,
        vat_total: vatTotal,
        total,
        discount_amount: discountAmount,
      } as any)
      .select()
      .single();

    if (invError || !inv) {
      toast({ title: 'Fehler', description: invError?.message || 'Dokument konnte nicht erstellt werden', variant: 'destructive' });
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
        line_total: li.is_group_header ? 0 : (li.quantity || 1) * (li.unit_price || 0),
        position: idx + 1,
        invoice_item_id: li.invoice_item_id || null,
        group_name: li.group_name || null,
        is_group_header: li.is_group_header || false,
        show_group_subtotal: li.show_group_subtotal || false,
        image_path: li.image_path || null,
      }));

      const { error: liError } = await supabase
        .from('invoice_line_items')
        .insert(rows as any);

      if (liError) {
        toast({ title: 'Fehler bei Positionen', description: liError.message, variant: 'destructive' });
      }
    }

    // Increment sequence number (best effort)
    try {
      const docType = invoice.document_type || 'invoice';
      if (docType === 'invoice') {
        const { data: currentSettings } = await supabase
          .from('invoice_settings')
          .select('id, next_sequence_number')
          .eq('user_id', user.id)
          .maybeSingle();
        if (currentSettings) {
          await supabase
            .from('invoice_settings')
            .update({ next_sequence_number: (currentSettings.next_sequence_number || 1) + 1 } as any)
            .eq('id', currentSettings.id);
        }
      }
    } catch {}

    const docLabel = (invoice.document_type === 'quote') ? 'Angebot' : (invoice.document_type === 'order_confirmation') ? 'Auftragsbestätigung' : 'Rechnung';
    toast({ title: `${docLabel} erstellt` });
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
    await supabase.from('invoice_line_items').delete().eq('invoice_id', id);
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Gelöscht' });
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

  const copyInvoice = async (sourceId: string, overrides?: Partial<InvoiceInsert>) => {
    if (!user) return null;

    // Fetch source
    const { data: source } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', sourceId)
      .single();
    if (!source) { toast({ title: 'Fehler', description: 'Originalrechnung nicht gefunden', variant: 'destructive' }); return null; }

    const lineItems = await fetchLineItems(sourceId);

    // Generate new number
    const { data: settings } = await supabase
      .from('invoice_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const prefix = settings?.invoice_number_prefix || 'RE';
    const seq = settings?.next_sequence_number || 1;
    const year = new Date().getFullYear();
    const newNumber = (settings?.invoice_number_format || '{prefix}-{year}-{seq}')
      .replace('{prefix}', prefix)
      .replace('{year}', String(year))
      .replace('{seq}', String(seq).padStart(4, '0'));

    const s = source as any;
    return createInvoice(
      {
        customer_id: s.customer_id,
        invoice_number: newNumber,
        status: 'draft',
        invoice_date: new Date().toISOString().split('T')[0],
        notes: s.notes || undefined,
        footer_text: s.footer_text || undefined,
        category: s.category || undefined,
        document_type: s.document_type || 'invoice',
        discount_percent: s.discount_percent || 0,
        discount_days: s.discount_days || 0,
        copied_from_id: sourceId,
        ...overrides,
      },
      lineItems.map(li => ({
        description: li.description,
        quantity: li.quantity || 1,
        unit: li.unit || 'Stk',
        unit_price: li.unit_price || 0,
        vat_rate: li.vat_rate ?? 20,
        invoice_item_id: li.invoice_item_id || undefined,
        group_name: li.group_name || undefined,
        is_group_header: li.is_group_header || false,
        show_group_subtotal: li.show_group_subtotal || false,
      }))
    );
  };

  const createCorrectionVersion = async (sourceId: string) => {
    if (!user) return null;

    // Count existing versions
    const { count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('parent_invoice_id', sourceId);

    const versionIndex = (count || 0);
    const versionSuffix = `-${String.fromCharCode(65 + versionIndex)}`; // -A, -B, -C...

    const { data: source } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', sourceId)
      .single();
    if (!source) return null;

    const s = source as any;

    // Mark original as corrected
    await supabase.from('invoices').update({ status: 'corrected' } as any).eq('id', sourceId);

    const lineItems = await fetchLineItems(sourceId);

    return createInvoice(
      {
        customer_id: s.customer_id,
        invoice_number: `${s.invoice_number}${versionSuffix}`,
        status: 'draft',
        invoice_date: new Date().toISOString().split('T')[0],
        notes: s.notes || undefined,
        footer_text: s.footer_text || undefined,
        category: s.category || undefined,
        document_type: s.document_type || 'invoice',
        discount_percent: s.discount_percent || 0,
        discount_days: s.discount_days || 0,
        parent_invoice_id: sourceId,
        version: versionSuffix,
      },
      lineItems.map(li => ({
        description: li.description,
        quantity: li.quantity || 1,
        unit: li.unit || 'Stk',
        unit_price: li.unit_price || 0,
        vat_rate: li.vat_rate ?? 20,
        invoice_item_id: li.invoice_item_id || undefined,
        group_name: li.group_name || undefined,
        is_group_header: li.is_group_header || false,
        show_group_subtotal: li.show_group_subtotal || false,
      }))
    );
  };

  const convertDocument = async (sourceId: string, targetType: 'order_confirmation' | 'invoice') => {
    if (!user) return null;

    const prefixMap: Record<string, string> = {
      quote: 'AN',
      order_confirmation: 'AB',
      invoice: 'RE',
    };

    // Get settings for number generation
    const { data: settings } = await supabase
      .from('invoice_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const prefix = prefixMap[targetType] || 'RE';
    const seq = settings?.next_sequence_number || 1;
    const year = new Date().getFullYear();
    const newNumber = `${prefix}-${year}-${String(seq).padStart(4, '0')}`;

    const result = await copyInvoice(sourceId, {
      document_type: targetType,
      invoice_number: newNumber,
    });

    if (result) {
      const label = targetType === 'order_confirmation' ? 'Auftragsbestätigung' : 'Rechnung';
      toast({ title: `${label} erstellt`, description: `Aus dem Originaldokument umgewandelt.` });
    }
    return result;
  };

  return {
    invoices,
    loading,
    fetchInvoices,
    createInvoice,
    updateInvoiceStatus,
    deleteInvoice,
    fetchLineItems,
    copyInvoice,
    createCorrectionVersion,
    convertDocument,
  };
}
