import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { AlertTriangle, RefreshCw, Loader2, ExternalLink, Trash2, FileText, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { describeProcessingProblem } from '@/lib/uploadReasons';
import {
  fetchProblemReceipts,
  useReceiptRetry,
  type ProblemReceipt,
} from '@/hooks/useReceiptRetry';

const STATUS_LABEL: Record<string, string> = {
  error: 'Fehler',
  pending: 'Wartend',
  processing: 'Hängt',
};

export function ProblemReceiptsPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState<ProblemReceipt[] | null>(null);
  const { isRetrying, progress, retryReceiptIds } = useReceiptRetry();

  const load = useCallback(async () => {
    if (!user) {
      setRows([]);
      return;
    }
    try {
      setRows(await fetchProblemReceipts(user.id));
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler beim Laden',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
      setRows([]);
    }
  }, [user, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openFile = async (receipt: ProblemReceipt) => {
    if (!receipt.file_url) {
      toast({ title: 'Keine Datei hinterlegt', variant: 'destructive' });
      return;
    }
    const path = receipt.file_url.replace(/^.*\/receipts\//, '');
    const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 300);
    if (error || !data) {
      toast({ title: 'Datei konnte nicht geöffnet werden', variant: 'destructive' });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const manualEntry = async (receipt: ProblemReceipt) => {
    const { error } = await supabase
      .from('receipts')
      .update({ status: 'review', notes: null })
      .eq('id', receipt.id);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return;
    }
    window.dispatchEvent(new Event('refresh-review-count'));
    sessionStorage.setItem('review-last-receipt-id', receipt.id);
    navigate('/review');
  };

  const remove = async (receipt: ProblemReceipt) => {
    const { error } = await supabase.from('receipts').delete().eq('id', receipt.id);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Beleg gelöscht' });
    window.dispatchEvent(new Event('refresh-review-count'));
    load();
  };

  const retryAll = async () => {
    if (!rows) return;
    await retryReceiptIds(rows.map(r => r.id));
    load();
  };

  if (rows === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium text-foreground">Keine Problembelege</p>
          <p className="text-sm text-muted-foreground">
            Alle hochgeladenen Belege wurden erfolgreich verarbeitet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-destructive/30">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-foreground">
                  {rows.length} {rows.length === 1 ? 'Beleg wurde' : 'Belege wurden'} nicht verarbeitet
                </p>
                <p className="text-sm text-muted-foreground">
                  Diese Belege tauchen nicht in der Prüfliste auf, bis die Analyse erfolgreich war.
                </p>
              </div>
            </div>
            <Button onClick={retryAll} disabled={isRetrying} className="w-full sm:w-auto">
              {isRetrying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Alle erneut analysieren
            </Button>
          </div>

          {isRetrying && (
            <div className="space-y-1">
              <Progress value={progress.total ? (progress.current / progress.total) * 100 : 0} />
              <p className="text-xs text-muted-foreground">
                {progress.current} von {progress.total} — {progress.success} erfolgreich,{' '}
                {progress.failed} fehlgeschlagen
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        {rows.map(receipt => {
          const problem = describeProcessingProblem(receipt.status, receipt.notes);
          return (
            <Card key={receipt.id}>
              <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground truncate">
                      {receipt.file_name || receipt.vendor || 'Ohne Dateiname'}
                    </span>
                    <Badge variant={receipt.status === 'error' ? 'destructive' : 'secondary'}>
                      {STATUS_LABEL[receipt.status] ?? receipt.status}
                    </Badge>
                    {receipt.source === 'split' && <Badge variant="outline">Aufteilung</Badge>}
                  </div>
                  <p className="text-sm text-foreground/80 mt-1">{problem.title}</p>
                  {problem.hint && (
                    <p className="text-xs text-muted-foreground mt-0.5">{problem.hint}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(receipt.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => openFile(receipt)}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Öffnen
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isRetrying}
                    onClick={async () => {
                      await retryReceiptIds([receipt.id]);
                      load();
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Erneut analysieren
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => manualEntry(receipt)}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                    Manuell erfassen
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(receipt)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
