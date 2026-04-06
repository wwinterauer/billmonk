import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CrmFieldConfig {
  id: string;
  user_id: string;
  entity_type: string;
  visible_fields: string[];
  list_columns: string[];
}

const DEFAULT_CUSTOMER_FIELDS = ['display_name', 'company_name', 'email', 'phone', 'city', 'customer_number'];
const DEFAULT_CUSTOMER_COLUMNS = ['display_name', 'company_name', 'email', 'city', 'customer_number'];

const DEFAULT_MEMBER_FIELDS = ['display_name', 'first_name', 'last_name', 'email', 'phone', 'city', 'member_number', 'member_type', 'membership_fee', 'joined_at'];
const DEFAULT_MEMBER_COLUMNS = ['display_name', 'member_type', 'email', 'city', 'member_number'];

export const CUSTOMER_FIELD_OPTIONS = [
  { key: 'display_name', label: 'Anzeigename' },
  { key: 'company_name', label: 'Firma' },
  { key: 'contact_person', label: 'Kontaktperson' },
  { key: 'email', label: 'E-Mail' },
  { key: 'phone', label: 'Telefon' },
  { key: 'street', label: 'Straße' },
  { key: 'zip', label: 'PLZ' },
  { key: 'city', label: 'Stadt' },
  { key: 'country', label: 'Land' },
  { key: 'uid_number', label: 'UID-Nummer' },
  { key: 'customer_number', label: 'Kundennummer' },
  { key: 'payment_terms_days', label: 'Zahlungsziel' },
  { key: 'notes', label: 'Notizen' },
  { key: 'newsletter_opt_out', label: 'Newsletter Opt-Out' },
];

export const MEMBER_FIELD_OPTIONS = [
  { key: 'display_name', label: 'Anzeigename' },
  { key: 'first_name', label: 'Vorname' },
  { key: 'last_name', label: 'Nachname' },
  { key: 'email', label: 'E-Mail' },
  { key: 'phone', label: 'Telefon' },
  { key: 'street', label: 'Straße' },
  { key: 'zip', label: 'PLZ' },
  { key: 'city', label: 'Stadt' },
  { key: 'country', label: 'Land' },
  { key: 'member_number', label: 'Mitgliedsnummer' },
  { key: 'member_type', label: 'Typ / Gruppe' },
  { key: 'membership_fee', label: 'Mitgliedsbeitrag' },
  { key: 'joined_at', label: 'Beitrittsdatum' },
  { key: 'is_active', label: 'Status (aktiv/inaktiv)' },
  { key: 'newsletter_opt_out', label: 'Newsletter Opt-Out' },
  { key: 'notes', label: 'Notizen' },
];

export function useCrmFieldConfig(entityType: 'customer' | 'member') {
  const { user } = useAuth();
  const [config, setConfig] = useState<CrmFieldConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const defaults = entityType === 'customer'
    ? { visible_fields: DEFAULT_CUSTOMER_FIELDS, list_columns: DEFAULT_CUSTOMER_COLUMNS }
    : { visible_fields: DEFAULT_MEMBER_FIELDS, list_columns: DEFAULT_MEMBER_COLUMNS };

  const fetchConfig = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('crm_field_config')
      .select('*')
      .eq('user_id', user.id)
      .eq('entity_type', entityType)
      .maybeSingle();

    if (!error && data) {
      setConfig({
        id: data.id,
        user_id: data.user_id,
        entity_type: data.entity_type,
        visible_fields: (data.visible_fields as string[]) || defaults.visible_fields,
        list_columns: (data.list_columns as string[]) || defaults.list_columns,
      });
    } else {
      setConfig({
        id: '',
        user_id: user.id,
        entity_type: entityType,
        ...defaults,
      });
    }
    setLoading(false);
  }, [user, entityType]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const saveConfig = async (visibleFields: string[], listColumns: string[]) => {
    if (!user) return;
    const { data: existing } = await supabase
      .from('crm_field_config')
      .select('id')
      .eq('user_id', user.id)
      .eq('entity_type', entityType)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('crm_field_config')
        .update({ visible_fields: visibleFields as any, list_columns: listColumns as any, updated_at: new Date().toISOString() } as any)
        .eq('id', existing.id);
    } else {
      await supabase
        .from('crm_field_config')
        .insert({ user_id: user.id, entity_type: entityType, visible_fields: visibleFields as any, list_columns: listColumns as any } as any);
    }
    setConfig(prev => prev ? { ...prev, visible_fields: visibleFields, list_columns: listColumns } : prev);
  };

  return {
    config,
    loading,
    visibleFields: config?.visible_fields || defaults.visible_fields,
    listColumns: config?.list_columns || defaults.list_columns,
    saveConfig,
  };
}
