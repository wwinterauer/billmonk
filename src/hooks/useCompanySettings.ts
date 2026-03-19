import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface CompanySettings {
  id: string;
  user_id: string;
  company_name: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  uid_number: string | null;
  company_register_court: string | null;
  company_register_number: string | null;
  phone: string | null;
  email: string | null;
  logo_path: string | null;
  bank_name: string | null;
  iban: string | null;
  bic: string | null;
  account_holder: string | null;
  is_small_business: boolean | null;
  small_business_text: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const DEFAULTS: Partial<CompanySettings> = {
  country: 'AT',
  is_small_business: false,
  small_business_text: 'Umsatzsteuerbefreit – Kleinunternehmer gem. § 6 Abs. 1 Z 27 UStG',
};

export function useCompanySettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      setSettings(data as CompanySettings | null);
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const saveSettings = async (updates: Partial<CompanySettings>) => {
    if (!user) return false;
    if (settings) {
      const { error } = await supabase
        .from('company_settings')
        .update(updates as any)
        .eq('id', settings.id);
      if (error) {
        toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
        return false;
      }
    } else {
      const { error } = await supabase
        .from('company_settings')
        .insert({ ...DEFAULTS, ...updates, user_id: user.id } as any);
      if (error) {
        toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
        return false;
      }
    }
    toast({ title: 'Firmendaten gespeichert' });
    await fetchSettings();
    return true;
  };

  const uploadLogo = async (file: File): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split('.').pop();
    const path = `${user.id}/logo.${ext}`;
    const { error } = await supabase.storage
      .from('company-logos')
      .upload(path, file, { upsert: true });
    if (error) {
      toast({ title: 'Upload fehlgeschlagen', description: error.message, variant: 'destructive' });
      return null;
    }
    return path;
  };

  const getLogoUrl = (path: string | null): string | null => {
    if (!path) return null;
    const { data } = supabase.storage.from('company-logos').getPublicUrl(path);
    return data?.publicUrl || null;
  };

  return { settings, loading, saveSettings, fetchSettings, uploadLogo, getLogoUrl };
}
