import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface SplitPart {
  pages: number[];
  vendor_name?: string;
  invoice_number?: string;
  total_amount?: number;
  date?: string;
}

interface CreatedReceipt {
  id: string;
  file_name: string;
  pages: number[];
  vendor_name?: string;
}

interface SplitResult {
  success: boolean;
  originalReceiptId: string;
  createdReceipts: CreatedReceipt[];
  count: number;
  message: string;
  error?: string;
}

export function useSplitPdf() {
  const [isSplitting, setIsSplitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const splitPdf = async (receiptId: string, splits: SplitPart[]): Promise<SplitResult | null> => {
    setIsSplitting(true);
    setProgress('PDF wird aufgeteilt...');

    try {
      // Validierung
      const validSplits = splits.filter(s => s.pages && s.pages.length > 0);
      
      if (validSplits.length < 2) {
        throw new Error('Mindestens 2 Teile mit Seiten erforderlich');
      }

      // Edge Function aufrufen
      const { data, error } = await supabase.functions.invoke<SplitResult>('split-pdf', {
        body: { receiptId, splits: validSplits },
      });

      if (error) {
        throw new Error(error.message || 'Splitting fehlgeschlagen');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Unbekannter Fehler');
      }

      setProgress(`${data.count} Teile erstellt, KI-Verarbeitung gestartet...`);

      toast({
        title: 'PDF aufgeteilt',
        description: `${data.count} separate Rechnungen erstellt und werden verarbeitet.`,
      });

      // Cache invalidieren
      queryClient.invalidateQueries({ queryKey: ['receipts'] });

      return data;

    } catch (error: any) {
      console.error('Split PDF error:', error);
      
      toast({
        title: 'Fehler beim Aufteilen',
        description: error.message,
        variant: 'destructive',
      });

      return null;

    } finally {
      setIsSplitting(false);
      setProgress(null);
    }
  };

  const keepAsSingleInvoice = async (receiptId: string): Promise<boolean> => {
    try {
      // Status zurücksetzen
      await supabase
        .from('receipts')
        .update({
          status: 'processing',
          split_suggestion: null,
          notes: null,
        })
        .eq('id', receiptId);

      // KI-Extraktion neu starten (ohne Multi-Check)
      const { error } = await supabase.functions.invoke('extract-receipt', {
        body: { receiptId, skipMultiCheck: true },
      });

      if (error) throw error;

      toast({
        title: 'Wird verarbeitet',
        description: 'Das Dokument wird als einzelne Rechnung verarbeitet.',
      });

      queryClient.invalidateQueries({ queryKey: ['receipts'] });

      return true;

    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: error.message,
        variant: 'destructive',
      });

      return false;
    }
  };

  return {
    splitPdf,
    keepAsSingleInvoice,
    isSplitting,
    progress,
  };
}
