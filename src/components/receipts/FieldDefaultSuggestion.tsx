import { useState, useEffect } from 'react';
import { Check, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useVendorFieldDefaults, type FieldSuggestion } from '@/hooks/useVendorFieldDefaults';
import { useToast } from '@/hooks/use-toast';

const FIELD_LABELS: Record<string, string> = {
  payment_method: 'Zahlungsart',
  category: 'Kategorie',
  tax_type: 'Buchungsart',
  tax_rate: 'MwSt-Satz',
};

interface FieldDefaultSuggestionProps {
  vendorId: string | null;
  vendorName: string;
  /** Called after accepting so parent can refresh */
  onAccepted?: () => void;
}

export function FieldDefaultSuggestion({ vendorId, vendorName, onAccepted }: FieldDefaultSuggestionProps) {
  const { getSuggestions, acceptSuggestion, dismissSuggestion } = useVendorFieldDefaults();
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<FieldSuggestion[]>([]);

  useEffect(() => {
    if (!vendorId || !vendorName) {
      setSuggestions([]);
      return;
    }

    getSuggestions(vendorId, vendorName).then(setSuggestions);
  }, [vendorId, vendorName, getSuggestions]);

  if (suggestions.length === 0) return null;

  const handleAccept = async (s: FieldSuggestion) => {
    await acceptSuggestion(s.vendorId, s.field as any, s.value);
    setSuggestions(prev => prev.filter(x => !(x.field === s.field && x.vendorId === s.vendorId)));
    toast({ title: `${FIELD_LABELS[s.field]} "${s.value}" als Standard für ${s.vendorName} gespeichert` });
    onAccepted?.();
  };

  const handleDismiss = async (s: FieldSuggestion) => {
    await dismissSuggestion(s.vendorId, s.field as any, s.value);
    setSuggestions(prev => prev.filter(x => !(x.field === s.field && x.vendorId === s.vendorId)));
  };

  return (
    <div className="space-y-2">
      {suggestions.map((s) => (
        <Alert key={`${s.field}-${s.vendorId}`} className="py-2 px-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
            <AlertDescription className="flex-1 text-sm">
              <strong>{FIELD_LABELS[s.field]}</strong> bei {s.vendorName} meistens <strong>"{s.value}"</strong> ({s.count}×). Als Standard hinterlegen?
            </AlertDescription>
            <div className="flex gap-1 flex-shrink-0">
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleAccept(s)}>
                <Check className="h-3.5 w-3.5 mr-1" />
                Ja
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground" onClick={() => handleDismiss(s)}>
                <X className="h-3.5 w-3.5 mr-1" />
                Nein
              </Button>
            </div>
          </div>
        </Alert>
      ))}
    </div>
  );
}
