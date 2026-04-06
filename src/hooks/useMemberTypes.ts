import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface MemberType {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  sort_order: number | null;
  created_at: string | null;
}

const DEFAULT_TYPES = [
  { name: 'Mitglied', color: '#8B5CF6', icon: 'users' },
  { name: 'Premium-Kunde', color: '#F59E0B', icon: 'crown' },
  { name: 'Members-Club', color: '#10B981', icon: 'star' },
];

export function useMemberTypes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [memberTypes, setMemberTypes] = useState<MemberType[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTypes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('member_types')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order');
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }
    // Create defaults if none exist
    if (data.length === 0) {
      const inserts = DEFAULT_TYPES.map((t, i) => ({
        user_id: user.id,
        name: t.name,
        color: t.color,
        icon: t.icon,
        sort_order: i,
      }));
      const { data: created, error: insertError } = await supabase
        .from('member_types')
        .insert(inserts as any)
        .select();
      if (!insertError && created) {
        setMemberTypes(created as unknown as MemberType[]);
      }
    } else {
      setMemberTypes(data as unknown as MemberType[]);
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => { fetchTypes(); }, [fetchTypes]);

  const addType = async (name: string, color = '#8B5CF6', icon = 'users') => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('member_types')
      .insert({ user_id: user.id, name, color, icon, sort_order: memberTypes.length } as any)
      .select()
      .single();
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return null;
    }
    toast({ title: 'Typ erstellt' });
    await fetchTypes();
    return data as unknown as MemberType;
  };

  const updateType = async (id: string, updates: Partial<MemberType>) => {
    const { error } = await supabase.from('member_types').update(updates as any).eq('id', id);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchTypes();
    return true;
  };

  const deleteType = async (id: string) => {
    const { error } = await supabase.from('member_types').delete().eq('id', id);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Typ gelöscht' });
    await fetchTypes();
    return true;
  };

  return { memberTypes, loading, fetchTypes, addType, updateType, deleteType };
}
