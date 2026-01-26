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
  ZoomOut,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  X,
  Check,
  RotateCcw,
  Copy,
  Building,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useReceipts, type Receipt } from '@/hooks/useReceipts';
import { useCategories } from '@/hooks/useCategories';
import { useVendors, Vendor } from '@/hooks/useVendors';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PdfViewer } from './PdfViewer';
import { extractReceiptData, normalizeExtractionResult, fetchDescriptionSettings, processDescription, DEFAULT_DESCRIPTION_SETTINGS, type DescriptionSettings } from '@/services/aiService';
import { searchVendors, matchOrCreateVendor, type MatchedVendor } from '@/services/vendorMatchingService';
import { 
  generateFileName, 
  getExportFilename, 
  getFileExtension,
  parseNamingSettings, 
  DEFAULT_NAMING_SETTINGS,
  type NamingSettings 
} from '@/lib/filenameUtils';
import { AlertTriangle } from 'lucide-react';

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
  const { vendors } = useVendors();

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
  const [descriptionSettings, setDescriptionSettings] = useState<DescriptionSettings>(DEFAULT_DESCRIPTION_SETTINGS);

  // Vendor autocomplete state
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorSuggestions, setShowVendorSuggestions] = useState(false);
  const [vendorSuggestions, setVendorSuggestions] = useState<MatchedVendor[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [vendorDefaultsApplied, setVendorDefaultsApplied] = useState<{
    category?: string;
    vatRate?: string;
  } | null>(null);

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

  // Load user naming and description settings from profile
  useEffect(() => {
    const loadSettings = async () => {
      if (!user || !open) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('naming_settings, description_settings')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (data?.naming_settings && typeof data.naming_settings === 'object') {
          setNamingSettings(parseNamingSettings(data.naming_settings as Record<string, unknown>));
        }
        
        if (data?.description_settings) {
          const descSettings = await fetchDescriptionSettings(user.id);
          setDescriptionSettings(descSettings);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };

    loadSettings();
  }, [user, open]);

  // Set customFilename when entering edit mode
  useEffect(() => {
    if (isEditingFilename) {
      // Remove extension for editing
      const filenameWithoutExt = displayFilename.replace(/\.[^/.]+$/, '');
      setCustomFilename(filenameWithoutExt);
    }
  }, [isEditingFilename, displayFilename]);

  // Vendor autocomplete search
  useEffect(() => {
    if (!user || !vendorSearch || vendorSearch.length < 2) {
      setVendorSuggestions([]);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      try {
        const results = await searchVendors(vendorSearch, user.id, 5);
        setVendorSuggestions(results);
      } catch (error) {
        console.error('Vendor search error:', error);
        setVendorSuggestions([]);
      }
    }, 150);

    return () => clearTimeout(searchTimeout);
  }, [vendorSearch, user]);

  // Handle vendor selection from autocomplete
  const handleSelectVendor = useCallback((matchedVendor: MatchedVendor) => {
    setVendor(matchedVendor.display_name);
    setSelectedVendorId(matchedVendor.id);
    setShowVendorSuggestions(false);
    setVendorSearch('');

    const appliedDefaults: { category?: string; vatRate?: string } = {};

    // Apply default category if not already set
    if (matchedVendor.default_category && !category) {
      setCategory(matchedVendor.default_category.name);
      appliedDefaults.category = matchedVendor.default_category.name;
    }

    // Apply default VAT rate if not already set
    if (matchedVendor.default_vat_rate !== null && vatRate === '20') {
      setVatRate(matchedVendor.default_vat_rate.toString());
      appliedDefaults.vatRate = matchedVendor.default_vat_rate.toString() + '%';
    }

    if (Object.keys(appliedDefaults).length > 0) {
      setVendorDefaultsApplied(appliedDefaults);
      toast({
        title: 'Lieferant-Standardwerte angewendet',
        description: Object.entries(appliedDefaults)
          .map(([key, val]) => `${key === 'category' ? 'Kategorie' : 'MwSt'}: ${val}`)
          .join(', '),
      });
    }
  }, [category, vatRate, toast]);

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
    if (!receipt?.file_url || isRerunning || !signedUrl || !user) return;

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

      // 3. Match or create vendor based on detected name
      const vendorName = normalized.vendor_brand || normalized.vendor;
      const matchedVendor = await matchOrCreateVendor(vendorName, user.id);

      // 4. Track changed fields
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
      compareAndUpdate('Zahlungsart', paymentMethod, normalized.payment_method, setPaymentMethod);
      
      // Apply vendor matching: set vendor_id and use display_name
      if (matchedVendor) {
        setSelectedVendorId(matchedVendor.id);
        if (matchedVendor.display_name !== vendor) {
          compareAndUpdate('Lieferant', vendor, matchedVendor.display_name, setVendor);
        }
        
        // Vendor default category ALWAYS takes precedence when set
        if (matchedVendor.default_category) {
          const categoryName = matchedVendor.default_category.name;
          if (category !== categoryName) {
            changes['Kategorie'] = { old: category || '-', new: `${categoryName} (Lieferanten-Standard)` };
            setCategory(categoryName);
          }
        } else {
          compareAndUpdate('Kategorie', category, normalized.category, setCategory);
        }
        
        // Apply vendor default VAT rate if AI didn't detect one
        if (matchedVendor.default_vat_rate !== null && normalized.vat_rate === null) {
          const newRate = matchedVendor.default_vat_rate.toString();
          if (vatRate !== newRate) {
            changes['MwSt-Satz'] = { old: vatRate || '-', new: `${newRate}% (Lieferanten-Standard)` };
            setVatRate(newRate);
          }
        } else if (normalized.vat_rate !== null) {
          const newRate = normalized.vat_rate.toString();
          if (vatRate !== newRate) {
            changes['MwSt-Satz'] = { old: vatRate || '-', new: newRate + '%' };
            setVatRate(newRate);
          }
        }
      } else {
        // No vendor matched - use AI values directly
        compareAndUpdate('Kategorie', category, normalized.category, setCategory);
        if (normalized.vat_rate !== null) {
          const newRate = normalized.vat_rate.toString();
          if (vatRate !== newRate) {
            changes['MwSt-Satz'] = { old: vatRate || '-', new: newRate + '%' };
            setVatRate(newRate);
          }
        }
      }
      
      if (normalized.amount_gross !== null) {
        const newAmount = normalized.amount_gross.toString();
        if (amountGross !== newAmount) {
          changes['Bruttobetrag'] = { old: amountGross || '-', new: newAmount };
          setAmountGross(newAmount);
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

      // 5. Update confidence
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

  const handleSave = async (newStatus?: 'approved' | 'rejected' | 'review') => {
    if (!receipt) return;

    setSaving(true);
    try {
      // Process description according to user settings
      const processedDescription = description 
        ? processDescription(description, descriptionSettings)
        : null;
      
      // Build update data
      const updateData: Record<string, unknown> = {
        vendor: vendor || null,
        vendor_brand: vendorBrand || null,
        vendor_id: selectedVendorId || null,
        description: processedDescription,
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
        review: 'Beleg zur Überprüfung',
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
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent 
          className="max-w-[95vw] w-[95vw] h-[95vh] max-h-[95vh] p-0 gap-0 flex flex-col overflow-hidden"
          style={{ maxWidth: '95vw', width: '95vw', height: '95vh', maxHeight: '95vh' }}
        >
          {/* Header */}
          <DialogHeader className="px-6 py-3 border-b flex-shrink-0">
            <DialogTitle className="text-lg font-semibold">
              {loading ? 'Beleg laden...' : 'Beleg-Details'}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex-1 p-6 flex gap-6">
              <Skeleton className="w-1/2 h-full" />
              <div className="w-1/2 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ) : receipt ? (
            <div className="flex-1 flex overflow-hidden">
              {/* LEFT COLUMN - Document Preview */}
              <div className="w-1/2 bg-muted/50 flex flex-col border-r">
                {/* Preview Header with Controls - Only for images (PDFs have their own controls) */}
                {!isPdf && (
                  <div className="flex items-center justify-between px-4 py-2 border-b bg-background flex-shrink-0">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground min-w-[60px] text-center">1 / 1</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!isImage} onClick={() => isZoomed && setIsZoomed(false)}>
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground min-w-[50px] text-center">{isZoomed ? '150%' : '100%'}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!isImage} onClick={() => !isZoomed && setIsZoomed(true)}>
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Main Preview Area - Maximum Size */}
                <div className="flex-1 p-4 overflow-auto flex items-start justify-center">
                  {fileLoading ? (
                    <div className="flex flex-col items-center justify-center h-full">
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                      <p className="mt-2 text-sm text-muted-foreground">Lade Vorschau...</p>
                    </div>
                  ) : fileError ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                      <AlertCircle className="h-12 w-12" />
                      <p className="text-center text-foreground">Vorschau konnte nicht geladen werden</p>
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
                    isPdf ? (
                      <div className="w-full h-full" style={{ minHeight: 'calc(95vh - 140px)' }}>
                        <PdfViewer 
                          url={previewBlobUrl} 
                          fileName={receipt?.file_name}
                          onError={() => setFileError(true)}
                          className="h-full"
                        />
                      </div>
                    ) : isImage ? (
                      <img
                        src={previewBlobUrl}
                        alt={receipt.file_name || 'Beleg'}
                        className={cn(
                          "transition-transform duration-300 rounded shadow-lg cursor-zoom-in",
                          isZoomed ? "scale-150 cursor-zoom-out" : "max-w-full max-h-full object-contain"
                        )}
                        onClick={() => setIsZoomed(!isZoomed)}
                        onError={() => setFileError(true)}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                        <FileText className="h-24 w-24" />
                        <p className="font-medium text-foreground">{receipt?.file_name}</p>
                        <p className="text-sm">Vorschau nicht verfügbar</p>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={handleDownload}>
                            <Download className="h-4 w-4 mr-2" />
                            Herunterladen
                          </Button>
                          <Button variant="outline" onClick={handleOpenInNewTab}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            In neuem Tab
                          </Button>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                      <FileText className="h-24 w-24" />
                      <p>Keine Datei vorhanden</p>
                    </div>
                  )}
                </div>

                {/* Preview Footer with Filename */}
                <div className="px-4 py-2 border-t bg-background text-center flex-shrink-0">
                  <p className="text-xs text-muted-foreground truncate">Datei: {receipt?.file_name}</p>
                </div>
              </div>

              {/* RIGHT COLUMN - Form Only */}
              <div className="w-1/2 flex flex-col bg-background">
                {/* AI Badge Header */}
                <div className="flex items-center justify-between p-4 border-b">
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

                {/* Scrollable Form Area */}
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-4">
                    {/* Duplicate Warning */}
                    {receipt?.is_duplicate && receipt?.duplicate_of && (
                      <Alert className="bg-warning/10 border-warning/30">
                        <Copy className="h-4 w-4 text-warning" />
                        <AlertDescription className="text-warning">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">Mögliches Duplikat</p>
                              <p className="text-sm opacity-80">
                                {receipt.duplicate_score || 0}% Übereinstimmung mit einem anderen Beleg
                              </p>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="border-warning/30 text-warning hover:bg-warning/10"
                              onClick={() => {
                                if (receipt.duplicate_of) {
                                  window.location.href = `/expenses?duplicateCompare=${receipt.id}&original=${receipt.duplicate_of}`;
                                }
                              }}
                            >
                              Vergleichen
                            </Button>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

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

                    {/* Vendor with Autocomplete */}
                    <div className="relative">
                      <Label htmlFor="vendor">
                        {vendorBrand && vendorBrand !== vendor ? 'Firmenname (rechtlich)' : 'Lieferant'}
                      </Label>
                      <div className="relative">
                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="vendor"
                          value={vendor}
                          onChange={(e) => {
                            setVendor(e.target.value);
                            setVendorSearch(e.target.value);
                            setShowVendorSuggestions(true);
                            setSelectedVendorId(null);
                            setVendorDefaultsApplied(null);
                          }}
                          onFocus={() => {
                            if (vendor.length >= 2) {
                              setVendorSearch(vendor);
                              setShowVendorSuggestions(true);
                            }
                          }}
                          onBlur={() => {
                            // Delay to allow click on suggestion
                            setTimeout(() => setShowVendorSuggestions(false), 200);
                          }}
                          placeholder="Lieferant suchen oder eingeben..."
                          className="pl-10"
                        />
                      </div>

                      {/* Suggestions Dropdown */}
                      {showVendorSuggestions && vendorSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg overflow-hidden">
                          {vendorSuggestions.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              className="w-full px-3 py-2 text-left hover:bg-muted flex items-center justify-between transition-colors"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectVendor(v);
                              }}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">{v.display_name}</p>
                                {v.legal_name && v.legal_name !== v.display_name && (
                                  <p className="text-xs text-muted-foreground truncate">{v.legal_name}</p>
                                )}
                              </div>
                              {v.default_category && (
                                <Badge 
                                  variant="outline" 
                                  className="text-xs ml-2 flex-shrink-0"
                                  style={{ 
                                    color: v.default_category.color || undefined,
                                    borderColor: v.default_category.color || undefined,
                                  }}
                                >
                                  {v.default_category.name}
                                </Badge>
                              )}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Vendor defaults applied indicator */}
                      {vendorDefaultsApplied && (
                        <p className="text-xs text-green-600 mt-1 flex items-center">
                          <Check className="w-3 h-3 mr-1" />
                          Standardwerte angewendet
                        </p>
                      )}
                    </div>
                    
                    {/* Brand name field if exists or vendor has legal suffix */}
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

                    {/* Description with character counter */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="description">Beschreibung</Label>
                        <span className={cn(
                          "text-xs",
                          description.length > descriptionSettings.max_length 
                            ? "text-orange-500" 
                            : "text-muted-foreground"
                        )}>
                          {description.length} / {descriptionSettings.max_length} Zeichen
                        </span>
                      </div>
                      <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Zusammenfassung der Rechnungspositionen..."
                        rows={2}
                        maxLength={descriptionSettings.max_length + 50}
                        className={cn(
                          description.length > descriptionSettings.max_length &&
                          "border-orange-300 focus-visible:ring-orange-500"
                        )}
                      />
                      {description.length > descriptionSettings.max_length && (
                        <p className="text-xs text-orange-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Wird beim Speichern auf {descriptionSettings.max_length} Zeichen gekürzt
                        </p>
                      )}
                    </div>

                    {/* Date */}
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

                    {/* Invoice Number */}
                    <div>
                      <Label htmlFor="invoiceNumber">Rechnungsnummer</Label>
                      <Input
                        id="invoiceNumber"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="z.B. RE-2024-001"
                      />
                    </div>

                    {/* Category */}
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

                    {/* Amount & VAT */}
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

                    {/* Net & VAT Amount (calculated) */}
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

                    {/* Payment Method */}
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

                    {/* Notes */}
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

                    {/* Export Filename - at the bottom of the form */}
                    <div className="border rounded-lg p-3 bg-muted/30">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm font-medium">Export-Dateiname</Label>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setIsEditingFilename(!isEditingFilename)}
                        >
                          {isEditingFilename ? (
                            <>
                              <X className="w-3 h-3 mr-1" />
                              Abbrechen
                            </>
                          ) : (
                            <>
                              <Pencil className="w-3 h-3 mr-1" />
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
                            <code className="text-xs bg-background px-2 py-1 rounded border flex-1 truncate">
                              {displayFilename}
                            </code>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8"
                              onClick={handleCopyFilename}
                              title="Kopieren"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                          
                          {receipt.custom_filename && (
                            <p className="text-xs text-amber-600 flex items-center">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Benutzerdefinierter Name (weicht von Vorlage ab)
                            </p>
                          )}

                          {receipt.custom_filename && generatedFilename !== displayFilename && (
                            <p className="text-xs text-muted-foreground">
                              Nach Vorlage wäre: {generatedFilename}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>

                {/* Action Buttons Footer */}
                <div className="flex items-center justify-between p-4 border-t">
                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={saving}
                  >
                    Löschen
                  </Button>
                  <div className="flex gap-2">
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
                      className="border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                      onClick={() => handleSave('review')}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Überprüfen
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
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-muted-foreground">Beleg nicht gefunden</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
