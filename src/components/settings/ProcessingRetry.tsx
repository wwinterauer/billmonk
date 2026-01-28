import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, Loader2, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface UnprocessedCounts {
  pending: number;
  processing: number;
  error: number;
  total: number;
}

export function ProcessingRetry() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRetrying, setIsRetrying] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });

  // Count unprocessed receipts
  const { data: unprocessedCounts, refetch } = useQuery({
    queryKey: ['unprocessed-counts'],
    queryFn: async (): Promise<UnprocessedCounts | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('receipts')
        .select('status')
        .eq('user_id', user.id)
        .in('status', ['pending', 'processing', 'error']);

      if (error) throw error;

      const counts = {
        pending: data.filter(r => r.status === 'pending').length,
        processing: data.filter(r => r.status === 'processing').length,
        error: data.filter(r => r.status === 'error').length,
        total: data.length,
      };

      return counts;
    },
    refetchInterval: isRetrying ? 5000 : false,
  });

  const handleRetryAll = async () => {
    await retryByStatuses(['pending', 'processing', 'error']);
  };

  const handleRetryErrors = async () => {
    await retryByStatuses(['error']);
  };

  const retryByStatuses = async (statuses: string[]) => {
    setIsRetrying(true);
    setProgress({ current: 0, total: 0, success: 0, failed: 0 });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nicht angemeldet');

      // Get all unprocessed receipts
      const { data: receipts, error } = await supabase
        .from('receipts')
        .select('id, file_name, status')
        .eq('user_id', user.id)
        .in('status', statuses)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!receipts || receipts.length === 0) {
        toast({
          title: "Keine Belege",
          description: "Es gibt keine zu verarbeitenden Belege.",
        });
        setIsRetrying(false);
        return;
      }

      setProgress(prev => ({ ...prev, total: receipts.length }));

      let successCount = 0;
      let failedCount = 0;

      // Process each receipt
      for (let i = 0; i < receipts.length; i++) {
        const receipt = receipts[i];
        
        setProgress(prev => ({ ...prev, current: i + 1 }));

        try {
          // Set status to processing
          await supabase
            .from('receipts')
            .update({ status: 'processing' })
            .eq('id', receipt.id);

          // Trigger AI extraction
          const { error: extractError } = await supabase.functions.invoke('extract-receipt', {
            body: { receiptId: receipt.id }
          });

          if (extractError) throw extractError;

          successCount++;
          setProgress(prev => ({ ...prev, success: successCount }));

        } catch (err) {
          console.error(`Retry failed for ${receipt.id}:`, err);
          failedCount++;
          setProgress(prev => ({ ...prev, failed: failedCount }));

          // Set status to error
          await supabase
            .from('receipts')
            .update({ 
              status: 'error',
              notes: `Retry fehlgeschlagen: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`
            })
            .eq('id', receipt.id);
        }

        // Small delay to avoid API overload
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      toast({
        title: "Verarbeitung abgeschlossen",
        description: `${successCount} erfolgreich, ${failedCount} fehlgeschlagen`,
      });

      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['unprocessed-counts'] });
      queryClient.invalidateQueries({ queryKey: ['review-count'] });
      refetch();

    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const progressPercentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <RefreshCw className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Belege erneut verarbeiten</CardTitle>
            <CardDescription>
              Starte die KI-Verarbeitung für Belege die nicht korrekt verarbeitet wurden.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Overview */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <Badge variant="outline" className="font-normal">
                Wartend
              </Badge>
              <span className="ml-2 font-semibold">{unprocessedCounts?.pending || 0}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg">
            <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
            <div>
              <Badge variant="outline" className="font-normal border-blue-200 text-blue-700">
                In Verarbeitung
              </Badge>
              <span className="ml-2 font-semibold">{unprocessedCounts?.processing || 0}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <div>
              <Badge variant="outline" className="font-normal border-red-200 text-red-700">
                Fehler
              </Badge>
              <span className="ml-2 font-semibold">{unprocessedCounts?.error || 0}</span>
            </div>
          </div>
        </div>

        {/* Progress during retry */}
        {isRetrying && (
          <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>
                Verarbeite {progress.current} von {progress.total}...
              </span>
            </div>

            <Progress value={progressPercentage} className="h-2" />

            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-3 w-3" />
                {progress.success} erfolgreich
              </span>
              <span className="flex items-center gap-1 text-red-600">
                <AlertCircle className="h-3 w-3" />
                {progress.failed} fehlgeschlagen
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button 
            onClick={handleRetryAll}
            disabled={isRetrying || !unprocessedCounts?.total}
          >
            {isRetrying ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Alle erneut verarbeiten ({unprocessedCounts?.total || 0})
          </Button>

          {(unprocessedCounts?.error ?? 0) > 0 && (
            <Button 
              variant="outline"
              onClick={handleRetryErrors}
              disabled={isRetrying}
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              Nur Fehler ({unprocessedCounts?.error})
            </Button>
          )}
        </div>

        {/* Hint */}
        <p className="text-sm text-muted-foreground">
          💡 Die Verarbeitung kann je nach Anzahl der Belege einige Minuten dauern. 
          Die Seite muss nicht offen bleiben - die Verarbeitung läuft im Hintergrund.
        </p>
      </CardContent>
    </Card>
  );
}
