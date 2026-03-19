import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface QuoteSettings {
  id: string;
  user_id: string;
  quote_number_prefix: string | null;
  quote_number_format: string | null;
  next_sequence_number: number | null;
  default_validity_days: number | null;
  default_footer_text: string | null;
  default_notes: string | null;
  layout_variant: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const DEFAULTS: Partial<QuoteSettings> = {
  quote_number_prefix: 'AG',
  quote_number_format: '{prefix}-{year}-{seq}',
  next_sequence_number: 1,
  default_validity_days: 30,
};

export function useQuoteSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<QuoteSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('quote_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      setSettings(data as QuoteSettings | null);
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const saveSettings = async (updates: Partial<QuoteSettings>) => {
    if (!user) return false;
    if (settings) {
      const { error } = await (supabase as any)
        .from('quote_settings')
        .update(updates)
        .eq('id', settings.id);
      if (error) {
        toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
        return false;
      }
    } else {
      const { error } = await (supabase as any)
        .from('quote_settings')
        .insert({ ...DEFAULTS, ...updates, user_id: user.id });
      if (error) {
        toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
        return false;
      }
    }
    toast({ title: 'Angebotseinstellungen gespeichert' });
    await fetchSettings();
    return true;
  };

  return { settings, loading, saveSettings, fetchSettings };
}
