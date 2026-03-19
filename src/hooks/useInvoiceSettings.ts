import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface InvoiceSettings {
  id: string;
  user_id: string;
  invoice_number_prefix: string | null;
  invoice_number_format: string | null;
  next_sequence_number: number | null;
  default_payment_terms_days: number | null;
  default_footer_text: string | null;
  default_notes: string | null;
  company_logo_path: string | null;
  bank_name: string | null;
  iban: string | null;
  bic: string | null;
  auto_send_enabled: boolean | null;
  send_copy_to_self: boolean | null;
  overdue_reminder_enabled: boolean | null;
  overdue_reminder_days: number | null;
  default_discount_percent: number | null;
  default_discount_days: number | null;
  layout_variant: string | null;
  customer_number_prefix: string | null;
  customer_number_format: string | null;
  next_customer_number: number | null;
  default_rabatt_percent: number | null;
  order_confirmation_prefix: string | null;
  delivery_note_prefix: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const DEFAULTS: Partial<InvoiceSettings> = {
  invoice_number_prefix: 'RE',
  invoice_number_format: '{prefix}-{year}-{seq}',
  next_sequence_number: 1,
  default_payment_terms_days: 14,
  auto_send_enabled: false,
  send_copy_to_self: true,
  overdue_reminder_enabled: false,
  overdue_reminder_days: 7,
};

export function useInvoiceSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('invoice_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      setSettings(data as InvoiceSettings | null);
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const saveSettings = async (updates: Partial<InvoiceSettings>) => {
    if (!user) return false;
    if (settings) {
      const { error } = await supabase
        .from('invoice_settings')
        .update(updates as any)
        .eq('id', settings.id);
      if (error) {
        toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
        return false;
      }
    } else {
      const { error } = await supabase
        .from('invoice_settings')
        .insert({ ...DEFAULTS, ...updates, user_id: user.id } as any);
      if (error) {
        toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
        return false;
      }
    }
    toast({ title: 'Einstellungen gespeichert' });
    await fetchSettings();
    return true;
  };

  return { settings, loading, saveSettings, fetchSettings };
}
