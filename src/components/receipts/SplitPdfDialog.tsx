import { useState, useEffect } from 'react';
import { Scissors, FileText, Loader2, Plus, Trash2, GripVertical } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useSplitPdf } from '@/hooks/useSplitPdf';

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

interface SplitPdfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiptId: string;
  splitSuggestion: SplitSuggestion | null;
  pageCount: number;
  onSplitComplete?: () => void;
}

interface SplitPart {
  pages: number[];
  vendor_name: string;
  invoice_number: string;
  total_amount: string;
  date: string;
}

export function SplitPdfDialog({
  open,
  onOpenChange,
  receiptId,
  splitSuggestion,
  pageCount,
  onSplitComplete,
}: SplitPdfDialogProps) {
  const { splitPdf, isSplitting, progress } = useSplitPdf();
  const [parts, setParts] = useState<SplitPart[]>([]);

  // Initialize parts from suggestion
  useEffect(() => {
    if (splitSuggestion?.invoices?.length) {
      setParts(
        splitSuggestion.invoices.map(inv => ({
          pages: inv.pages || [],
          vendor_name: inv.vendor_name || '',
          invoice_number: inv.invoice_number || '',
          total_amount: inv.total_amount?.toString() || '',
          date: inv.date || '',
        }))
      );
    } else {
      // Default: 2 empty parts
      setParts([
        { pages: [], vendor_name: '', invoice_number: '', total_amount: '', date: '' },
        { pages: [], vendor_name: '', invoice_number: '', total_amount: '', date: '' },
      ]);
    }
  }, [splitSuggestion, open]);

  const updatePart = (index: number, field: keyof SplitPart, value: any) => {
    setParts(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addPart = () => {
    setParts(prev => [
      ...prev,
      { pages: [], vendor_name: '', invoice_number: '', total_amount: '', date: '' },
    ]);
  };

  const removePart = (index: number) => {
    if (parts.length <= 2) return;
    setParts(prev => prev.filter((_, i) => i !== index));
  };

  const togglePage = (partIndex: number, page: number) => {
    setParts(prev => {
      const updated = prev.map((part, i) => {
        if (i === partIndex) {
          // Toggle page in this part
          const hasPage = part.pages.includes(page);
          return {
            ...part,
            pages: hasPage
              ? part.pages.filter(p => p !== page)
              : [...part.pages, page].sort((a, b) => a - b),
          };
        } else {
          // Remove page from other parts
          return {
            ...part,
            pages: part.pages.filter(p => p !== page),
          };
        }
      });
      return updated;
    });
  };

  const handleSplit = async () => {
    const validParts = parts.filter(p => p.pages.length > 0);
    
    if (validParts.length < 2) {
      return;
    }

    const splits = validParts.map(p => ({
      pages: p.pages,
      vendor_name: p.vendor_name || undefined,
      invoice_number: p.invoice_number || undefined,
      total_amount: p.total_amount ? parseFloat(p.total_amount) : undefined,
      date: p.date || undefined,
    }));

    const result = await splitPdf(receiptId, splits);
    
    if (result?.success) {
      onOpenChange(false);
      onSplitComplete?.();
    }
  };

  const allPages = Array.from({ length: pageCount }, (_, i) => i + 1);
  const assignedPages = new Set(parts.flatMap(p => p.pages));
  const unassignedPages = allPages.filter(p => !assignedPages.has(p));
  const validPartsCount = parts.filter(p => p.pages.length > 0).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5" />
            PDF aufteilen
          </DialogTitle>
          <DialogDescription>
            Teile das PDF in {parts.length} separate Rechnungen auf.
            Weise jeder Rechnung die entsprechenden Seiten zu.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Page overview */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Seiten im Original ({pageCount} Seiten)
            </Label>
            <div className="flex flex-wrap gap-1">
              {allPages.map(page => {
                const partIndex = parts.findIndex(p => p.pages.includes(page));
                const isAssigned = partIndex !== -1;
                return (
                  <Badge
                    key={page}
                    variant={isAssigned ? 'default' : 'outline'}
                    className={`cursor-default ${
                      isAssigned
                        ? `bg-primary/80`
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    S.{page}
                    {isAssigned && (
                      <span className="ml-1 text-xs opacity-75">
                        →T{partIndex + 1}
                      </span>
                    )}
                  </Badge>
                );
              })}
            </div>
            {unassignedPages.length > 0 && (
              <p className="text-xs text-amber-600">
                {unassignedPages.length} Seite(n) noch nicht zugewiesen
              </p>
            )}
          </div>

          {/* Split parts */}
          <div className="space-y-4">
            {parts.map((part, index) => (
              <div
                key={index}
                className="border rounded-lg p-4 space-y-3 bg-card"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-medium">Teil {index + 1}</span>
                    {part.pages.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {part.pages.length} Seite(n)
                      </Badge>
                    )}
                  </div>
                  {parts.length > 2 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePart(index)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Page selection */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Seiten auswählen
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {allPages.map(page => {
                      const isInThisPart = part.pages.includes(page);
                      const isInOtherPart = parts.some(
                        (p, i) => i !== index && p.pages.includes(page)
                      );
                      return (
                        <Button
                          key={page}
                          variant={isInThisPart ? 'default' : 'outline'}
                          size="sm"
                          className={`h-7 w-10 p-0 text-xs ${
                            isInOtherPart && !isInThisPart
                              ? 'opacity-40'
                              : ''
                          }`}
                          onClick={() => togglePage(index, page)}
                        >
                          {page}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* Optional metadata */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Lieferant (optional)
                    </Label>
                    <Input
                      value={part.vendor_name}
                      onChange={e => updatePart(index, 'vendor_name', e.target.value)}
                      placeholder="z.B. Amazon"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Betrag (optional)
                    </Label>
                    <Input
                      value={part.total_amount}
                      onChange={e => updatePart(index, 'total_amount', e.target.value)}
                      placeholder="z.B. 49.99"
                      type="number"
                      step="0.01"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add part button */}
          <Button
            variant="outline"
            size="sm"
            onClick={addPart}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Weiteren Teil hinzufügen
          </Button>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSplitting}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleSplit}
            disabled={isSplitting || validPartsCount < 2}
            className="gap-2"
          >
            {isSplitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {progress || 'Wird aufgeteilt...'}
              </>
            ) : (
              <>
                <Scissors className="h-4 w-4" />
                In {validPartsCount} Teile aufteilen
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
