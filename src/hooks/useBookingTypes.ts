import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TAX_TYPES } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';

export interface BookingType {
  name: string;
  label: string;
  isSystem: boolean;
  isHidden: boolean;
  bookingKey: string;
}

interface BookingTypeSettings {
  hidden?: string[];
  custom?: { name: string; label?: string; key?: string }[];
  keys?: Record<string, string>;
  renamed?: Record<string, string>;
}

export function useBookingTypes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<BookingTypeSettings>({});
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('booking_type_settings')
      .eq('id', user.id)
      .single();
    
    const raw = data?.booking_type_settings;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      setSettings(raw as unknown as BookingTypeSettings);
    } else {
      setSettings({});
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const saveSettings = useCallback(async (newSettings: BookingTypeSettings) => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ booking_type_settings: newSettings as any })
      .eq('id', user.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Fehler beim Speichern', description: error.message });
      return false;
    }
    setSettings(newSettings);
    return true;
  }, [user, toast]);

  const bookingTypes = useMemo<BookingType[]>(() => {
    const hidden = settings.hidden || [];
    const keys = settings.keys || {};
    const renamed = settings.renamed || {};
    const custom = settings.custom || [];

    const system: BookingType[] = TAX_TYPES.map(t => ({
      name: t.value,
      label: renamed[t.value] || t.label,
      isSystem: true,
      isHidden: hidden.includes(t.value),
      bookingKey: keys[t.value] || '',
    }));

    const customTypes: BookingType[] = custom.map(c => ({
      name: c.name,
      label: c.label || c.name,
      isSystem: false,
      isHidden: hidden.includes(c.name),
      bookingKey: c.key || keys[c.name] || '',
    }));

    return [...system, ...customTypes];
  }, [settings]);

  const visibleBookingTypes = useMemo(
    () => bookingTypes.filter(bt => !bt.isHidden),
    [bookingTypes]
  );

  const toggleHidden = useCallback(async (name: string) => {
    const hidden = new Set(settings.hidden || []);
    if (hidden.has(name)) hidden.delete(name); else hidden.add(name);
    return saveSettings({ ...settings, hidden: Array.from(hidden) });
  }, [settings, saveSettings]);

  const updateBookingKey = useCallback(async (name: string, key: string) => {
    const keys = { ...(settings.keys || {}), [name]: key };
    return saveSettings({ ...settings, keys });
  }, [settings, saveSettings]);

  const addCustomType = useCallback(async (name: string, bookingKey?: string) => {
    const custom = [...(settings.custom || []), { name, key: bookingKey || '' }];
    return saveSettings({ ...settings, custom });
  }, [settings, saveSettings]);

  const removeCustomType = useCallback(async (name: string) => {
    const custom = (settings.custom || []).filter(c => c.name !== name);
    const hidden = (settings.hidden || []).filter(h => h !== name);
    const keys = { ...(settings.keys || {}) };
    delete keys[name];
    return saveSettings({ ...settings, custom, hidden, keys });
  }, [settings, saveSettings]);

  const renameType = useCallback(async (name: string, newLabel: string) => {
    // For system types, store rename mapping
    const isSystem = TAX_TYPES.some(t => t.value === name);
    if (isSystem) {
      const renamed = { ...(settings.renamed || {}), [name]: newLabel };
      return saveSettings({ ...settings, renamed });
    }
    // For custom types, update in custom array
    const custom = (settings.custom || []).map(c =>
      c.name === name ? { ...c, label: newLabel } : c
    );
    return saveSettings({ ...settings, custom });
  }, [settings, saveSettings]);

  return {
    bookingTypes,
    visibleBookingTypes,
    loading,
    toggleHidden,
    updateBookingKey,
    addCustomType,
    removeCustomType,
    renameType,
    refetch: fetchSettings,
  };
}
