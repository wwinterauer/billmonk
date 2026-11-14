import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const KEY = ['recurring-suggestion-dismissals'];

export function useRecurringDismissals() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: [...KEY, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_suggestion_dismissals')
        .select('id, pattern_key, label, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const dismiss = useMutation({
    mutationFn: async ({ patternKey, label }: { patternKey: string; label: string }) => {
      if (!user?.id) throw new Error('Nicht angemeldet');
      const { error } = await supabase
        .from('recurring_suggestion_dismissals')
        .upsert({ user_id: user.id, pattern_key: patternKey, label }, { onConflict: 'user_id,pattern_key' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recurring_suggestion_dismissals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
  return { dismissals: data, patterns: new Set(data.map((d) => d.pattern_key)), dismiss, restore };
}
