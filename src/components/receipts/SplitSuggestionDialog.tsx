import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Scissors, 
  FileText, 
  Plus,
  Loader2,
  GripVertical,
  AlertTriangle,
  Eye,
  Trash2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSplitPdf } from '@/hooks/useSplitPdf';

interface SplitInvoice {
  id: string;
  pages: number[];
  vendor_name: string;
  total_amount?: number;
  date?: string;
  invoice_number?: string;
}

interface SplitSuggestion {
  invoice_count: number;
  confidence: number;
  invoices: Array<{
    pages: number[];
    vendor_name?: string;
    total_amount?: number;
    date?: string;
    invoice_number?: string;
  }>;
  reason?: string;
}

interface Receipt {
  id: string;
  file_name: string;
  file_url: string;
  page_count: number;
  split_suggestion: SplitSuggestion;
}

interface SplitSuggestionDialogProps {
  open: boolean;
  onClose: () => void;
  receipt: Receipt;
}

// Farben für die verschiedenen Splits
const SPLIT_COLORS = [
  { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-800', ring: 'ring-blue-400' },
  { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-800', ring: 'ring-green-400' },
  { bg: 'bg-teal-100', border: 'border-teal-300', text: 'text-teal-800', ring: 'ring-teal-400' },
  { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-800', ring: 'ring-orange-400' },
  { bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-800', ring: 'ring-pink-400' },
  { bg: 'bg-teal-100', border: 'border-teal-300', text: 'text-teal-800', ring: 'ring-teal-400' },
  { bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-800', ring: 'ring-yellow-400' },
  { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-800', ring: 'ring-red-400' },
];

export function SplitSuggestionDialog({ open, onClose, receipt }: SplitSuggestionDialogProps) {
  const { splitPdf, keepAsSingleInvoice, isSplitting, progress } = useSplitPdf();
  
  const [splits, setSplits] = useState<SplitInvoice[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialisiere Splits aus KI-Vorschlag
  useEffect(() => {
    if (receipt.split_suggestion?.invoices && receipt.split_suggestion.invoices.length > 0) {
      setSplits(
        receipt.split_suggestion.invoices.map((inv, i) => ({
          id: crypto.randomUUID(),
          pages: inv.pages || [],
          vendor_name: inv.vendor_name || `Rechnung ${i + 1}`,
          total_amount: inv.total_amount,
          date: inv.date,
          invoice_number: inv.invoice_number,
        }))
      );
    } else {
      setSplits([
        { id: crypto.randomUUID(), pages: [], vendor_name: 'Rechnung 1' },
        { id: crypto.randomUUID(), pages: [], vendor_name: 'Rechnung 2' },
      ]);
    }
  }, [receipt.split_suggestion]);

  // PDF-Vorschau URL laden
  useEffect(() => {
    const loadPreview = async () => {
      try {
        const { data } = await supabase.storage
          .from('receipts')
          .createSignedUrl(receipt.file_url, 3600);
        if (data) setPreviewUrl(data.signedUrl);
      } catch (e) {
        console.error('Preview URL error:', e);
      }
    };
    if (receipt.file_url) loadPreview();
  }, [receipt.file_url]);

  // Validierung
  useEffect(() => {
    const validSplits = splits.filter(s => s.pages.length > 0);
    const allAssignedPages = splits.flatMap(s => s.pages);
    const allPages = Array.from({ length: receipt.page_count }, (_, i) => i + 1);
    const unassignedPages = allPages.filter(p => !allAssignedPages.includes(p));
    const duplicatePages = allAssignedPages.filter((p, i) => allAssignedPages.indexOf(p) !== i);

    if (duplicatePages.length > 0) {
      setValidationError(`Seiten ${duplicatePages.join(', ')} sind mehrfach zugewiesen`);
    } else if (validSplits.length < 2) {
      setValidationError('Mindestens 2 Teile mit Seiten erforderlich');
    } else if (unassignedPages.length > 0) {
      setValidationError(`Seiten ${unassignedPages.join(', ')} sind nicht zugewiesen`);
    } else {
      setValidationError(null);
    }
  }, [splits, receipt.page_count]);

  const allPages = Array.from({ length: receipt.page_count }, (_, i) => i + 1);

  const getPageSplitIndex = (page: number): number => {
    return splits.findIndex(s => s.pages.includes(page));
  };

  const getSplitColor = (index: number) => {
    return SPLIT_COLORS[index % SPLIT_COLORS.length];
  };

  const togglePageInSplit = (splitId: string, page: number) => {
    setSplits(prev => {
      const withoutPage = prev.map(split => ({
        ...split,
        pages: split.pages.filter(p => p !== page),
      }));

      return withoutPage.map(split => {
        if (split.id === splitId) {
          const hadPage = prev.find(s => s.id === splitId)?.pages.includes(page);
          if (hadPage) {
            return split;
          } else {
            return {
              ...split,
              pages: [...split.pages, page].sort((a, b) => a - b),
            };
          }
        }
        return split;
      });
    });
  };

  const addSplit = () => {
    setSplits(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        pages: [],
        vendor_name: `Rechnung ${prev.length + 1}`,
      },
    ]);
  };

  const removeSplit = (splitId: string) => {
    if (splits.length <= 2) return;
    setSplits(prev => prev.filter(s => s.id !== splitId));
  };

  const updateSplitField = (splitId: string, field: keyof SplitInvoice, value: any) => {
    setSplits(prev =>
      prev.map(s => (s.id === splitId ? { ...s, [field]: value } : s))
    );
  };

  const handleSplit = async () => {
    if (validationError) return;

    const result = await splitPdf(receipt.id, splits);
    if (result?.success) {
      onClose();
    }
  };

  const handleKeepAsSingle = async () => {
    const success = await keepAsSingleInvoice(receipt.id);
    if (success) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-chart-4" />
            PDF aufteilen
          </DialogTitle>
          <DialogDescription>
            Die KI hat {receipt.split_suggestion?.invoice_count || 'mehrere'} separate 
            Rechnungen erkannt (Konfidenz: {Math.round((receipt.split_suggestion?.confidence || 0) * 100)}%).
            Prüfe und passe die Aufteilung an.
          </DialogDescription>
        </DialogHeader>

        {/* Hauptbereich: 2 Spalten */}
        <div className="flex-1 grid grid-cols-2 gap-4 min-h-0 overflow-hidden">
          {/* Linke Seite: Seiten-Übersicht */}
          <div className="flex flex-col space-y-3 overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Seiten zuordnen</span>
              </div>
              <Badge variant="secondary">{receipt.page_count} Seiten</Badge>
            </div>

            <p className="text-xs text-muted-foreground">
              Klicke auf eine Seite in einem Teil um sie zuzuordnen oder zu entfernen.
            </p>

            <Card className="p-4 bg-muted/30 flex-1 overflow-auto">
              <div className="grid grid-cols-4 gap-2">
                {allPages.map(page => {
                  const splitIndex = getPageSplitIndex(page);
                  const isAssigned = splitIndex !== -1;
                  const color = isAssigned ? getSplitColor(splitIndex) : null;

                  return (
                    <div
                      key={page}
                      className={`
                        aspect-[3/4] rounded-lg border-2 flex flex-col items-center justify-center
                        transition-all cursor-default
                        ${isAssigned 
                          ? `${color!.bg} ${color!.border} ${color!.text}` 
                          : 'bg-white border-dashed border-gray-300 text-gray-400'
                        }
                      `}
                    >
                      <span className="text-lg font-bold">{page}</span>
                      {isAssigned && (
                        <span className="text-[10px] mt-0.5 opacity-75">
                          Teil {splitIndex + 1}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* PDF Vorschau Link */}
            {previewUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(previewUrl, '_blank')}
                className="w-full"
              >
                <Eye className="h-4 w-4 mr-2" />
                PDF in neuem Tab öffnen
              </Button>
            )}
          </div>

          {/* Rechte Seite: Split-Konfiguration */}
          <div className="flex flex-col space-y-3 overflow-hidden">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Teile konfigurieren ({splits.length})</h4>
              <Button variant="outline" size="sm" onClick={addSplit}>
                <Plus className="h-4 w-4 mr-1" />
                Teil hinzufügen
              </Button>
            </div>

            <ScrollArea className="flex-1 pr-2">
              <div className="space-y-3">
                {splits.map((split, index) => {
                  const color = getSplitColor(index);

                  return (
                    <Card key={split.id} className={`p-3 ${color.bg} ${color.border} border`}>
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-gray-400" />
                          <Badge className={`${color.bg} ${color.text} border ${color.border}`}>
                            Teil {index + 1}
                          </Badge>
                        </div>
                        {splits.length > 2 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSplit(split.id)}
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      {/* Vendor Name */}
                      <div className="space-y-1 mb-3">
                        <Label className="text-xs text-muted-foreground">Lieferant/Name</Label>
                        <Input
                          value={split.vendor_name}
                          onChange={(e) => updateSplitField(split.id, 'vendor_name', e.target.value)}
                          className="h-8 bg-white/70"
                          placeholder="z.B. Amazon"
                        />
                      </div>

                      {/* Seiten-Auswahl */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Seiten zuweisen</Label>
                        <div className="flex flex-wrap gap-1">
                          {allPages.map(page => {
                            const isInThisSplit = split.pages.includes(page);
                            const otherSplitIndex = getPageSplitIndex(page);
                            const isInOtherSplit = otherSplitIndex !== -1 && otherSplitIndex !== index;

                            return (
                              <Button
                                key={page}
                                variant="ghost"
                                size="sm"
                                onClick={() => togglePageInSplit(split.id, page)}
                                className={`
                                  w-7 h-7 p-0 rounded text-xs font-medium transition-all
                                  ${isInThisSplit
                                    ? `bg-white shadow-sm ring-2 ${color.ring} ${color.text}`
                                    : isInOtherSplit
                                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'
                                      : 'bg-white/50 hover:bg-white/80 text-gray-600'
                                  }
                                `}
                                disabled={isInOtherSplit}
                                title={isInOtherSplit 
                                  ? `Bereits Teil ${otherSplitIndex + 1} zugewiesen` 
                                  : isInThisSplit 
                                    ? 'Klicken zum Entfernen' 
                                    : 'Klicken zum Zuweisen'
                                }
                              >
                                {page}
                              </Button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Zusammenfassung */}
                      <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                        {split.pages.length === 0 ? (
                          <span className="text-amber-600">Keine Seiten zugewiesen</span>
                        ) : (
                          <span>
                            Seiten: {split.pages.join(', ')} 
                            ({split.pages.length} {split.pages.length === 1 ? 'Seite' : 'Seiten'})
                          </span>
                        )}
                        {split.total_amount && (
                          <span>• €{split.total_amount.toFixed(2)}</span>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Validierungs-Warnung */}
        {validationError && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}

        {/* Fortschritt */}
        {isSplitting && progress && (
          <Alert className="mt-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>{progress}</AlertDescription>
          </Alert>
        )}

        {/* Footer */}
        <DialogFooter className="mt-4 flex-shrink-0">
          <Button
            variant="ghost"
            onClick={handleKeepAsSingle}
            disabled={isSplitting}
          >
            <FileText className="h-4 w-4 mr-2" />
            Als einzelne Rechnung behalten
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSplitting}>
              Abbrechen
            </Button>
            <Button
              onClick={handleSplit}
              disabled={isSplitting || !!validationError}
              className="bg-chart-4 hover:bg-chart-4/90"
            >
              {isSplitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Scissors className="h-4 w-4 mr-2" />
              )}
              In {splits.filter(s => s.pages.length > 0).length} Teile aufteilen
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
