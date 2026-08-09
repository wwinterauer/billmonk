import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

export interface ProblemReceipt {
  id: string;
  file_name: string | null;
  file_url: string | null;
  vendor: string | null;
  status: string;
  notes: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

/** Minutes after which a pending/processing receipt counts as stuck. */
export const STALE_MINUTES = 10;

const staleCutoff = () => new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();

export async function fetchProblemReceipts(userId: string): Promise<ProblemReceipt[]> {
  const cutoff = staleCutoff();
  const { data, error } = await supabase
    .from('receipts')
    .select('id, file_name, file_url, vendor, status, notes, source, created_at, updated_at')
    .eq('user_id', userId)
    .in('status', ['error', 'pending', 'processing'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).filter(
    (r: ProblemReceipt) => r.status === 'error' || r.updated_at < cutoff,
  );
}

/** Live count of receipts that silently failed or got stuck in processing. */
export function useProblemReceiptCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setCount(0);
      return;
    }
    try {
      const rows = await fetchProblemReceipts(user.id);
      setCount(rows.length);
    } catch {
      /* ignore — badge is non-critical */
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    refresh();
    const channel = supabase
      .channel(`receipts-problem-count-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'receipts', filter: `user_id=eq.${user.id}` },
        () => refresh(),
      )
      .subscribe();
    const onRefresh = () => refresh();
    window.addEventListener('refresh-review-count', onRefresh);
    const interval = setInterval(() => {
      if (!document.hidden) refresh();
    }, 15000);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('refresh-review-count', onRefresh);
      clearInterval(interval);
    };
  }, [user, refresh]);

  return { count, refresh };
}

export interface RetryProgress {
  current: number;
  total: number;
  success: number;
  failed: number;
}

const emptyProgress: RetryProgress = { current: 0, total: 0, success: 0, failed: 0 };

/** Shared retry logic: re-runs AI extraction for the given receipts. */
export function useReceiptRetry() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRetrying, setIsRetrying] = useState(false);
  const [progress, setProgress] = useState<RetryProgress>(emptyProgress);

  const retryReceiptIds = useCallback(
    async (inputIds: string[], options?: { force?: boolean }) => {
      let ids = inputIds;

      // Documents already classified as "not a receipt" would produce the exact
      // same result again — skip them unless the caller explicitly forces it.
      if (!options?.force && ids.length > 0) {
        const { data: skipRows } = await supabase
          .from('receipts')
          .select('id')
          .in('id', ids)
          .eq('status', 'not_a_receipt');
        const skip = new Set((skipRows ?? []).map(r => r.id));
        if (skip.size > 0) {
          ids = ids.filter(id => !skip.has(id));
          toast({
            title: 'Nicht-Belege übersprungen',
            description: `${skip.size} Dokument(e) wurden bereits als Nicht-Beleg erkannt.`,
          });
        }
      }

      if (ids.length === 0) {
        toast({ title: 'Keine Belege', description: 'Es gibt nichts zu verarbeiten.' });
        return { success: 0, failed: 0 };
      }

      setIsRetrying(true);
      setProgress({ ...emptyProgress, total: ids.length });

      let success = 0;
      let failed = 0;



      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        setProgress(prev => ({ ...prev, current: i + 1 }));
        try {
          await supabase.from('receipts').update({ status: 'processing', notes: null }).eq('id', id);
          const { error } = await supabase.functions.invoke('extract-receipt', {
            body: { receiptId: id },
          });
          if (error) throw error;
          success++;
          setProgress(prev => ({ ...prev, success }));
        } catch (err) {
          failed++;
          setProgress(prev => ({ ...prev, failed }));
          await supabase
            .from('receipts')
            .update({
              status: 'error',
              notes: `Erneuter Versuch fehlgeschlagen: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`,
            })
            .eq('id', id);
        }
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      toast({
        title: 'Verarbeitung abgeschlossen',
        description: `${success} erfolgreich, ${failed} fehlgeschlagen`,
        variant: failed > 0 ? 'destructive' : undefined,
      });

      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['unprocessed-counts'] });
      queryClient.invalidateQueries({ queryKey: ['review-count'] });
      window.dispatchEvent(new Event('refresh-review-count'));
      setIsRetrying(false);
      return { success, failed };
    },
    [queryClient, toast],
  );

  const retryByStatuses = useCallback(
    async (statuses: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'Fehler', description: 'Nicht angemeldet', variant: 'destructive' });
        return { success: 0, failed: 0 };
      }
      const { data, error } = await supabase
        .from('receipts')
        .select('id')
        .eq('user_id', user.id)
        .in('status', statuses)
        .order('created_at', { ascending: true });
      if (error) {
        toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
        return { success: 0, failed: 0 };
      }
      return retryReceiptIds((data ?? []).map(r => r.id));
    },
    [retryReceiptIds, toast],
  );

  return { isRetrying, progress, retryReceiptIds, retryByStatuses };
}
