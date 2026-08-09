import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Sparkles, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';

export interface SkontoCandidate {
  transaction_id: string;
  receipt_id: string;
  split_line_id?: string | null;
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

export interface SuggestionAlternative {
  key: string;
  receipt_id: string;
  split_line_id: string | null;
  receipt_date: string | null;
  receipt_vendor: string | null;
  receipt_amount: number;
  receipt_invoice_number: string | null;
}

export interface MatchSuggestion {
  transaction_id: string;
  transaction_date: string | null;
  transaction_amount: number;
  transaction_description: string | null;
  receipt_id: string;
  split_line_id: string | null;
  receipt_date: string | null;
  receipt_vendor: string | null;
  receipt_amount: number;
  receipt_invoice_number: string | null;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  alternatives: SuggestionAlternative[];
}

export interface AcceptedPair {
  transaction_id: string;
  receipt_id: string;
  split_line_id?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: SkontoCandidate[];
  suggestions?: MatchSuggestion[];
  exactApplied: number;
  scanned: number;
  onApply: (accepted: AcceptedPair[]) => Promise<void>;
  onShowReceipt?: (receiptId: string) => void;
  isApplying?: boolean;
}

const fmtAmount = (n: number) =>
  new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(n);

const fmtDate = (d: string | null) => (d ? format(new Date(d), 'dd.MM.yyyy') : '—');

const confidenceLabel: Record<MatchSuggestion['confidence'], string> = {
  high: 'Sehr wahrscheinlich',
  medium: 'Wahrscheinlich',
  low: 'Unsicher',
};

export function SkontoReconcileDialog({
  open,
  onOpenChange,
  candidates,
  suggestions = [],
  exactApplied,
  scanned,
  onApply,
  onShowReceipt,
  isApplying,
}: Props) {
  const [selectedSkonto, setSelectedSkonto] = useState<Set<string>>(new Set());
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  /** transaction_id -> chosen alternative (overrides the primary suggestion) */
  const [overrides, setOverrides] = useState<Record<string, SuggestionAlternative>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'suggestions' | 'skonto'>('suggestions');

  useEffect(() => {
    if (!open) return;
    setSelectedSkonto(new Set(candidates.map((c) => c.transaction_id + ':' + c.receipt_id)));
    // Only pre-select confident suggestions — unsure ones need a decision
    setSelectedSuggestions(
      new Set(suggestions.filter((s) => s.confidence === 'high').map((s) => s.transaction_id)),
    );
    setOverrides({});
    setExpanded(new Set());
    setTab(suggestions.length > 0 ? 'suggestions' : 'skonto');
  }, [open, candidates, suggestions]);

  const toggleSet = (setter: typeof setSelectedSkonto) => (key: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleSkonto = toggleSet(setSelectedSkonto);
  const toggleSuggestion = toggleSet(setSelectedSuggestions);
  const toggleExpanded = toggleSet(setExpanded);

  const chosenFor = (s: MatchSuggestion) => {
    const o = overrides[s.transaction_id];
    return o
      ? {
          receipt_id: o.receipt_id,
          split_line_id: o.split_line_id,
          receipt_vendor: o.receipt_vendor,
          receipt_date: o.receipt_date,
          receipt_amount: o.receipt_amount,
          receipt_invoice_number: o.receipt_invoice_number,
        }
      : {
          receipt_id: s.receipt_id,
          split_line_id: s.split_line_id,
          receipt_vendor: s.receipt_vendor,
          receipt_date: s.receipt_date,
          receipt_amount: s.receipt_amount,
          receipt_invoice_number: s.receipt_invoice_number,
        };
  };

  const totalSelected = selectedSkonto.size + selectedSuggestions.size;

  const acceptedPairs = useMemo<AcceptedPair[]>(() => {
    const fromSkonto = candidates
      .filter((c) => selectedSkonto.has(c.transaction_id + ':' + c.receipt_id))
      .map((c) => ({
        transaction_id: c.transaction_id,
        receipt_id: c.receipt_id,
        split_line_id: c.split_line_id ?? null,
      }));
    const fromSuggestions = suggestions
      .filter((s) => selectedSuggestions.has(s.transaction_id))
      .map((s) => {
        const chosen = chosenFor(s);
        return {
          transaction_id: s.transaction_id,
          receipt_id: chosen.receipt_id,
          split_line_id: chosen.split_line_id ?? null,
        };
      });
    return [...fromSkonto, ...fromSuggestions];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, suggestions, selectedSkonto, selectedSuggestions, overrides]);

  const handleApply = async () => {
    await onApply(acceptedPairs);
  };

  const nothingToShow = candidates.length === 0 && suggestions.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Automatischer Belegabgleich
          </DialogTitle>
          <DialogDescription>
            {scanned} Buchungen geprüft · {exactApplied} automatisch zugeordnet · {suggestions.length} Vorschläge · {candidates.length} Skonto-Vorschläge
          </DialogDescription>
        </DialogHeader>

        {nothingToShow ? (
          <div className="py-8 text-center text-muted-foreground">
            {exactApplied > 0
              ? 'Alle eindeutigen Treffer wurden direkt zugeordnet. Keine weiteren Vorschläge.'
              : 'Keine passenden Belege im Datumsbereich der offenen Buchungen gefunden.'}
          </div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="suggestions">
                Vorschläge {suggestions.length > 0 && `(${suggestions.length})`}
              </TabsTrigger>
              <TabsTrigger value="skonto">
                Skonto {candidates.length > 0 && `(${candidates.length})`}
              </TabsTrigger>
            </TabsList>

            {/* ---------------- Suggestions ---------------- */}
            <TabsContent value="suggestions">
              {suggestions.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  Keine weiteren Vorschläge.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">
                      Betrag und Zeitraum passen, die Zuordnung ist aber nicht eindeutig. Bitte prüfen und bestätigen.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedSuggestions(new Set(suggestions.map((s) => s.transaction_id)))}
                      >
                        Alle
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedSuggestions(new Set())}>
                        Keine
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="max-h-[55vh] pr-4">
                    <div className="space-y-2">
                      {suggestions.map((s) => {
                        const chosen = chosenFor(s);
                        const isSelected = selectedSuggestions.has(s.transaction_id);
                        const isOpen = expanded.has(s.transaction_id);
                        return (
                          <div key={s.transaction_id} className="border rounded-lg">
                            <div className="flex items-start gap-3 p-3 hover:bg-muted/30 transition-colors">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSuggestion(s.transaction_id)}
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0 grid grid-cols-12 gap-3 text-sm">
                                <div className="col-span-4">
                                  <div className="text-xs text-muted-foreground mb-0.5">Bankbuchung</div>
                                  <div className="truncate">{s.transaction_description || '—'}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {fmtDate(s.transaction_date)} · {fmtAmount(s.transaction_amount)}
                                  </div>
                                </div>
                                <div className="col-span-5">
                                  <div className="text-xs text-muted-foreground mb-0.5">Vorgeschlagener Beleg</div>
                                  <div className="font-medium truncate">{chosen.receipt_vendor || '—'}</div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {chosen.receipt_invoice_number
                                      ? `Rechnung ${chosen.receipt_invoice_number}`
                                      : 'Ohne Rechnungsnummer'}{' '}
                                    · {fmtDate(chosen.receipt_date)} · {fmtAmount(chosen.receipt_amount)}
                                  </div>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {s.reasons.map((r) => (
                                      <Badge key={r} variant="outline" className="text-[10px] py-0">
                                        {r}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                                <div className="col-span-3 flex flex-col items-end gap-1">
                                  <Badge
                                    variant={s.confidence === 'high' ? 'default' : s.confidence === 'medium' ? 'secondary' : 'outline'}
                                  >
                                    {confidenceLabel[s.confidence]}
                                  </Badge>
                                  {onShowReceipt && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2"
                                      onClick={() => onShowReceipt(chosen.receipt_id)}
                                    >
                                      <Eye className="h-3.5 w-3.5 mr-1" />
                                      Beleg ansehen
                                    </Button>
                                  )}
                                  {s.alternatives.length > 0 && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2"
                                      onClick={() => toggleExpanded(s.transaction_id)}
                                    >
                                      {isOpen ? (
                                        <ChevronUp className="h-3.5 w-3.5 mr-1" />
                                      ) : (
                                        <ChevronDown className="h-3.5 w-3.5 mr-1" />
                                      )}
                                      {s.alternatives.length} Alternativen
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {isOpen && s.alternatives.length > 0 && (
                              <div className="border-t bg-muted/20 p-2 space-y-1">
                                {s.alternatives.map((alt) => (
                                  <div
                                    key={alt.key}
                                    className="flex items-center justify-between gap-2 text-xs px-2 py-1 rounded hover:bg-muted"
                                  >
                                    <div className="min-w-0">
                                      <span className="font-medium">{alt.receipt_vendor || '—'}</span>{' '}
                                      <span className="text-muted-foreground">
                                        {alt.receipt_invoice_number ? `· ${alt.receipt_invoice_number}` : ''} ·{' '}
                                        {fmtDate(alt.receipt_date)} · {fmtAmount(alt.receipt_amount)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {onShowReceipt && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 px-2"
                                          onClick={() => onShowReceipt(alt.receipt_id)}
                                        >
                                          <Eye className="h-3 w-3" />
                                        </Button>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 px-2"
                                        onClick={() =>
                                          setOverrides((prev) => ({ ...prev, [s.transaction_id]: alt }))
                                        }
                                      >
                                        Auswählen
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </>
              )}
            </TabsContent>

            {/* ---------------- Skonto ---------------- */}
            <TabsContent value="skonto">
              {candidates.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">Keine Skonto-Vorschläge.</div>
              ) : (
                <ScrollArea className="max-h-[55vh] pr-4">
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground mb-2">
                      Folgende Buchungen weichen 1–5 % vom Belegbetrag ab und enthalten den Lieferantennamen oder die Rechnungsnummer. Wahrscheinlich Skonto-Abzug.
                    </div>
                    {candidates.map((c) => {
                      const key = c.transaction_id + ':' + c.receipt_id;
                      const isSelected = selectedSkonto.has(key);
                      return (
                        <div
                          key={key}
                          className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                        >
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleSkonto(key)} className="mt-1" />
                          <div className="flex-1 min-w-0 grid grid-cols-12 gap-3 text-sm">
                            <div className="col-span-4">
                              <div className="font-medium truncate">{c.receipt_vendor || '—'}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {c.receipt_invoice_number ? `Rechnung ${c.receipt_invoice_number}` : 'Ohne Rechnungsnummer'}
                              </div>
                              <div className="text-xs text-muted-foreground">Belegdatum: {fmtDate(c.receipt_date)}</div>
                              {onShowReceipt && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 mt-1"
                                  onClick={() => onShowReceipt(c.receipt_id)}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  Beleg ansehen
                                </Button>
                              )}
                            </div>
                            <div className="col-span-4">
                              <div className="text-xs text-muted-foreground mb-0.5">Bankbuchung</div>
                              <div className="truncate">{c.transaction_description || '—'}</div>
                              <div className="text-xs text-muted-foreground">{fmtDate(c.transaction_date)}</div>
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
                              <div className="text-xs text-muted-foreground">Skonto {fmtAmount(c.skonto_amount)}</div>
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
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isApplying}>
            {nothingToShow ? 'Schließen' : 'Abbrechen'}
          </Button>
          {!nothingToShow && (
            <Button onClick={handleApply} disabled={isApplying || totalSelected === 0}>
              {isApplying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {totalSelected} Zuordnung{totalSelected === 1 ? '' : 'en'} übernehmen
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
