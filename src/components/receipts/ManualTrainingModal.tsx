import { useState } from 'react';
import { GraduationCap, Save, ChevronDown, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { LEARNABLE_FIELDS, type LearnableFieldId } from '@/types/learning';
import { cn } from '@/lib/utils';
import type { Json } from '@/integrations/supabase/types';

export interface FieldHint {
  position?: string;
  label_before?: string;
  format_example?: string;
  notes?: string;
}

interface ManualTrainingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  vendorName: string;
  currentValues: Record<string, unknown>;
}

interface ManualTrainingFieldProps {
  field: typeof LEARNABLE_FIELDS[number];
  currentValue: unknown;
  hint?: FieldHint;
  onHintChange: (hint: FieldHint) => void;
}

const POSITION_OPTIONS = [
  { value: 'top_left', label: 'Oben links' },
  { value: 'top_right', label: 'Oben rechts' },
  { value: 'top_center', label: 'Oben mittig' },
  { value: 'middle', label: 'Mitte' },
  { value: 'bottom_left', label: 'Unten links' },
  { value: 'bottom_right', label: 'Unten rechts' },
  { value: 'table', label: 'In einer Tabelle' },
];

function ManualTrainingField({
  field,
  currentValue,
  hint = {},
  onHintChange,
}: ManualTrainingFieldProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getPlaceholder = () => {
    switch (field.id) {
      case 'invoice_number':
        return 'z.B. RE-2024-001';
      case 'receipt_date':
        return 'z.B. 15.01.2024';
      case 'amount_gross':
        return 'z.B. € 123,45';
      case 'amount_net':
        return 'z.B. € 102,88';
      case 'vat_amount':
        return 'z.B. € 20,57';
      case 'vat_rate':
        return 'z.B. 20%';
      default:
        return 'Beispiel eingeben...';
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        className={cn(
          "flex items-center justify-between w-full p-3 text-left transition-colors",
          isExpanded ? "bg-muted/50" : "hover:bg-muted/30"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium">{field.label}</span>
          {currentValue && (
            <Badge variant="outline" className="text-xs">
              Aktuell: {String(currentValue)}
            </Badge>
          )}
          {(hint.position || hint.label_before || hint.format_example) && (
            <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
              Hinweise gesetzt
            </Badge>
          )}
        </div>
        <ChevronDown 
          className={cn(
            "w-4 h-4 transition-transform text-muted-foreground",
            isExpanded && "rotate-180"
          )} 
        />
      </button>

      {isExpanded && (
        <div className="p-3 pt-0 space-y-3 border-t bg-muted/20">
          <div className="pt-3">
            {/* Position */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Wo steht dieses Feld typischerweise?
              </Label>
              <Select
                value={hint.position || ''}
                onValueChange={(v) => onHintChange({ ...hint, position: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Position auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {POSITION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Label Before */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Welche Beschriftung steht davor?
            </Label>
            <Input
              value={hint.label_before || ''}
              onChange={(e) => onHintChange({ ...hint, label_before: e.target.value })}
              placeholder="z.B. 'Rechnungsnr.:', 'Datum:', 'Summe:'"
            />
          </div>

          {/* Format Example */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Typisches Format (Beispiel)
            </Label>
            <Input
              value={hint.format_example || ''}
              onChange={(e) => onHintChange({ ...hint, format_example: e.target.value })}
              placeholder={getPlaceholder()}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Besondere Hinweise (optional)
            </Label>
            <Textarea
              value={hint.notes || ''}
              onChange={(e) => onHintChange({ ...hint, notes: e.target.value })}
              placeholder="z.B. 'Hat immer Präfix RE-', 'Steht nach dem Logo'"
              rows={2}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function ManualTrainingModal({
  open,
  onOpenChange,
  vendorId,
  vendorName,
  currentValues,
}: ManualTrainingModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [manualHints, setManualHints] = useState<Record<string, FieldHint>>({});

  const handleHintChange = (fieldId: string, hint: FieldHint) => {
    setManualHints(prev => ({
      ...prev,
      [fieldId]: hint,
    }));
  };

  const analyzeFormatExample = (example: string) => {
    const prefixes: string[] = [];
    
    // Detect common prefixes like "RE-", "INV-", "R-", etc.
    const prefixMatch = example.match(/^([A-Za-z]{1,5}[-_]?)/);
    if (prefixMatch && prefixMatch[1].length > 1) {
      prefixes.push(prefixMatch[1]);
    }
    
    return { prefixes };
  };

  const saveManualTraining = async () => {
    if (!user || !vendorId) return;
    
    setSaving(true);
    
    try {
      // 1. Get or create vendor learning record
      let { data: learning } = await supabase
        .from('vendor_learning')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!learning) {
        const { data: newLearning, error: createError } = await supabase
          .from('vendor_learning')
          .insert({
            user_id: user.id,
            vendor_id: vendorId,
          })
          .select()
          .single();

        if (createError) throw createError;
        learning = newLearning;
      }

      // 2. Convert hints to layout_hints format
      const layoutHints: Record<string, { 
        position?: string; 
        near_text?: string; 
        format?: string; 
        notes?: string; 
      }> = {};
      
      // 3. Update field_patterns with format examples
      const existingPatterns = (learning.field_patterns || {}) as Record<string, {
        prefixes?: string[];
        suffixes?: string[];
        confidence?: number;
      }>;
      const updatedPatterns = { ...existingPatterns };

      for (const [fieldId, hint] of Object.entries(manualHints)) {
        if (hint && (hint.position || hint.label_before || hint.format_example || hint.notes)) {
          layoutHints[fieldId] = {
            position: hint.position,
            near_text: hint.label_before,
            format: hint.format_example,
            notes: hint.notes,
          };

          // Analyze format example for patterns
          if (hint.format_example) {
            const { prefixes } = analyzeFormatExample(hint.format_example);
            
            if (prefixes.length > 0) {
              const fieldPatterns = updatedPatterns[fieldId] || { prefixes: [], suffixes: [], confidence: 60 };
              const existingPrefixes = fieldPatterns.prefixes || [];
              
              // Add new prefixes that don't exist
              for (const prefix of prefixes) {
                if (!existingPrefixes.includes(prefix)) {
                  existingPrefixes.push(prefix);
                }
              }
              
              fieldPatterns.prefixes = existingPrefixes;
              fieldPatterns.confidence = Math.max(fieldPatterns.confidence || 60, 65);
              updatedPatterns[fieldId] = fieldPatterns;
            }
          }
        }
      }

      // 4. Count how many hints were provided
      const hintsCount = Object.keys(layoutHints).length;

      if (hintsCount === 0) {
        toast({
          title: "Keine Hinweise",
          description: "Bitte gib mindestens einen Hinweis ein.",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      // 5. Save to database
      const { error: updateError } = await supabase
        .from('vendor_learning')
        .update({
          layout_hints: layoutHints as unknown as Json,
          field_patterns: updatedPatterns as unknown as Json,
          learning_level: Math.max(learning.learning_level ?? 0, 1),
          updated_at: new Date().toISOString(),
        })
        .eq('id', learning.id);

      if (updateError) throw updateError;

      toast({
        title: "Training gespeichert!",
        description: `${hintsCount} Hinweis(e) für "${vendorName}" gespeichert. Die KI wird diese bei zukünftigen Rechnungen nutzen.`,
      });

      setManualHints({});
      onOpenChange(false);

    } catch (error) {
      console.error('Error saving manual training:', error);
      toast({
        title: "Fehler",
        description: "Training konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Only show first 6 learnable fields for training
  const trainingFields = LEARNABLE_FIELDS.slice(0, 6);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-orange-500" />
            Manuelles KI-Training
          </DialogTitle>
          <DialogDescription>
            Hilf der KI, Rechnungen von "{vendorName}" besser zu erkennen
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Instructions */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex gap-2">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium mb-1">So funktioniert's:</p>
              <p>
                Gib für jedes Feld an, wie der Wert auf Rechnungen dieses Lieferanten 
                typischerweise aussieht. Die KI wird diese Hinweise bei zukünftigen 
                Rechnungen berücksichtigen.
              </p>
            </div>
          </div>

          {/* Field Hints */}
          <div className="space-y-2">
            {trainingFields.map(field => (
              <ManualTrainingField
                key={field.id}
                field={field}
                currentValue={currentValues[field.id]}
                hint={manualHints[field.id]}
                onHintChange={(hint) => handleHintChange(field.id, hint)}
              />
            ))}
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={saveManualTraining} disabled={saving}>
            {saving ? (
              <>Speichere...</>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Training speichern
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
