import { useState } from 'react';
import { FileText, Split, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface InvoiceSuggestion {
  pages: number[];
  vendor_name?: string;
  invoice_number?: string;
  total_amount?: number;
  date?: string;
}

interface SplitSuggestion {
  contains_multiple_invoices: boolean;
  confidence: number;
  invoice_count: number;
  invoices: InvoiceSuggestion[];
  reason?: string;
}

interface MultiInvoiceAlertProps {
  receiptId: string;
  splitSuggestion: SplitSuggestion | null;
  onSplitClick?: () => void;
}

export function MultiInvoiceAlert({ 
  receiptId, 
  splitSuggestion,
  onSplitClick 
}: MultiInvoiceAlertProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!splitSuggestion || !splitSuggestion.contains_multiple_invoices) {
    return null;
  }

  const handleKeepAsSingle = async () => {
    setIsProcessing(true);
    try {
      // Reset status and reprocess without multi-check
      await supabase
        .from('receipts')
        .update({
          status: 'processing',
          split_suggestion: null,
          notes: null,
        })
        .eq('id', receiptId);

      // Restart AI extraction without multi-check
      const { error } = await supabase.functions.invoke('extract-receipt', {
        body: { receiptId, skipMultiCheck: true }
      });

      if (error) throw error;

      toast({
        title: "Wird verarbeitet",
        description: "Das Dokument wird als einzelne Rechnung verarbeitet.",
      });

      queryClient.invalidateQueries({ queryKey: ['receipts'] });
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return '';
    return new Intl.NumberFormat('de-AT', { 
      style: 'currency', 
      currency: 'EUR' 
    }).format(value);
  };

  return (
    <Alert className="bg-orange-50 border-orange-200">
      <FileText className="h-4 w-4 text-orange-600" />
      <AlertDescription>
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Split className="h-4 w-4 text-orange-600" />
              <span className="font-medium text-orange-900">
                Mehrere Rechnungen erkannt
              </span>
              <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                {splitSuggestion.invoice_count} Rechnungen
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Description */}
          <p className="text-sm text-orange-800">
            Dieses PDF enthält {splitSuggestion.invoice_count} separate Rechnungen. 
            {splitSuggestion.reason && ` ${splitSuggestion.reason}`}
          </p>

          {/* Expanded: Invoice details */}
          {isExpanded && splitSuggestion.invoices.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-orange-200">
              {splitSuggestion.invoices.map((inv, i) => (
                <div 
                  key={i} 
                  className="flex items-center justify-between text-sm bg-white/50 rounded px-2 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      S. {inv.pages?.join('-') || '?'}
                    </Badge>
                    <span className="font-medium text-orange-900">
                      {inv.vendor_name || `Rechnung ${i + 1}`}
                    </span>
                    {inv.invoice_number && (
                      <span className="text-muted-foreground">
                        #{inv.invoice_number}
                      </span>
                    )}
                  </div>
                  {inv.total_amount !== undefined && (
                    <span className="font-medium">
                      {formatCurrency(inv.total_amount)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              size="sm"
              onClick={onSplitClick}
              disabled={isProcessing}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Split className="h-4 w-4 mr-1" />
              PDF aufteilen
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleKeepAsSingle}
              disabled={isProcessing}
              className="border-orange-300 text-orange-700 hover:bg-orange-100"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : null}
              Als einzelne Rechnung behalten
            </Button>
          </div>

          {/* Confidence indicator */}
          {splitSuggestion.confidence < 0.85 && (
            <p className="text-xs text-orange-600">
              Konfidenz: {Math.round(splitSuggestion.confidence * 100)}% – 
              Prüfe die Erkennung manuell
            </p>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
