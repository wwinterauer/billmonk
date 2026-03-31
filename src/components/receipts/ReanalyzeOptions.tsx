import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  RefreshCw,
  Loader2,
  ChevronDown,
  Sparkles,
  FileText,
  Building,
  Briefcase,
  Hash,
  CalendarIcon,
  Euro,
  Percent,
  MousePointer,
  Square,
  AlertTriangle,
  X,
  Plus,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// Fields that can be selectively re-analyzed by AI
// Fields that can be selectively re-analyzed by AI
// IMPORTANT: vendor = Rechtlicher Firmenname, vendor_brand = Markenname
const REANALYZABLE_FIELDS = [
  { id: 'vendor_brand', label: 'Markenname', icon: Building },
  { id: 'vendor', label: 'Rechtl. Firmenname', icon: Briefcase },
  { id: 'invoice_number', label: 'Rechnungsnummer', icon: Hash },
  { id: 'receipt_date', label: 'Datum', icon: CalendarIcon },
  { id: 'amount_gross', label: 'Bruttobetrag', icon: Euro },
  { id: 'amount_net', label: 'Nettobetrag', icon: Euro },
  { id: 'vat_rate', label: 'MwSt-Satz', icon: Percent },
  { id: 'vat_amount', label: 'Vorsteuer', icon: Percent },
  { id: 'description', label: 'Beschreibung', icon: FileText },
  { id: 'category', label: 'Kategorie', icon: Briefcase },
] as const;

interface ReanalyzeOptionsProps {
  receiptId: string;
  fileUrl: string | null;
  fileName: string | null;
  signedUrl: string | null;
  userModifiedFields?: string[];
  currentFormData: {
    vendor?: string;
    vendor_brand?: string;
    description?: string;
    invoice_number?: string;
    receipt_date?: Date | null;
    amount_gross?: string;
    vat_rate?: string;
    category?: string;
  };
  onFieldsUpdated: (updates: {
    vendor?: string;
    vendor_brand?: string;
    description?: string;
    invoice_number?: string;
    receipt_date?: Date;
    amount_gross?: string;
    vat_rate?: string;
    category?: string;
    confidence?: number;
  }) => void;
  onReanalyzeComplete?: () => void;
  disabled?: boolean;
  vendorId?: string;
  vendorExpensesOnly?: boolean;
  vendorExtractionKeywords?: string[];
  vendorExtractionHint?: string;
  onExpensesOnlyReanalyze?: (rememberForVendor: boolean, keywords?: string[], extractionHint?: string) => void;
}

export function ReanalyzeOptions({
  receiptId,
  fileUrl,
  fileName,
  signedUrl,
  userModifiedFields = [],
  currentFormData,
  onFieldsUpdated,
  onReanalyzeComplete,
  disabled = false,
  vendorId,
  vendorExpensesOnly = false,
  vendorExtractionKeywords = [],
  vendorExtractionHint = '',
  onExpensesOnlyReanalyze,
}: ReanalyzeOptionsProps) {
  const { toast } = useToast();

  const [isRerunning, setIsRerunning] = useState(false);
  const [showFieldSelectDialog, setShowFieldSelectDialog] = useState(false);
  const [showFullReanalyzeConfirm, setShowFullReanalyzeConfirm] = useState(false);
  const [selectedReanalysisFields, setSelectedReanalysisFields] = useState<string[]>([]);
  const [showExpensesOnlyConfirm, setShowExpensesOnlyConfirm] = useState(false);
  const [rememberExpensesOnly, setRememberExpensesOnly] = useState(false);
  const [dialogKeywords, setDialogKeywords] = useState<string[]>([]);
  const [newKeywordInput, setNewKeywordInput] = useState('');
  const [dialogExtractionHint, setDialogExtractionHint] = useState('');

  // AI Re-run handler - supports selective field reanalysis
  // Uses receiptId path to ensure vendor settings (expenses_only, keywords) are loaded
  const reanalyzeFields = async (fieldsToUpdate: string[]) => {
    if (!fileUrl || isRerunning || !receiptId) return;
    if (fieldsToUpdate.length === 0) return;

    setIsRerunning(true);

    try {
      // Call edge function with receiptId so vendor settings are loaded
      const { data, error } = await supabase.functions.invoke('extract-receipt', {
        body: { receiptId, forceExtract: true, skipMultiCheck: true }
      });

      if (error) throw new Error(error.message || 'KI-Analyse fehlgeschlagen');
      if (!data?.success || !data?.data) {
        throw new Error(data?.error || 'KI-Erkennung hat keine Daten zurückgegeben');
      }

      const normalized = data.data;

      // Build updates based on selected fields
      const updates: Parameters<typeof onFieldsUpdated>[0] = {};
      const changes: string[] = [];

      const shouldUpdate = (fieldId: string) => fieldsToUpdate.includes(fieldId);

      // vendor = Rechtlicher Firmenname (legal name)
      if (shouldUpdate('vendor') && normalized.vendor) {
        updates.vendor = normalized.vendor;
        changes.push('Rechtl. Firmenname');
      }

      // vendor_brand = Markenname (brand name)
      if (shouldUpdate('vendor_brand') && normalized.vendor_brand) {
        updates.vendor_brand = normalized.vendor_brand;
        changes.push('Markenname');
      }

      if (shouldUpdate('description') && normalized.description) {
        updates.description = normalized.description;
        changes.push('Beschreibung');
      }

      if (shouldUpdate('invoice_number') && normalized.invoice_number) {
        updates.invoice_number = normalized.invoice_number;
        changes.push('Rechnungsnummer');
      }

      if (shouldUpdate('receipt_date') && normalized.receipt_date) {
        updates.receipt_date = new Date(normalized.receipt_date);
        changes.push('Datum');
      }

      if (shouldUpdate('amount_gross') && normalized.amount_gross !== null) {
        updates.amount_gross = normalized.amount_gross.toString();
        changes.push('Bruttobetrag');
      }

      if (shouldUpdate('vat_rate') && normalized.vat_rate !== null) {
        updates.vat_rate = normalized.vat_rate.toString();
        changes.push('MwSt-Satz');
      }

      if (shouldUpdate('category') && normalized.category) {
        updates.category = normalized.category;
        changes.push('Kategorie');
      }

      updates.confidence = normalized.confidence;

      // Call update callback
      onFieldsUpdated(updates);

      toast({
        title: 'KI-Erkennung abgeschlossen',
        description: `Konfidenz: ${Math.round((normalized.confidence || 0) * 100)}% - ${changes.length} Feld(er) aktualisiert`,
      });

      onReanalyzeComplete?.();

    } catch (error) {
      console.error('Rerun AI error:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler bei KI-Erkennung',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    } finally {
      setIsRerunning(false);
    }
  };

  // General reanalysis modes
  const reanalyzeGeneral = async (mode: 'smart' | 'empty' | 'full') => {
    let fieldsToAnalyze: string[];

    switch (mode) {
      case 'smart':
        // Only fields the user has NOT manually modified
        fieldsToAnalyze = REANALYZABLE_FIELDS
          .map(f => f.id)
          .filter(id => !userModifiedFields.includes(id));

        if (fieldsToAnalyze.length === 0) {
          toast({
            title: 'Alle Felder wurden bereits manuell bearbeitet',
            description: 'Nutze "Komplett neu" um alle Felder zu überschreiben',
          });
          return;
        }
        break;

      case 'empty':
        // Only empty fields
        fieldsToAnalyze = [];
        if (!currentFormData.vendor) fieldsToAnalyze.push('vendor');
        if (!currentFormData.description) fieldsToAnalyze.push('description');
        if (!currentFormData.invoice_number) fieldsToAnalyze.push('invoice_number');
        if (!currentFormData.receipt_date) fieldsToAnalyze.push('receipt_date');
        if (!currentFormData.amount_gross) fieldsToAnalyze.push('amount_gross');
        if (!currentFormData.vat_rate) fieldsToAnalyze.push('vat_rate');
        if (!currentFormData.category) fieldsToAnalyze.push('category');

        if (fieldsToAnalyze.length === 0) {
          toast({
            title: 'Alle Felder haben bereits Werte',
          });
          return;
        }
        break;

      case 'full':
        // All fields
        fieldsToAnalyze = REANALYZABLE_FIELDS.map(f => f.id);
        break;
    }

    await reanalyzeFields(fieldsToAnalyze);
  };

  // Reanalyze a single field
  const reanalyzeSingleField = (fieldId: string) => {
    reanalyzeFields([fieldId]);
  };

  // Handle field selection
  const handleFieldSelectConfirm = () => {
    if (selectedReanalysisFields.length === 0) {
      toast({
        title: 'Keine Felder ausgewählt',
        description: 'Bitte wähle mindestens ein Feld aus.',
        variant: 'destructive',
      });
      return;
    }
    setShowFieldSelectDialog(false);
    reanalyzeFields(selectedReanalysisFields);
  };

  // Expenses-only reanalysis via edge function
  const handleExpensesOnlyReanalyze = async (remember: boolean, keywords: string[]) => {
    if (!receiptId || isRerunning) return;
    setIsRerunning(true);
    setShowExpensesOnlyConfirm(false);

    try {
      const { data, error } = await supabase.functions.invoke('extract-receipt', {
        body: { 
          receiptId, 
          expensesOnly: true, 
          skipMultiCheck: true,
          extractionKeywords: keywords.length > 0 ? keywords : undefined,
          extractionHint: dialogExtractionHint.trim() || undefined,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Nur-Ausgaben-Analyse abgeschlossen',
          description: 'Beleg wurde nur mit Kosten-Positionen neu analysiert.',
        });
        onReanalyzeComplete?.();
        if (remember) {
          onExpensesOnlyReanalyze?.(true, keywords, dialogExtractionHint.trim());
        }
      } else {
        throw new Error(data?.error || 'Analyse fehlgeschlagen');
      }
    } catch (error) {
      console.error('Expenses-only reanalyze error:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler bei Nur-Ausgaben-Analyse',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    } finally {
      setIsRerunning(false);
    }
  };

  const unmodifiedFieldCount = REANALYZABLE_FIELDS.length - userModifiedFields.length;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || isRerunning || !fileUrl}
            className="gap-1"
          >
            {isRerunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            KI-Analyse
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {/* OPTION 1: General Re-Analysis */}
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Generelle Analyse
          </DropdownMenuLabel>

          <DropdownMenuItem onClick={() => reanalyzeGeneral('smart')}>
            <Sparkles className="w-4 h-4 mr-2 text-primary" />
            <div className="flex-1">
              <p>Intelligent</p>
              <p className="text-xs text-muted-foreground">Schützt manuell bearbeitete Felder</p>
            </div>
            {userModifiedFields.length > 0 && (
              <Badge variant="outline" className="text-xs ml-2">
                {unmodifiedFieldCount} Felder
              </Badge>
            )}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => reanalyzeGeneral('empty')}>
            <Square className="w-4 h-4 mr-2 text-blue-500" />
            <div className="flex-1">
              <p>Nur leere Felder</p>
              <p className="text-xs text-muted-foreground">Füllt nur fehlende Werte</p>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => setShowFullReanalyzeConfirm(true)}
            className="text-orange-600 focus:text-orange-600"
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            <div className="flex-1">
              <p>Komplett neu</p>
              <p className="text-xs text-orange-400">Überschreibt alle Felder</p>
            </div>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* OPTION 2: Field-wise Analysis */}
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Einzelne Felder analysieren
          </DropdownMenuLabel>

          <DropdownMenuItem onClick={() => {
            setSelectedReanalysisFields([]);
            setShowFieldSelectDialog(true);
          }}>
            <MousePointer className="w-4 h-4 mr-2 text-muted-foreground" />
            <div className="flex-1">
              <p>Felder auswählen...</p>
              <p className="text-xs text-muted-foreground">Wähle gezielt welche Felder</p>
            </div>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Quick Access for individual fields */}
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Schnellzugriff
          </DropdownMenuLabel>

          <div className="grid grid-cols-2 gap-1 p-1">
            <DropdownMenuItem
              onClick={() => reanalyzeSingleField('vendor_brand')}
              className="flex-col items-start py-1.5"
            >
              <div className="flex items-center gap-1">
                <Building className="w-3 h-3" />
                <span className="text-xs">Markenname</span>
              </div>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => reanalyzeSingleField('vendor')}
              className="flex-col items-start py-1.5"
            >
              <div className="flex items-center gap-1">
                <Briefcase className="w-3 h-3" />
                <span className="text-xs">Rechtl. Name</span>
              </div>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => reanalyzeSingleField('invoice_number')}
              className="flex-col items-start py-1.5"
            >
              <div className="flex items-center gap-1">
                <Hash className="w-3 h-3" />
                <span className="text-xs">Rechnungsnr.</span>
              </div>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => reanalyzeSingleField('receipt_date')}
              className="flex-col items-start py-1.5"
            >
              <div className="flex items-center gap-1">
                <CalendarIcon className="w-3 h-3" />
                <span className="text-xs">Datum</span>
              </div>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => reanalyzeSingleField('amount_gross')}
              className="flex-col items-start py-1.5"
            >
              <div className="flex items-center gap-1">
                <Euro className="w-3 h-3" />
                <span className="text-xs">Bruttobetrag</span>
              </div>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => reanalyzeSingleField('vat_rate')}
              className="flex-col items-start py-1.5"
            >
              <div className="flex items-center gap-1">
                <Percent className="w-3 h-3" />
                <span className="text-xs">MwSt-Satz</span>
              </div>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => reanalyzeSingleField('description')}
              className="flex-col items-start py-1.5"
            >
              <div className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                <span className="text-xs">Beschreibung</span>
              </div>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => reanalyzeSingleField('category')}
              className="flex-col items-start py-1.5"
            >
              <div className="flex items-center gap-1">
                <Briefcase className="w-3 h-3" />
                <span className="text-xs">Kategorie</span>
              </div>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => reanalyzeFields(['amount_gross', 'amount_net', 'vat_amount', 'vat_rate'])}
              className="flex-col items-start py-1.5"
            >
              <div className="flex items-center gap-1">
                <Euro className="w-3 h-3" />
                <span className="text-xs">Alle Beträge</span>
              </div>
            </DropdownMenuItem>
          </div>

          {/* Expenses-Only Section */}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Spezial-Analyse
          </DropdownMenuLabel>

          <DropdownMenuItem
            onClick={() => {
              if (vendorId && onExpensesOnlyReanalyze) {
                // Initialize dialog state before opening
                setDialogKeywords([...vendorExtractionKeywords]);
                setNewKeywordInput('');
                setDialogExtractionHint(vendorExtractionHint);
                setShowExpensesOnlyConfirm(true);
              } else {
                handleExpensesOnlyReanalyze(false, vendorExtractionKeywords);
              }
            }}
          >
            <Euro className="w-4 h-4 mr-2 text-primary" />
            <div className="flex-1">
              <p>Nur Ausgaben extrahieren</p>
              <p className="text-xs text-muted-foreground">Einnahmen/Gutschriften ignorieren</p>
            </div>
            {vendorExpensesOnly && (
              <Badge variant="outline" className="text-xs ml-2">aktiv</Badge>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Field Selection Dialog */}
      <Dialog open={showFieldSelectDialog} onOpenChange={setShowFieldSelectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Felder zur Neuanalyse auswählen</DialogTitle>
            <DialogDescription>
              Wähle die Felder aus, die von der KI neu analysiert werden sollen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {REANALYZABLE_FIELDS.map((field) => {
              const Icon = field.icon;
              const isModified = userModifiedFields.includes(field.id);
              const isSelected = selectedReanalysisFields.includes(field.id);

              return (
                <div
                  key={field.id}
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => {
                    setSelectedReanalysisFields(prev =>
                      prev.includes(field.id)
                        ? prev.filter(f => f !== field.id)
                        : [...prev, field.id]
                    );
                  }}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      setSelectedReanalysisFields(prev =>
                        checked
                          ? [...prev, field.id]
                          : prev.filter(f => f !== field.id)
                      );
                    }}
                  />
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="flex-1">{field.label}</span>
                  {isModified && (
                    <Badge variant="outline" className="text-xs text-orange-600">
                      ✏️ bearbeitet
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFieldSelectDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleFieldSelectConfirm} disabled={selectedReanalysisFields.length === 0}>
              <RefreshCw className="w-4 h-4 mr-2" />
              {selectedReanalysisFields.length} Felder analysieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full Reanalyze Confirmation */}
      <AlertDialog open={showFullReanalyzeConfirm} onOpenChange={setShowFullReanalyzeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Alle Felder überschreiben?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion überschreibt alle Felder mit neuen KI-Werten, einschließlich
              manuell bearbeiteter Felder. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                reanalyzeGeneral('full');
                setShowFullReanalyzeConfirm(false);
              }}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Ja, alle überschreiben
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Expenses-Only Confirmation with Keywords + "Remember" option */}
      <Dialog open={showExpensesOnlyConfirm} onOpenChange={(open) => {
        setShowExpensesOnlyConfirm(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Euro className="h-5 w-5 text-primary" />
              Nur Ausgaben extrahieren?
            </DialogTitle>
            <DialogDescription>
              Die KI wird nur Kosten-Positionen (Gebühren, Abos, etc.) erfassen und
              Einnahmen/Gutschriften ignorieren.
            </DialogDescription>
          </DialogHeader>

          {/* Keyword management */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Schlagwörter für Kosten-Positionen</Label>
            
            {dialogKeywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {dialogKeywords.map((keyword, index) => (
                  <Badge key={index} variant="secondary" className="gap-1 pr-1">
                    {keyword}
                    <button
                      type="button"
                      onClick={() => setDialogKeywords(prev => prev.filter((_, i) => i !== index))}
                      className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            
            <div className="flex gap-2">
              <Input
                value={newKeywordInput}
                onChange={(e) => setNewKeywordInput(e.target.value)}
                placeholder="z.B. Transaktionsgebühr"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newKeywordInput.trim() && !dialogKeywords.includes(newKeywordInput.trim())) {
                      setDialogKeywords(prev => [...prev, newKeywordInput.trim()]);
                      setNewKeywordInput('');
                    }
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (newKeywordInput.trim() && !dialogKeywords.includes(newKeywordInput.trim())) {
                    setDialogKeywords(prev => [...prev, newKeywordInput.trim()]);
                    setNewKeywordInput('');
                  }
                }}
                disabled={!newKeywordInput.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground">
              {dialogKeywords.length === 0
                ? 'Ohne Schlagwörter werden allgemein alle Kosten erfasst.'
                : 'Die KI extrahiert nur Zeilen die diese Begriffe enthalten.'}
            </p>
          </div>

          {/* Extraction Hint */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Extraktions-Hinweis für die KI (optional)</Label>
            <Textarea
              value={dialogExtractionHint}
              onChange={(e) => setDialogExtractionHint(e.target.value.slice(0, 500))}
              placeholder="z.B. Beträge in Klammern sind Kosten und sollen als positive Werte behandelt werden"
              rows={3}
              maxLength={500}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {dialogExtractionHint.length}/500 Zeichen
            </p>
          </div>

          {vendorId && onExpensesOnlyReanalyze && (
            <div
              className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50 cursor-pointer"
              onClick={() => setRememberExpensesOnly(prev => !prev)}
            >
              <Checkbox
                checked={rememberExpensesOnly}
                onCheckedChange={(checked) => setRememberExpensesOnly(!!checked)}
              />
              <div>
                <p className="text-sm font-medium">Für diesen Lieferanten merken</p>
                <p className="text-xs text-muted-foreground">
                  Schlagwörter und Einstellung werden beim Lieferanten gespeichert
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExpensesOnlyConfirm(false)}>
              Abbrechen
            </Button>
            <Button onClick={() => handleExpensesOnlyReanalyze(rememberExpensesOnly, dialogKeywords)}>
              Nur Ausgaben analysieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
