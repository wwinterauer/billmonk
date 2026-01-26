import { useState, useEffect, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Download,
  ExternalLink,
  Loader2,
  Sparkles,
  Info,
  FileText,
  ZoomIn,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  Pencil,
  X,
  Check,
  RotateCcw,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { useReceipts, type Receipt } from '@/hooks/useReceipts';
import { useCategories } from '@/hooks/useCategories';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PdfViewer } from './PdfViewer';
import { extractReceiptData, normalizeExtractionResult } from '@/services/aiService';
import { 
  generateFileName, 
  getExportFilename, 
  getFileExtension,
  parseNamingSettings, 
  DEFAULT_NAMING_SETTINGS,
  type NamingSettings 
} from '@/lib/filenameUtils';

interface ReceiptDetailPanelProps {
  receiptId: string | null;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const VAT_RATES = [
  { value: '20', label: '20%' },
  { value: '13', label: '13%' },
  { value: '10', label: '10%' },
  { value: '0', label: '0%' },
];

const PAYMENT_METHODS = [
  { value: 'Überweisung', label: 'Überweisung' },
  { value: 'Kreditkarte', label: 'Kreditkarte' },
  { value: 'Bar', label: 'Bar' },
  { value: 'PayPal', label: 'PayPal' },
  { value: 'Lastschrift', label: 'Lastschrift' },
];

export function ReceiptDetailPanel({ 
  receiptId, 
  open, 
  onClose, 
  onUpdate 
}: ReceiptDetailPanelProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { getReceipt, updateReceipt, deleteReceipt } = useReceipts();
  const { categories } = useCategories();

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  
  // AI Re-run state
  const [isRerunning, setIsRerunning] = useState(false);
  const [hasUnsavedAiChanges, setHasUnsavedAiChanges] = useState(false);
  const [changedFields, setChangedFields] = useState<Record<string, { old: string; new: string }>>({});
  const [currentAiConfidence, setCurrentAiConfidence] = useState<number | null>(null);

  // Filename editing state
  const [isEditingFilename, setIsEditingFilename] = useState(false);
  const [customFilename, setCustomFilename] = useState('');
  const [namingSettings, setNamingSettings] = useState<NamingSettings>(DEFAULT_NAMING_SETTINGS);

  // Form state
  const [vendor, setVendor] = useState('');
  const [vendorBrand, setVendorBrand] = useState('');
  const [description, setDescription] = useState('');
  const [receiptDate, setReceiptDate] = useState<Date | undefined>();
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [category, setCategory] = useState('');
  const [amountGross, setAmountGross] = useState('');
  const [vatRate, setVatRate] = useState('20');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');

  // Calculated values
  const calculatedValues = useMemo(() => {
    const gross = parseFloat(amountGross) || 0;
    const rate = parseFloat(vatRate) || 0;
    const net = gross / (1 + rate / 100);
    const vat = gross - net;
    return {
      net: isNaN(net) ? 0 : net,
      vat: isNaN(vat) ? 0 : vat,
    };
  }, [amountGross, vatRate]);

  // Generated filename based on current form values
  const generatedFilename = useMemo(() => {
    const previewReceipt = {
      vendor,
      vendor_brand: vendorBrand,
      receipt_date: receiptDate ? format(receiptDate, 'yyyy-MM-dd') : null,
      amount_gross: parseFloat(amountGross) || null,
      category,
      invoice_number: invoiceNumber,
      payment_method: paymentMethod,
      file_name: receipt?.file_name,
    };
    return generateFileName(previewReceipt, namingSettings);
  }, [vendor, vendorBrand, receiptDate, amountGross, category, invoiceNumber, paymentMethod, receipt?.file_name, namingSettings]);

  // Display filename (custom or generated)
  const displayFilename = useMemo(() => {
    if (receipt?.custom_filename) {
      const extension = getFileExtension(receipt.file_name);
      return receipt.custom_filename + '.' + extension;
    }
    return generatedFilename;
  }, [receipt?.custom_filename, receipt?.file_name, generatedFilename]);

  // File type detection
  const isImage = useMemo(() => {
    const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    const fileType = receipt?.file_type?.toLowerCase() || '';
    const fileName = receipt?.file_name?.toLowerCase() || '';
    return imageExts.some(ext => fileType === ext || fileName.endsWith('.' + ext));
  }, [receipt?.file_type, receipt?.file_name]);

  const isPdf = useMemo(() => {
    const fileType = receipt?.file_type?.toLowerCase() || '';
    const fileName = receipt?.file_name?.toLowerCase() || '';
    return fileType === 'pdf' || fileName.endsWith('.pdf');
  }, [receipt?.file_type, receipt?.file_name]);

  // Load file as Blob URL
  useEffect(() => {
    let isMounted = true;
    let blobUrl: string | null = null;

    async function loadPreview() {
      if (!receipt?.file_url) return;

      setFileLoading(true);
      setFileError(false);

      try {
        // 1. Get signed URL
        const { data: signedData, error: signedError } = await supabase.storage
          .from('receipts')
          .createSignedUrl(receipt.file_url, 3600);

        if (signedError || !signedData?.signedUrl) {
          throw new Error('Could not get signed URL');
        }

        if (!isMounted) return;
        setSignedUrl(signedData.signedUrl);

        // 2. Fetch file as blob
        const response = await fetch(signedData.signedUrl);
        if (!response.ok) {
          throw new Error('Could not fetch file');
        }

        const blob = await response.blob();
        if (!isMounted) return;

        // 3. Create blob URL
        blobUrl = URL.createObjectURL(blob);
        setPreviewBlobUrl(blobUrl);

      } catch (error) {
        console.error('Preview load error:', error);
        if (isMounted) {
          setFileError(true);
        }
      } finally {
        if (isMounted) {
          setFileLoading(false);
        }
      }
    }

    loadPreview();

    // Cleanup: revoke blob URL when component unmounts or file changes
    return () => {
      isMounted = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [receipt?.file_url]);

  // Load receipt data and user naming settings
  useEffect(() => {
    if (!receiptId || !open) {
      setReceipt(null);
      setPreviewBlobUrl(null);
      setSignedUrl(null);
      setFileError(false);
      setIsEditingFilename(false);
      return;
    }

    const loadReceipt = async () => {
      setLoading(true);
      try {
        const data = await getReceipt(receiptId);
        if (data) {
          setReceipt(data);
          // Populate form
          setVendor(data.vendor || '');
          setVendorBrand(data.vendor_brand || '');
          setDescription(data.description || '');
          setReceiptDate(data.receipt_date ? new Date(data.receipt_date) : undefined);
          setInvoiceNumber(data.invoice_number || '');
          setCategory(data.category || '');
          setAmountGross(data.amount_gross?.toString() || '');
          setVatRate(data.vat_rate?.toString() || '20');
          setPaymentMethod(data.payment_method || '');
          setNotes(data.notes || '');
        }
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Fehler beim Laden',
          description: error instanceof Error ? error.message : 'Unbekannter Fehler',
        });
      } finally {
        setLoading(false);
      }
    };

    loadReceipt();
  }, [receiptId, open]);

  // Load user naming settings from profile
  useEffect(() => {
    const loadNamingSettings = async () => {
      if (!user || !open) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('naming_settings')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (data?.naming_settings && typeof data.naming_settings === 'object') {
          setNamingSettings(parseNamingSettings(data.naming_settings as Record<string, unknown>));
        }
      } catch (error) {
        console.error('Error loading naming settings:', error);
      }
    };

    loadNamingSettings();
  }, [user, open]);

  // Set customFilename when entering edit mode
  useEffect(() => {
    if (isEditingFilename) {
      // Remove extension for editing
      const filenameWithoutExt = displayFilename.replace(/\.[^/.]+$/, '');
      setCustomFilename(filenameWithoutExt);
    }
  }, [isEditingFilename, displayFilename]);

  // Download/Open handlers using signedUrl
  const handleDownload = () => {
    if (signedUrl) {
      const link = document.createElement('a');
      link.href = signedUrl;
      link.download = displayFilename; // Use custom or generated filename
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleOpenInNewTab = () => {
    if (signedUrl) {
      window.open(signedUrl, '_blank');
    }
  };

  // Filename handlers
  const handleSaveCustomFilename = useCallback(async () => {
    if (!receipt) return;

    // Sanitize filename
    const sanitized = customFilename
      .trim()
      .replace(/[<>:"/\\|?*]/g, '')
      .substring(0, 200);

    if (!sanitized) {
      toast({
        variant: 'destructive',
        title: 'Dateiname darf nicht leer sein',
      });
      return;
    }

    try {
      await updateReceipt(receipt.id, { custom_filename: sanitized } as Partial<Receipt>);
      setReceipt(prev => prev ? { ...prev, custom_filename: sanitized } : prev);
      setIsEditingFilename(false);
      toast({ title: 'Dateiname gespeichert' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler beim Speichern',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    }
  }, [receipt, customFilename, updateReceipt, toast]);

  const handleResetFilename = useCallback(async () => {
    if (!receipt) return;

    try {
      await updateReceipt(receipt.id, { custom_filename: null } as Partial<Receipt>);
      setReceipt(prev => prev ? { ...prev, custom_filename: null } : prev);
      setCustomFilename('');
      setIsEditingFilename(false);
      toast({ title: 'Dateiname auf Vorlage zurückgesetzt' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler beim Zurücksetzen',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    }
  }, [receipt, updateReceipt, toast]);

  const handleCopyFilename = useCallback(() => {
    navigator.clipboard.writeText(displayFilename);
    toast({ title: 'Dateiname kopiert' });
  }, [displayFilename, toast]);

  // AI Re-run handler
  const handleRerunAI = async () => {
    if (!receipt?.file_url || isRerunning || !signedUrl) return;

    setIsRerunning(true);
    setHasUnsavedAiChanges(false);
    setChangedFields({});

    try {
      // 1. Fetch file as blob using the signed URL
      const response = await fetch(signedUrl);
      if (!response.ok) {
        throw new Error('Datei konnte nicht geladen werden');
      }

      const blob = await response.blob();
      const file = new File([blob], receipt.file_name || 'receipt', { type: blob.type });

      // 2. Call AI extraction
      const extracted = await extractReceiptData(file);
      const normalized = normalizeExtractionResult(extracted);

      if (!normalized) {
        throw new Error('KI-Erkennung hat keine Daten zurückgegeben');
      }

      // 3. Track changed fields
      const changes: Record<string, { old: string; new: string }> = {};
      
      const compareAndUpdate = (field: string, oldVal: string, newVal: string | null, setter: (val: string) => void) => {
        const newValue = newVal || '';
        if (oldVal !== newValue && newValue) {
          changes[field] = { old: oldVal, new: newValue };
          setter(newValue);
        }
      };

      compareAndUpdate('Lieferant (rechtlich)', vendor, normalized.vendor, setVendor);
      compareAndUpdate('Markenname', vendorBrand, normalized.vendor_brand, setVendorBrand);
      compareAndUpdate('Beschreibung', description, normalized.description, setDescription);
      compareAndUpdate('Rechnungsnummer', invoiceNumber, normalized.invoice_number, setInvoiceNumber);
      compareAndUpdate('Kategorie', category, normalized.category, setCategory);
      compareAndUpdate('Zahlungsart', paymentMethod, normalized.payment_method, setPaymentMethod);
      
      if (normalized.amount_gross !== null) {
        const newAmount = normalized.amount_gross.toString();
        if (amountGross !== newAmount) {
          changes['Bruttobetrag'] = { old: amountGross || '-', new: newAmount };
          setAmountGross(newAmount);
        }
      }
      
      if (normalized.vat_rate !== null) {
        const newRate = normalized.vat_rate.toString();
        if (vatRate !== newRate) {
          changes['MwSt-Satz'] = { old: vatRate || '-', new: newRate + '%' };
          setVatRate(newRate);
        }
      }
      
      if (normalized.receipt_date) {
        const newDate = new Date(normalized.receipt_date);
        const oldDateStr = receiptDate ? format(receiptDate, 'dd.MM.yyyy') : '-';
        const newDateStr = format(newDate, 'dd.MM.yyyy');
        if (oldDateStr !== newDateStr) {
          changes['Datum'] = { old: oldDateStr, new: newDateStr };
          setReceiptDate(newDate);
        }
      }

      // 4. Update confidence
      setCurrentAiConfidence(normalized.confidence);
      
      if (Object.keys(changes).length > 0) {
        setChangedFields(changes);
        setHasUnsavedAiChanges(true);
      }

      toast({
        title: 'KI-Erkennung abgeschlossen',
        description: `Konfidenz: ${Math.round(normalized.confidence * 100)}% - ${Object.keys(changes).length} Feld(er) aktualisiert`,
      });

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

  const handleSave = async (newStatus?: 'approved' | 'rejected') => {
    if (!receipt) return;

    setSaving(true);
    try {
      // Build update data
      const updateData: Record<string, unknown> = {
        vendor: vendor || null,
        vendor_brand: vendorBrand || null,
        description: description || null,
        receipt_date: receiptDate ? format(receiptDate, 'yyyy-MM-dd') : null,
        invoice_number: invoiceNumber || null,
        category: category || null,
        amount_gross: parseFloat(amountGross) || null,
        amount_net: calculatedValues.net || null,
        vat_amount: calculatedValues.vat || null,
        vat_rate: parseFloat(vatRate) || null,
        payment_method: paymentMethod || null,
        notes: notes || null,
      };

      // Add status if provided
      if (newStatus) {
        updateData.status = newStatus;
      }

      // Update ai_confidence and ai_processed_at if AI was re-run
      if (currentAiConfidence !== null) {
        updateData.ai_confidence = currentAiConfidence;
        updateData.ai_processed_at = new Date().toISOString();
      }

      await updateReceipt(receipt.id, updateData as Partial<Receipt>);

      // Reset AI changes state
      setHasUnsavedAiChanges(false);
      setChangedFields({});

      const statusMessages = {
        approved: 'Beleg freigegeben',
        rejected: 'Beleg abgelehnt',
      };

      toast({
        title: newStatus ? statusMessages[newStatus] : 'Änderungen gespeichert',
      });

      onUpdate();
      onClose();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler beim Speichern',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!receipt) return;

    setSaving(true);
    try {
      await deleteReceipt(receipt.id);
      toast({ title: 'Beleg gelöscht' });
      onUpdate();
      onClose();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler beim Löschen',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    } finally {
      setSaving(false);
      setDeleteDialogOpen(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-AT', { 
      style: 'currency', 
      currency: 'EUR' 
    }).format(value);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <SheetContent 
          side="right" 
          className="w-full sm:max-w-[800px] p-0 flex flex-col"
        >
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle className="text-lg font-semibold">
              {loading ? 'Beleg laden...' : 'Beleg-Details'}
            </SheetTitle>
          </SheetHeader>

          {loading ? (
            <div className="flex-1 p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <Skeleton className="h-[400px] w-full" />
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            </div>
          ) : receipt ? (
            <>
              <div className="flex-1 overflow-y-auto">
                <div className="grid md:grid-cols-[55%_45%] gap-6 p-6">
                  {/* Left Column - File Preview */}
                  <div className="space-y-4">
                    <div 
                      className={cn(
                        "relative bg-muted rounded-lg overflow-hidden min-h-[400px] flex items-center justify-center",
                        isZoomed && "cursor-zoom-out",
                        !isZoomed && isImage && "cursor-zoom-in"
                      )}
                      onClick={() => isImage && !fileLoading && !fileError && setIsZoomed(!isZoomed)}
                    >
                      {fileLoading ? (
                        <div className="flex flex-col items-center gap-4 text-muted-foreground p-8">
                          <Loader2 className="h-10 w-10 animate-spin text-primary" />
                          <p>Lade Vorschau...</p>
                        </div>
                      ) : fileError ? (
                        <div className="flex flex-col items-center gap-4 text-muted-foreground p-8">
                          <AlertCircle className="h-12 w-12 text-muted-foreground" />
                          <p className="text-center text-foreground mb-2">Vorschau konnte nicht geladen werden</p>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleDownload}>
                              <Download className="h-4 w-4 mr-2" />
                              Herunterladen
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleOpenInNewTab}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              In neuem Tab
                            </Button>
                          </div>
                        </div>
                      ) : previewBlobUrl ? (
                        isImage ? (
                          <>
                            <img
                              src={previewBlobUrl}
                              alt={receipt.file_name || 'Beleg'}
                              className={cn(
                                "transition-transform duration-300",
                                isZoomed ? "scale-150" : "max-w-full max-h-[500px] object-contain"
                              )}
                              onError={() => setFileError(true)}
                            />
                            {!isZoomed && (
                              <div className="absolute bottom-2 right-2 bg-background/80 rounded p-1">
                                <ZoomIn className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </>
                        ) : isPdf ? (
                          <div className="h-[500px] w-full flex flex-col">
                            <PdfViewer 
                              url={previewBlobUrl} 
                              fileName={receipt?.file_name}
                              onError={() => setFileError(true)}
                              className="flex-1"
                            />
                            {/* Action buttons below the PDF viewer */}
                            <div className="flex gap-2 justify-center pt-3 border-t mt-3">
                              <Button variant="outline" size="sm" onClick={handleDownload}>
                                <Download className="h-4 w-4 mr-2" />
                                Herunterladen
                              </Button>
                              <Button variant="outline" size="sm" onClick={handleOpenInNewTab}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                In neuem Tab
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-4 text-muted-foreground p-8">
                            <FileText className="h-16 w-16" />
                            <p className="font-medium text-foreground">{receipt?.file_name}</p>
                            <p className="text-sm">Vorschau nicht verfügbar</p>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={handleDownload}>
                                <Download className="h-4 w-4 mr-2" />
                                Herunterladen
                              </Button>
                              <Button variant="outline" size="sm" onClick={handleOpenInNewTab}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                In neuem Tab
                              </Button>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="flex flex-col items-center gap-4 text-muted-foreground p-8">
                          <FileText className="h-16 w-16" />
                          <p>Keine Datei vorhanden</p>
                        </div>
                      )}
                    </div>

                    {receipt.file_name && (
                      <p className="text-sm text-muted-foreground">
                        Datei: {receipt.file_name}
                      </p>
                    )}

                    {/* Export Filename Preview Section */}
                    <div className="border rounded-lg p-4 bg-muted/50">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm font-medium">
                          Export-Dateiname
                        </Label>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setIsEditingFilename(!isEditingFilename)}
                        >
                          {isEditingFilename ? (
                            <>
                              <X className="w-4 h-4 mr-1" />
                              Abbrechen
                            </>
                          ) : (
                            <>
                              <Pencil className="w-4 h-4 mr-1" />
                              Anpassen
                            </>
                          )}
                        </Button>
                      </div>

                      {isEditingFilename ? (
                        <div className="space-y-2">
                          <Input 
                            value={customFilename}
                            onChange={(e) => setCustomFilename(e.target.value)}
                            placeholder="Benutzerdefinierter Dateiname"
                            className="font-mono text-sm"
                          />
                          <div className="flex items-center gap-2">
                            <Button size="sm" onClick={handleSaveCustomFilename}>
                              <Check className="w-4 h-4 mr-1" />
                              Übernehmen
                            </Button>
                            {receipt.custom_filename && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handleResetFilename}
                              >
                                <RotateCcw className="w-4 h-4 mr-1" />
                                Zurücksetzen
                              </Button>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Dateiendung (.{getFileExtension(receipt.file_name)}) wird automatisch ergänzt
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <code className="text-sm bg-background px-2 py-1 rounded border flex-1 truncate">
                              {displayFilename}
                            </code>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={handleCopyFilename}
                              title="Kopieren"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                          
                          {receipt.custom_filename && (
                            <p className="text-xs text-amber-600 flex items-center">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Benutzerdefinierter Name (weicht von Vorlage ab)
                            </p>
                          )}

                          {/* Show generated name if custom is set and different */}
                          {receipt.custom_filename && generatedFilename !== displayFilename && (
                            <p className="text-xs text-muted-foreground">
                              Nach Vorlage wäre: {generatedFilename}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column - Form */}
                  <div className="space-y-4">
                    {/* AI Confidence Box with Re-run Button */}
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-primary flex-shrink-0" />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="secondary" className="bg-primary/10 text-primary cursor-help">
                                KI-Erkennung: {Math.round((currentAiConfidence ?? receipt?.ai_confidence ?? 0) * 100)}%
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[250px]">
                              <div className="space-y-1 text-sm">
                                <p><strong>Erkannt mit:</strong> Lovable AI (Gemini)</p>
                                {receipt?.created_at && (
                                  <p><strong>Zeitpunkt:</strong> {format(new Date(receipt.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}</p>
                                )}
                                <p><strong>Konfidenz:</strong> {Math.round((currentAiConfidence ?? receipt?.ai_confidence ?? 0) * 100)}%</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        
                        {/* Re-run AI Button */}
                        {receipt?.file_url && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                disabled={isRerunning || fileLoading}
                                className="gap-1"
                              >
                                {isRerunning ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={handleRerunAI} disabled={isRerunning}>
                                <Sparkles className="h-4 w-4 mr-2" />
                                Erneut analysieren
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                                <Info className="h-4 w-4 mr-2" />
                                Verwendet Lovable AI
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>

                    {/* Unsaved AI Changes Alert */}
                    {hasUnsavedAiChanges && Object.keys(changedFields).length > 0 && (
                      <Alert className="bg-amber-50 border-amber-200">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-800">
                          <div className="space-y-2">
                            <p className="font-medium">Neue Werte erkannt – Änderungen noch nicht gespeichert</p>
                            <div className="text-sm space-y-1">
                              {Object.entries(changedFields).map(([field, { old, new: newVal }]) => (
                                <div key={field} className="flex items-center gap-2">
                                  <span className="text-muted-foreground">{field}:</span>
                                  <span className="line-through text-muted-foreground">{old || '-'}</span>
                                  <span>→</span>
                                  <span className="font-medium text-amber-900">{newVal}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Form Fields */}
                    <div className="space-y-4">
                      {/* Vendor fields - show brand if different from legal name */}
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="vendor">
                            {vendorBrand && vendorBrand !== vendor ? 'Firmenname (rechtlich)' : 'Lieferant'}
                          </Label>
                          <Input
                            id="vendor"
                            value={vendor}
                            onChange={(e) => setVendor(e.target.value)}
                            placeholder="z.B. Media Markt E-Business GmbH"
                          />
                        </div>
                        
                        {/* Show brand name field if exists or vendor has legal suffix */}
                        {(vendorBrand || vendor.match(/(GmbH|AG|e\.U\.|OG|KG|Ltd\.|S\.à r\.l\.)/i)) && (
                          <div>
                            <Label htmlFor="vendorBrand" className="text-muted-foreground">
                              Markenname (falls abweichend)
                            </Label>
                            <Input
                              id="vendorBrand"
                              value={vendorBrand}
                              onChange={(e) => setVendorBrand(e.target.value)}
                              placeholder="z.B. MediaMarkt"
                              className="text-muted-foreground"
                            />
                          </div>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="description">Beschreibung</Label>
                        <Textarea
                          id="description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Wofür war der Einkauf?"
                          rows={3}
                        />
                      </div>

                      <div>
                        <Label>Belegdatum</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !receiptDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {receiptDate 
                                ? format(receiptDate, 'dd.MM.yyyy', { locale: de }) 
                                : 'Datum auswählen'
                              }
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={receiptDate}
                              onSelect={setReceiptDate}
                              initialFocus
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div>
                        <Label htmlFor="invoiceNumber">Rechnungsnummer</Label>
                        <Input
                          id="invoiceNumber"
                          value={invoiceNumber}
                          onChange={(e) => setInvoiceNumber(e.target.value)}
                          placeholder="z.B. RE-2024-001"
                        />
                      </div>

                      <div>
                        <Label>Kategorie</Label>
                        <Select value={category} onValueChange={setCategory}>
                          <SelectTrigger>
                            <SelectValue placeholder="Kategorie wählen" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.name}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="amountGross">Bruttobetrag</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                            <Input
                              id="amountGross"
                              type="number"
                              step="0.01"
                              value={amountGross}
                              onChange={(e) => setAmountGross(e.target.value)}
                              className="pl-8"
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        <div>
                          <Label>MwSt-Satz</Label>
                          <Select value={vatRate} onValueChange={setVatRate}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {VAT_RATES.map((rate) => (
                                <SelectItem key={rate.value} value={rate.value}>
                                  {rate.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Nettobetrag</Label>
                          <Input
                            value={formatCurrency(calculatedValues.net)}
                            readOnly
                            className="bg-muted text-muted-foreground"
                          />
                        </div>

                        <div>
                          <Label>MwSt-Betrag</Label>
                          <Input
                            value={formatCurrency(calculatedValues.vat)}
                            readOnly
                            className="bg-muted text-muted-foreground"
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Zahlungsart</Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                          <SelectTrigger>
                            <SelectValue placeholder="Zahlungsart wählen" />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_METHODS.map((method) => (
                              <SelectItem key={method.value} value={method.value}>
                                {method.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="notes">Notizen</Label>
                        <Textarea
                          id="notes"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Optionale Anmerkungen..."
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons - Fixed at bottom */}
              <div className="border-t p-4 bg-background">
                <div className="flex flex-wrap gap-2 justify-end">
                  <Button
                    variant="ghost"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={saving}
                  >
                    Löschen
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleSave('rejected')}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Ablehnen
                  </Button>
                  <Button
                    variant="outline"
                    className="border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
                    onClick={() => handleSave('approved')}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Freigeben
                  </Button>
                  <Button
                    className="gradient-primary hover:opacity-90"
                    onClick={() => handleSave()}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Speichern
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-muted-foreground">Beleg nicht gefunden</p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Beleg löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser Beleg wird unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
