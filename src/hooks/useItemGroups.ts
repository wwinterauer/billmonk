import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface ItemGroup {
  id: string;
  user_id: string;
  name: string;
  sort_order: number | null;
  created_at: string | null;
}

export function useItemGroups() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [groups, setGroups] = useState<ItemGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGroups = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('item_groups')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true });
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      setGroups(data as ItemGroup[]);
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const addGroup = async (name: string) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('item_groups')
      .insert({ user_id: user.id, name } as any)
      .select()
      .single();
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return null;
    }
    toast({ title: 'Artikelgruppe erstellt' });
    await fetchGroups();
    return data as ItemGroup;
  };

  const updateGroup = async (id: string, name: string) => {
    const { error } = await supabase.from('item_groups').update({ name } as any).eq('id', id);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Artikelgruppe aktualisiert' });
    await fetchGroups();
    return true;
  };

  const deleteGroup = async (id: string) => {
    const { error } = await supabase.from('item_groups').delete().eq('id', id);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Artikelgruppe gelöscht' });
    await fetchGroups();
    return true;
  };

  return { groups, loading, fetchGroups, addGroup, updateGroup, deleteGroup };
}
