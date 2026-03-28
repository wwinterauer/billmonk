import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Trash2, AlertTriangle, Check, X, Split, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCategories } from '@/hooks/useCategories';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const VAT_RATES = [
  { value: '20', label: '20%' },
  { value: '19', label: '19%' },
  { value: '13', label: '13%' },
  { value: '10', label: '10%' },
  { value: '7', label: '7%' },
  { value: '0', label: '0%' },
];

export interface SplitLine {
  id?: string;
  sort_order: number;
  description: string;
  category: string;
  amount_gross: number;
  amount_net: number;
  vat_rate: number;
  vat_amount: number;
  is_private: boolean;
  _lastEdited?: 'gross' | 'net';
}

interface SplitBookingEditorProps {
  receiptId: string;
  totalGross: number;
  mainCategory?: string;
  mainVatRate?: number;
  onSplitChange?: (isSplit: boolean) => void;
}

const createEmptyLine = (sortOrder: number, category = '', vatRate = 20): SplitLine => ({
  sort_order: sortOrder,
  description: '',
  category,
  amount_gross: 0,
  amount_net: 0,
  vat_rate: vatRate,
  vat_amount: 0,
  is_private: false,
  _lastEdited: 'gross',
});

const recalcLine = (line: SplitLine, field: 'gross' | 'net' | 'vat_rate'): SplitLine => {
  const updated = { ...line };
  if (field === 'gross' || (field === 'vat_rate' && line._lastEdited === 'gross')) {
    updated.amount_net = +(updated.amount_gross / (1 + updated.vat_rate / 100)).toFixed(2);
    updated._lastEdited = field === 'gross' ? 'gross' : updated._lastEdited;
  } else {
    updated.amount_gross = +(updated.amount_net * (1 + updated.vat_rate / 100)).toFixed(2);
    updated._lastEdited = field === 'net' ? 'net' : updated._lastEdited;
  }
  updated.vat_amount = +(updated.amount_gross - updated.amount_net).toFixed(2);
  return updated;
};

export function SplitBookingEditor({ receiptId, totalGross, mainCategory, mainVatRate, onSplitChange }: SplitBookingEditorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { categories } = useCategories();
  const [lines, setLines] = useState<SplitLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [loadingAiSuggestions, setLoadingAiSuggestions] = useState(false);

  // Load existing split lines
  useEffect(() => {
    if (!receiptId || !user) return;
    const load = async () => {
      setLoading(true);
      // Check if receipt is split
      const { data: receipt } = await supabase
        .from('receipts')
        .select('is_split_booking')
        .eq('id', receiptId)
        .single();

      const isSplit = !!(receipt as any)?.is_split_booking;
      setIsActive(isSplit);

      if (isSplit) {
        const { data: splitLines } = await supabase
          .from('receipt_split_lines')
          .select('*')
          .eq('receipt_id', receiptId)
          .order('sort_order');

        if (splitLines && splitLines.length > 0) {
          setLines(splitLines.map(sl => ({
            id: sl.id,
            sort_order: sl.sort_order,
            description: sl.description || '',
            category: sl.category || '',
            amount_gross: Number(sl.amount_gross) || 0,
            amount_net: Number(sl.amount_net) || 0,
            vat_rate: Number(sl.vat_rate) || 20,
            vat_amount: Number(sl.vat_amount) || 0,
            is_private: sl.is_private || false,
            _lastEdited: 'gross' as const,
          })));
        }
      }
      setLoading(false);
    };
    load();
  }, [receiptId, user]);

  const activateSplit = useCallback(() => {
    const vatRate = mainVatRate ?? 20;
    const firstLine = createEmptyLine(0, mainCategory || '', vatRate);
    firstLine.amount_gross = totalGross;
    const recalced = recalcLine(firstLine, 'gross');
    setLines([recalced]);
    setIsActive(true);
  }, [totalGross, mainCategory, mainVatRate]);

  const addLine = useCallback(() => {
    setLines(prev => [...prev, createEmptyLine(prev.length, '', mainVatRate ?? 20)]);
  }, [mainVatRate]);

  const removeLine = useCallback((idx: number) => {
    setLines(prev => prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, sort_order: i })));
  }, []);

  const updateLine = useCallback((idx: number, field: keyof SplitLine, value: any) => {
    setLines(prev => prev.map((line, i) => {
      if (i !== idx) return line;
      const updated = { ...line, [field]: value };
      if (field === 'amount_gross') {
        updated.amount_gross = parseFloat(value) || 0;
        return recalcLine(updated, 'gross');
      }
      if (field === 'amount_net') {
        updated.amount_net = parseFloat(value) || 0;
        return recalcLine(updated, 'net');
      }
      if (field === 'vat_rate') {
        updated.vat_rate = parseFloat(value) || 0;
        return recalcLine(updated, 'vat_rate');
      }
      return updated;
    }));
  }, []);

  // Sum validation
  const totals = useMemo(() => {
    const sumGross = lines.reduce((s, l) => s + l.amount_gross, 0);
    const diff = Math.abs(sumGross - totalGross);
    const isValid = diff <= 0.02;
    return { sumGross: +sumGross.toFixed(2), diff: +diff.toFixed(2), isValid };
  }, [lines, totalGross]);

  const handleSave = async () => {
    if (!user || !receiptId) return;
    setSaving(true);
    try {
      // Delete existing split lines
      await supabase
        .from('receipt_split_lines')
        .delete()
        .eq('receipt_id', receiptId);

      // Insert new lines
      const inserts = lines.map((l, i) => ({
        receipt_id: receiptId,
        user_id: user.id,
        sort_order: i,
        description: l.description || null,
        category: l.category || null,
        amount_gross: l.amount_gross,
        amount_net: l.amount_net,
        vat_rate: l.vat_rate,
        vat_amount: l.vat_amount,
        is_private: l.is_private,
      }));

      const { error: insertError } = await supabase
        .from('receipt_split_lines')
        .insert(inserts);

      if (insertError) throw insertError;

      // Mark receipt as split
      await supabase
        .from('receipts')
        .update({ is_split_booking: true } as any)
        .eq('id', receiptId);

      onSplitChange?.(true);
      toast({ title: 'Splitbuchung gespeichert', description: `${lines.length} Positionen gespeichert.` });
    } catch (err) {
      toast({ title: 'Fehler', description: 'Splitbuchung konnte nicht gespeichert werden.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveSplit = async () => {
    if (!user || !receiptId) return;
    setSaving(true);
    try {
      await supabase
        .from('receipt_split_lines')
        .delete()
        .eq('receipt_id', receiptId);

      await supabase
        .from('receipts')
        .update({ is_split_booking: false } as any)
        .eq('id', receiptId);

      setLines([]);
      setIsActive(false);
      onSplitChange?.(false);
      toast({ title: 'Splitbuchung aufgehoben' });
    } catch {
      toast({ title: 'Fehler', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleLoadAiSuggestions = async () => {
    if (!receiptId) return;
    setLoadingAiSuggestions(true);
    try {
      // Load line_items_raw from receipt
      const { data: receipt } = await supabase
        .from('receipts')
        .select('line_items_raw')
        .eq('id', receiptId)
        .single();

      const lineItems = (receipt as any)?.line_items_raw;
      if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
        toast({ title: 'Keine KI-Positionen', description: 'Für diesen Beleg wurden keine Rechnungspositionen erkannt. Analysiere den Beleg erneut.', variant: 'destructive' });
        return;
      }

      const newLines: SplitLine[] = lineItems.map((item: any, idx: number) => {
        const vatRate = item.vat_rate ?? mainVatRate ?? 20;
        const grossAmount = item.amount_gross ?? 0;
        const netAmount = item.amount_net ?? +(grossAmount / (1 + vatRate / 100)).toFixed(2);
        const vatAmount = +(grossAmount - netAmount).toFixed(2);
        return {
          sort_order: idx,
          description: item.description || '',
          category: item.category || mainCategory || '',
          amount_gross: grossAmount,
          amount_net: netAmount,
          vat_rate: vatRate,
          vat_amount: vatAmount,
          is_private: false,
          _lastEdited: 'gross' as const,
        };
      });

      setLines(newLines);
      toast({ title: 'KI-Vorschläge geladen', description: `${newLines.length} Positionen aus der KI-Analyse übernommen.` });
    } catch {
      toast({ title: 'Fehler', description: 'KI-Vorschläge konnten nicht geladen werden.', variant: 'destructive' });
    } finally {
      setLoadingAiSuggestions(false);
    }
  };

  if (loading) return null;

  if (!isActive) {
    return (
      <Button variant="outline" size="sm" onClick={activateSplit} className="gap-2">
        <Split className="h-4 w-4" />
        Beleg aufteilen
      </Button>
    );
  }

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Split className="h-4 w-4 text-primary" />
          <Label className="font-semibold">Splitbuchung</Label>
          <Badge variant="secondary" className="text-xs">{lines.length} Positionen</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleRemoveSplit} className="text-destructive gap-1">
            <X className="h-3 w-3" />
            Aufheben
          </Button>
        </div>
      </div>

      {/* Split Lines */}
      <div className="space-y-3">
        {lines.map((line, idx) => (
          <div key={idx} className="grid gap-2 p-3 border rounded-md bg-background">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Position {idx + 1}</span>
              {lines.length > 1 && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeLine(idx)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Description */}
              <div className="col-span-2">
                <Input
                  placeholder="Beschreibung"
                  value={line.description}
                  onChange={e => updateLine(idx, 'description', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              {/* Category */}
              <div className="col-span-2">
                <Select value={line.category} onValueChange={v => updateLine(idx, 'category', v)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Kategorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
              {/* Gross */}
              <div>
                <Label className="text-xs text-muted-foreground">Brutto</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={line.amount_gross || ''}
                  onChange={e => updateLine(idx, 'amount_gross', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              {/* Net */}
              <div>
                <Label className="text-xs text-muted-foreground">Netto</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={line.amount_net || ''}
                  onChange={e => updateLine(idx, 'amount_net', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              {/* VAT Rate */}
              <div>
                <Label className="text-xs text-muted-foreground">MwSt %</Label>
                <Select value={line.vat_rate.toString()} onValueChange={v => updateLine(idx, 'vat_rate', v)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VAT_RATES.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* VAT Amount (readonly) */}
              <div>
                <Label className="text-xs text-muted-foreground">MwSt €</Label>
                <Input
                  type="number"
                  value={line.vat_amount.toFixed(2)}
                  readOnly
                  className="h-8 text-sm bg-muted"
                />
              </div>
              {/* Private */}
              <div className="flex items-center gap-1.5 pb-1">
                <Checkbox
                  id={`private-${idx}`}
                  checked={line.is_private}
                  onCheckedChange={v => updateLine(idx, 'is_private', !!v)}
                />
                <Label htmlFor={`private-${idx}`} className="text-xs">Privat</Label>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add line */}
      <Button variant="outline" size="sm" onClick={addLine} className="gap-1 w-full">
        <Plus className="h-3 w-3" />
        Position hinzufügen
      </Button>

      {/* Sum validation */}
      <div className={cn(
        'flex items-center justify-between p-3 rounded-md text-sm border',
        totals.isValid 
          ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300' 
          : 'bg-destructive/10 border-destructive/30 text-destructive'
      )}>
        <div className="flex items-center gap-2">
          {totals.isValid ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <span>
            Summe: €{totals.sumGross.toFixed(2)} / Beleg: €{totalGross.toFixed(2)}
          </span>
        </div>
        {!totals.isValid && (
          <span className="font-medium">Differenz: €{totals.diff.toFixed(2)}</span>
        )}
      </div>

      {/* Save */}
      <Button
        onClick={handleSave}
        disabled={saving || !totals.isValid || lines.length < 2}
        className="w-full gap-2"
        size="sm"
      >
        {saving ? <span className="animate-spin">⏳</span> : <Check className="h-4 w-4" />}
        Splitbuchung speichern
      </Button>
    </div>
  );
}
