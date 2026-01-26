import { useState, useEffect, useMemo, useRef } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  FileText,
  Folder,
  ArrowRight,
  Settings,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Receipt } from '@/hooks/useReceipts';
import { Link } from 'react-router-dom';

interface NamingSettings {
  template: string;
  replaceUmlauts: boolean;
  replaceSpaces: boolean;
  removeSpecialChars: boolean;
  lowercase: boolean;
  dateFormat: string;
  emptyFieldHandling: 'keep' | 'replace' | 'remove';
}

const DEFAULT_SETTINGS: NamingSettings = {
  template: '{datum}_{lieferant}_{betrag}',
  replaceUmlauts: true,
  replaceSpaces: true,
  removeSpecialChars: true,
  lowercase: false,
  dateFormat: 'YYYYMMDD',
  emptyFieldHandling: 'remove',
};

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipts: Receipt[];
}

export function ExportDialog({ open, onOpenChange, receipts }: ExportDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const abortRef = useRef(false);
  
  const [settings, setSettings] = useState<NamingSettings>(DEFAULT_SETTINGS);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [groupByMonth, setGroupByMonth] = useState(true);
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentItem, setCurrentItem] = useState(0);

  // Load naming settings from database
  useEffect(() => {
    const loadSettings = async () => {
      if (!user || !open) return;
      
      setLoadingSettings(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('naming_settings')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (data?.naming_settings && typeof data.naming_settings === 'object') {
          const savedSettings = data.naming_settings as Record<string, unknown>;
          setSettings({
            template: (savedSettings.template as string) || DEFAULT_SETTINGS.template,
            replaceUmlauts: savedSettings.replaceUmlauts !== undefined ? Boolean(savedSettings.replaceUmlauts) : DEFAULT_SETTINGS.replaceUmlauts,
            replaceSpaces: savedSettings.replaceSpaces !== undefined ? Boolean(savedSettings.replaceSpaces) : DEFAULT_SETTINGS.replaceSpaces,
            removeSpecialChars: savedSettings.removeSpecialChars !== undefined ? Boolean(savedSettings.removeSpecialChars) : DEFAULT_SETTINGS.removeSpecialChars,
            lowercase: savedSettings.lowercase !== undefined ? Boolean(savedSettings.lowercase) : DEFAULT_SETTINGS.lowercase,
            dateFormat: (savedSettings.dateFormat as string) || DEFAULT_SETTINGS.dateFormat,
            emptyFieldHandling: (savedSettings.emptyFieldHandling as NamingSettings['emptyFieldHandling']) || DEFAULT_SETTINGS.emptyFieldHandling,
          });
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoadingSettings(false);
      }
    };

    loadSettings();
  }, [user, open]);

  // Format date according to selected format
  const formatDate = (dateStr: string | null, formatStr: string): string => {
    if (!dateStr) return 'kein-datum';
    const [year, month, day] = dateStr.split('-');
    const year2 = year.slice(2);
    switch (formatStr) {
      case 'DD.MM.YYYY':
        return `${day}.${month}.${year}`;
      case 'DD-MM-YYYY':
        return `${day}-${month}-${year}`;
      case 'DD.MM.YY':
        return `${day}.${month}.${year2}`;
      case 'YYYYMMDD':
        return `${year}${month}${day}`;
      case 'YYMMDD':
        return `${year2}${month}${day}`;
      case 'YYYY-MM-DD':
      default:
        return dateStr;
    }
  };

  // Get date parts
  const getDateParts = (dateStr: string | null) => {
    if (!dateStr) return { year: 'kein', year2: 'kein', month: 'kein', day: 'kein' };
    const [year, month, day] = dateStr.split('-');
    return { year, year2: year.slice(2), month, day };
  };

  // Handle empty field based on settings
  const handleEmptyField = (value: string | null | undefined): string => {
    if (value) return value;
    
    switch (settings.emptyFieldHandling) {
      case 'replace':
        return 'k.A.';
      case 'remove':
        return '';
      case 'keep':
      default:
        return '';
    }
  };

  // Apply naming transformations
  const applyTransformations = (text: string): string => {
    let result = text;

    if (settings.replaceUmlauts) {
      result = result
        .replace(/ä/g, 'ae')
        .replace(/Ä/g, 'Ae')
        .replace(/ö/g, 'oe')
        .replace(/Ö/g, 'Oe')
        .replace(/ü/g, 'ue')
        .replace(/Ü/g, 'Ue')
        .replace(/ß/g, 'ss');
    }

    if (settings.replaceSpaces) {
      result = result.replace(/\s+/g, '_');
    }

    if (settings.removeSpecialChars) {
      result = result.replace(/[^a-zA-Z0-9_\-.]/g, '');
    }

    if (settings.lowercase) {
      result = result.toLowerCase();
    }

    // Clean up multiple underscores
    result = result.replace(/_+/g, '_').replace(/^_|_$/g, '');

    return result;
  };

  // Get file extension from filename
  const getFileExtension = (fileName: string | null): string => {
    if (!fileName) return 'pdf';
    const parts = fileName.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'pdf';
  };

  // Get filename without extension
  const getFileNameWithoutExtension = (fileName: string | null): string => {
    if (!fileName) return 'unbekannt';
    const parts = fileName.split('.');
    parts.pop();
    return parts.join('.') || fileName;
  };

  // Generate new filename based on template
  const generateFileName = (receipt: Receipt, index: number): string => {
    let name = settings.template;

    // Date placeholders
    const formattedDate = formatDate(receipt.receipt_date, settings.dateFormat);
    const dateParts = getDateParts(receipt.receipt_date);
    
    name = name.replace(/{datum}/g, formattedDate);
    name = name.replace(/{jahr}/g, dateParts.year);
    name = name.replace(/{jahr2}/g, dateParts.year2);
    name = name.replace(/{monat}/g, dateParts.month);
    name = name.replace(/{tag}/g, dateParts.day);

    // Beleg-Info placeholders
    name = name.replace(/{lieferant}/g, handleEmptyField(receipt.vendor));
    name = name.replace(/{betrag}/g, receipt.amount_gross?.toFixed(2) || '0');
    name = name.replace(/{betrag_int}/g, receipt.amount_gross ? Math.round(receipt.amount_gross * 100).toString() : '0');
    name = name.replace(/{kategorie}/g, handleEmptyField(receipt.category));
    name = name.replace(/{rechnungsnummer}/g, handleEmptyField(receipt.invoice_number));
    name = name.replace(/{zahlungsart}/g, handleEmptyField(receipt.payment_method));

    // System placeholders
    name = name.replace(/{nummer}/g, String(index + 1).padStart(3, '0'));
    name = name.replace(/{original}/g, getFileNameWithoutExtension(receipt.file_name));

    // Apply transformations
    name = applyTransformations(name);

    // Add file extension
    const extension = getFileExtension(receipt.file_name);
    return name + '.' + extension;
  };

  // Generate preview examples
  const previewExamples = useMemo(() => {
    return receipts.slice(0, 3).map((receipt, index) => ({
      original: receipt.file_name || 'unbekannt',
      newName: generateFileName(receipt, index),
    }));
  }, [receipts, settings, loadingSettings]);

  // Cancel export
  const handleCancel = () => {
    abortRef.current = true;
  };

  // Export as ZIP
  const handleExportZip = async () => {
    if (receipts.length === 0) return;

    setIsExporting(true);
    setProgress(0);
    setCurrentItem(0);
    abortRef.current = false;

    const zip = new JSZip();
    const usedNames = new Map<string, number>();

    try {
      for (let i = 0; i < receipts.length; i++) {
        if (abortRef.current) {
          toast({ title: 'Export abgebrochen' });
          break;
        }

        const receipt = receipts[i];
        setCurrentItem(i + 1);
        setProgress(Math.round(((i + 1) / receipts.length) * 100));

        if (!receipt.file_url) continue;

        // Get signed URL
        const { data: urlData, error: urlError } = await supabase.storage
          .from('receipts')
          .createSignedUrl(receipt.file_url, 60);

        if (urlError || !urlData?.signedUrl) {
          console.error('Error getting signed URL:', urlError);
          continue;
        }

        // Fetch file
        try {
          const response = await fetch(urlData.signedUrl);
          if (!response.ok) continue;
          const blob = await response.blob();

          // Generate unique filename
          let newName = generateFileName(receipt, i);
          
          // Handle duplicate names
          const baseName = newName.replace(/\.[^/.]+$/, '');
          const ext = getFileExtension(receipt.file_name);
          
          if (usedNames.has(newName)) {
            const count = usedNames.get(newName)! + 1;
            usedNames.set(newName, count);
            newName = `${baseName}_${count}.${ext}`;
          } else {
            usedNames.set(newName, 1);
          }

          // Determine folder path
          let folderPath = '';
          if (groupByMonth && receipt.receipt_date) {
            folderPath = receipt.receipt_date.substring(0, 7) + '/';
          }
          if (groupByCategory && receipt.category) {
            folderPath += applyTransformations(receipt.category) + '/';
          }

          zip.file(folderPath + newName, blob);
        } catch (fetchError) {
          console.error('Error fetching file:', fetchError);
        }
      }

      if (!abortRef.current) {
        // Generate ZIP
        const content = await zip.generateAsync({ type: 'blob' });
        const exportDate = format(new Date(), 'yyyy-MM-dd');
        saveAs(content, `belege_export_${exportDate}.zip`);

        toast({
          title: 'Export abgeschlossen',
          description: `${receipts.length} Belege wurden exportiert.`,
        });
      }
    } catch (error) {
      console.error('Export error:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler beim Export',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    } finally {
      setIsExporting(false);
      setProgress(0);
      setCurrentItem(0);
      if (!abortRef.current) {
        onOpenChange(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !isExporting && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {receipts.length} Belege exportieren
          </DialogTitle>
          <DialogDescription>
            Die Dateien werden nach deinen Umbenennungsregeln exportiert.
          </DialogDescription>
        </DialogHeader>

        {loadingSettings ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isExporting ? (
          // Progress View
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Verarbeite Beleg {currentItem} von {receipts.length}...</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={handleCancel}
            >
              <X className="h-4 w-4 mr-2" />
              Abbrechen
            </Button>
          </div>
        ) : (
          <>
            {/* Preview Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Die Dateien werden wie folgt benannt:</p>
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  {previewExamples.map((example, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground truncate max-w-[140px]" title={example.original}>
                        {example.original}
                      </span>
                      <ArrowRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                      <span className="font-mono text-xs truncate flex-1" title={example.newName}>
                        {example.newName}
                      </span>
                    </div>
                  ))}
                  {receipts.length > 3 && (
                    <p className="text-xs text-muted-foreground pt-1">
                      ... und {receipts.length - 3} weitere
                    </p>
                  )}
                </div>
              </div>

              {/* Settings Link */}
              <div className="flex items-center gap-2 p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                <Settings className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Benennungsregel kann in den{' '}
                  <Link to="/settings" className="text-primary hover:underline font-medium">
                    Einstellungen
                  </Link>
                  {' '}angepasst werden.
                </p>
              </div>

              {/* Options */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Optionen:</p>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="groupByMonth"
                      checked={groupByMonth}
                      onCheckedChange={(v) => setGroupByMonth(v as boolean)}
                    />
                    <label htmlFor="groupByMonth" className="text-sm cursor-pointer flex items-center gap-2">
                      <Folder className="h-4 w-4 text-muted-foreground" />
                      Ordner nach Monat erstellen (z.B. 2024-01/)
                    </label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="groupByCategory"
                      checked={groupByCategory}
                      onCheckedChange={(v) => setGroupByCategory(v as boolean)}
                    />
                    <label htmlFor="groupByCategory" className="text-sm cursor-pointer flex items-center gap-2">
                      <Folder className="h-4 w-4 text-muted-foreground" />
                      Ordner nach Kategorie erstellen
                    </label>
                  </div>
                </div>
              </div>

              {receipts.some(r => !r.file_url) && (
                <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-700">
                    Einige Belege haben keine Datei und werden übersprungen.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleExportZip} disabled={receipts.length === 0}>
                ZIP erstellen & herunterladen
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Export CSV function
export async function exportAsCSV(receipts: Receipt[]) {
  const rows = receipts.map(r => ({
    'Datum': r.receipt_date || '',
    'Lieferant': r.vendor || '',
    'Rechnungsnummer': r.invoice_number || '',
    'Beschreibung': r.description || '',
    'Kategorie': r.category || '',
    'Brutto (€)': r.amount_gross?.toFixed(2) || '',
    'Netto (€)': r.amount_net?.toFixed(2) || '',
    'MwSt (€)': r.vat_amount?.toFixed(2) || '',
    'MwSt-Satz (%)': r.vat_rate?.toString() || '',
    'Zahlungsart': r.payment_method || '',
    'Status': r.status || '',
    'Dateiname': r.file_name || '',
  }));

  const headers = Object.keys(rows[0] || {});
  const csvContent = [
    headers.join(';'),
    ...rows.map(row => headers.map(h => `"${(row as Record<string, string>)[h]}"`).join(';')),
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const exportDate = format(new Date(), 'yyyy-MM-dd');
  saveAs(blob, `belege_export_${exportDate}.csv`);
}

// Export Excel function
export async function exportAsExcel(receipts: Receipt[]) {
  const rows = receipts.map(r => ({
    'Datum': r.receipt_date || '',
    'Lieferant': r.vendor || '',
    'Rechnungsnummer': r.invoice_number || '',
    'Beschreibung': r.description || '',
    'Kategorie': r.category || '',
    'Brutto (€)': r.amount_gross || 0,
    'Netto (€)': r.amount_net || 0,
    'MwSt (€)': r.vat_amount || 0,
    'MwSt-Satz (%)': r.vat_rate || 0,
    'Zahlungsart': r.payment_method || '',
    'Status': r.status || '',
    'Dateiname': r.file_name || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Belege');

  // Adjust column widths
  const colWidths = [
    { wch: 12 }, // Datum
    { wch: 25 }, // Lieferant
    { wch: 18 }, // Rechnungsnummer
    { wch: 35 }, // Beschreibung
    { wch: 15 }, // Kategorie
    { wch: 12 }, // Brutto
    { wch: 12 }, // Netto
    { wch: 10 }, // MwSt
    { wch: 10 }, // MwSt-Satz
    { wch: 15 }, // Zahlungsart
    { wch: 12 }, // Status
    { wch: 30 }, // Dateiname
  ];
  ws['!cols'] = colWidths;

  const exportDate = format(new Date(), 'yyyy-MM-dd');
  XLSX.writeFile(wb, `belege_export_${exportDate}.xlsx`);
}
