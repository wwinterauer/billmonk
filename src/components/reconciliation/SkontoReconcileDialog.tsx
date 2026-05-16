import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

export interface SkontoCandidate {
  transaction_id: string;
  receipt_id: string;
  transaction_date: string | null;
  transaction_amount: number;
  transaction_description: string | null;
  receipt_date: string | null;
  receipt_vendor: string | null;
  receipt_amount: number;
  receipt_invoice_number: string | null;
  deviation_pct: number;
  skonto_amount: number;
  matched_via: ('vendor' | 'invoice_number')[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: SkontoCandidate[];
  exactApplied: number;
  scanned: number;
  onApply: (accepted: { transaction_id: string; receipt_id: string }[]) => Promise<void>;
  isApplying?: boolean;
}

const fmtAmount = (n: number) =>
  new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(n);

export function SkontoReconcileDialog({
  open,
  onOpenChange,
  candidates,
  exactApplied,
  scanned,
  onApply,
  isApplying,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      // Pre-select all by default
      setSelected(new Set(candidates.map((c) => c.transaction_id + ':' + c.receipt_id)));
    }
  }, [open, candidates]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleApply = async () => {
    const accepted = candidates
      .filter((c) => selected.has(c.transaction_id + ':' + c.receipt_id))
      .map((c) => ({ transaction_id: c.transaction_id, receipt_id: c.receipt_id }));
    await onApply(accepted);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Automatischer Belegabgleich
          </DialogTitle>
          <DialogDescription>
            {scanned} Buchungen geprüft · {exactApplied} exakt zugeordnet · {candidates.length} Skonto-Vorschläge
          </DialogDescription>
        </DialogHeader>

        {candidates.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            {exactApplied > 0
              ? 'Alle eindeutigen Treffer wurden direkt zugeordnet. Keine weiteren Skonto-Vorschläge.'
              : 'Keine passenden Belege im Datumsbereich der offenen Buchungen gefunden.'}
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground mb-2">
                Folgende Buchungen weichen 1–5 % vom Belegbetrag ab und enthalten den Lieferantennamen oder die Rechnungsnummer. Wahrscheinlich Skonto-Abzug.
              </div>
              {candidates.map((c) => {
                const key = c.transaction_id + ':' + c.receipt_id;
                const isSelected = selected.has(key);
                return (
                  <div
                    key={key}
                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggle(key)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0 grid grid-cols-12 gap-3 text-sm">
                      <div className="col-span-4">
                        <div className="font-medium truncate">
                          {c.receipt_vendor || '—'}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {c.receipt_invoice_number ? `Rechnung ${c.receipt_invoice_number}` : 'Ohne Rechnungsnummer'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Belegdatum:{' '}
                          {c.receipt_date ? format(new Date(c.receipt_date), 'dd.MM.yyyy') : '—'}
                        </div>
                      </div>
                      <div className="col-span-4">
                        <div className="text-xs text-muted-foreground mb-0.5">Bankbuchung</div>
                        <div className="truncate">{c.transaction_description || '—'}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.transaction_date ? format(new Date(c.transaction_date), 'dd.MM.yyyy') : '—'}
                        </div>
                      </div>
                      <div className="col-span-2 text-right">
                        <div className="text-xs text-muted-foreground">Beleg</div>
                        <div className="font-medium">{fmtAmount(c.receipt_amount)}</div>
                        <div className="text-xs text-muted-foreground mt-1">Bank</div>
                        <div>{fmtAmount(c.transaction_amount)}</div>
                      </div>
                      <div className="col-span-2 text-right">
                        <Badge variant="secondary" className="mb-1">
                          −{c.deviation_pct.toFixed(2)} %
                        </Badge>
                        <div className="text-xs text-muted-foreground">
                          Skonto {fmtAmount(c.skonto_amount)}
                        </div>
                        <div className="flex flex-wrap gap-1 justify-end mt-1">
                          {c.matched_via.includes('vendor') && (
                            <Badge variant="outline" className="text-[10px] py-0">
                              Lieferant
                            </Badge>
                          )}
                          {c.matched_via.includes('invoice_number') && (
                            <Badge variant="outline" className="text-[10px] py-0">
                              Rechnungsnr
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isApplying}>
            {candidates.length === 0 ? 'Schließen' : 'Abbrechen'}
          </Button>
          {candidates.length > 0 && (
            <Button onClick={handleApply} disabled={isApplying || selected.size === 0}>
              {isApplying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selected.size} Skonto-Match{selected.size === 1 ? '' : 'es'} übernehmen
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
