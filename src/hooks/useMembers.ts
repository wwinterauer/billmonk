import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Member {
  id: string;
  user_id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  member_number: string | null;
  member_type: string | null;
  membership_fee: number | null;
  joined_at: string | null;
  is_active: boolean | null;
  newsletter_opt_out: boolean | null;
  notes: string | null;
  custom_fields: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
}

export type MemberInsert = Omit<Member, 'id' | 'created_at' | 'updated_at'>;

export function useMembers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('user_id', user.id)
      .order('display_name');
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      setMembers(data as unknown as Member[]);
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const addMember = async (member: Partial<MemberInsert>) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('members')
      .insert({ ...member, user_id: user.id, display_name: member.display_name || '' } as any)
      .select()
      .single();
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return null;
    }
    toast({ title: 'Mitglied erstellt' });
    await fetchMembers();
    return data as unknown as Member;
  };

  const updateMember = async (id: string, updates: Partial<Member>) => {
    const { error } = await supabase.from('members').update(updates as any).eq('id', id);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Mitglied aktualisiert' });
    await fetchMembers();
    return true;
  };

  const deleteMember = async (id: string) => {
    const { error } = await supabase.from('members').delete().eq('id', id);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Mitglied gelöscht' });
    await fetchMembers();
    return true;
  };

  return { members, loading, fetchMembers, addMember, updateMember, deleteMember };
}
