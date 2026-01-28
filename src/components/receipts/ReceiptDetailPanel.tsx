import { useState, useEffect, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Download,
  ExternalLink,
  Loader2,
  Sparkles,
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
  Hash,
  CalendarIcon as CalendarIconLucide,
  Euro,
  Percent,
  MousePointer,
  Square,
  Settings,
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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useReceipts, type Receipt } from '@/hooks/useReceipts';
import { useCategories } from '@/hooks/useCategories';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PdfViewer } from './PdfViewer';
import { extractReceiptData, normalizeExtractionResult, fetchDescriptionSettings, processDescription, DEFAULT_DESCRIPTION_SETTINGS, type DescriptionSettings } from '@/services/aiService';
import { matchOrCreateVendor } from '@/services/vendorMatchingService';
import { VendorAutocomplete } from './VendorAutocomplete';
import { 
  generateFileName, 
  getFileExtension,
  parseNamingSettings, 
  DEFAULT_NAMING_SETTINGS,
  type NamingSettings 
} from '@/lib/filenameUtils';
import { AlertTriangle, GraduationCap } from 'lucide-react';
import { useCorrectionTracking, type CorrectionData } from '@/hooks/useCorrectionTracking';
import { LEARNABLE_FIELDS } from '@/types/learning';
import { useVendorLearning } from '@/hooks/useVendorLearning';
import { LearnableField } from './LearnableField';
import { SaveWithLearningDialog, type FieldChange } from './SaveWithLearningDialog';
import { ManualTrainingModal } from './ManualTrainingModal';

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

// Fields that can be selectively re-analyzed by AI
const REANALYZABLE_FIELDS = [
  { id: 'vendor', label: 'Lieferant', icon: Building },
  { id: 'invoice_number', label: 'Rechnungsnummer', icon: Hash },
  { id: 'receipt_date', label: 'Datum', icon: CalendarIconLucide },
  { id: 'amount_gross', label: 'Bruttobetrag', icon: Euro },
  { id: 'amount_net', label: 'Nettobetrag', icon: Euro },
  { id: 'vat_rate', label: 'MwSt-Satz', icon: Percent },
  { id: 'vat_amount', label: 'Vorsteuer', icon: Percent },
  { id: 'description', label: 'Beschreibung', icon: FileText },
] as const;

export function ReceiptDetailPanel({ 
  receiptId, 
  open, 
  onClose, 
  onUpdate 
}: ReceiptDetailPanelProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { getReceipt, updateReceipt, rejectReceipt, deleteReceipt } = useReceipts();
  const { categories } = useCategories();
  const { trackCorrections, trackSuccessfulPrediction } = useCorrectionTracking();

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
  
  // Selective field reanalysis state
  const [showFieldSelectDialog, setShowFieldSelectDialog] = useState(false);
  const [selectedReanalysisFields, setSelectedReanalysisFields] = useState<string[]>([]);
  const [showFullReanalyzeConfirm, setShowFullReanalyzeConfirm] = useState(false);

  // Filename editing state
  const [isEditingFilename, setIsEditingFilename] = useState(false);
  const [customFilename, setCustomFilename] = useState('');
  const [namingSettings, setNamingSettings] = useState<NamingSettings>(DEFAULT_NAMING_SETTINGS);
  const [descriptionSettings, setDescriptionSettings] = useState<DescriptionSettings>(DEFAULT_DESCRIPTION_SETTINGS);

  // Vendor state
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);

  // Original receipt data for tracking changes
  const [originalReceipt, setOriginalReceipt] = useState<Receipt | null>(null);

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

  // Field changes tracking for learning dialog
  const [fieldChanges, setFieldChanges] = useState<Record<string, FieldChange>>({});
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [rememberCorrections, setRememberCorrections] = useState(true);

  // Manual training state
  const [showManualTraining, setShowManualTraining] = useState(false);

  // Vendor learning data
  const { vendorLearning } = useVendorLearning(selectedVendorId);

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
          setOriginalReceipt(data); // Store original for change tracking
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
          setSelectedVendorId(data.vendor_id || null);
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


  // Handle vendor selection from autocomplete
  const handleVendorSelect = useCallback((vendorData: {
    id: string;
    display_name: string;
    legal_name: string | null;
    default_category_id: string | null;
    default_vat_rate: number | null;
    default_category: { id: string; name: string; color: string | null } | null;
  }) => {
    // Set legal name as the main vendor field (or display_name as fallback)
    const legalName = vendorData.legal_name || vendorData.display_name;
    setVendor(legalName);
    setSelectedVendorId(vendorData.id);

    const applied: string[] = ['Lieferant'];

    // Set brand name only if different from legal name
    if (vendorData.legal_name && vendorData.display_name !== vendorData.legal_name) {
      setVendorBrand(vendorData.display_name);
      applied.push('Markenname');
    }
    // Don't clear vendorBrand if no brand - leave existing value

    // Apply default category if not already set
    if (vendorData.default_category && !category) {
      setCategory(vendorData.default_category.name);
      applied.push('Kategorie');
    }

    // Apply default VAT rate if not already set
    if (vendorData.default_vat_rate !== null && vatRate === '20') {
      setVatRate(vendorData.default_vat_rate.toString());
      applied.push('MwSt-Satz');
    }

    toast({
      title: `${applied.join(', ')} vom Lieferanten übernommen`,
    });
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

  // AI Re-run handler - supports selective field reanalysis
  const reanalyzeFields = async (fieldsToUpdate: string[]) => {
    if (!receipt?.file_url || isRerunning || !signedUrl || !user) return;
    if (fieldsToUpdate.length === 0) return;

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
      
      const shouldUpdate = (fieldId: string) => fieldsToUpdate.includes(fieldId);
      
      const compareAndUpdate = (fieldId: string, displayName: string, oldVal: string, newVal: string | null, setter: (val: string) => void) => {
        if (!shouldUpdate(fieldId)) return;
        const newValue = newVal || '';
        if (oldVal !== newValue && newValue) {
          changes[displayName] = { old: oldVal || '-', new: newValue };
          setter(newValue);
        }
      };

      // Update vendor if selected
      if (shouldUpdate('vendor')) {
        const vendorName = normalized.vendor_brand || normalized.vendor;
        const matchedVendor = await matchOrCreateVendor(vendorName, user.id);
        
        if (matchedVendor) {
          setSelectedVendorId(matchedVendor.id);
          if (matchedVendor.display_name !== vendor) {
            changes['Lieferant'] = { old: vendor || '-', new: matchedVendor.display_name };
            setVendor(matchedVendor.display_name);
          }
          if (normalized.vendor_brand) {
            setVendorBrand(normalized.vendor_brand);
          }
        } else {
          compareAndUpdate('vendor', 'Lieferant', vendor, normalized.vendor, setVendor);
          if (normalized.vendor_brand) {
            setVendorBrand(normalized.vendor_brand);
          }
        }
      }

      compareAndUpdate('description', 'Beschreibung', description, normalized.description, setDescription);
      compareAndUpdate('invoice_number', 'Rechnungsnummer', invoiceNumber, normalized.invoice_number, setInvoiceNumber);
      
      if (shouldUpdate('receipt_date') && normalized.receipt_date) {
        const newDate = new Date(normalized.receipt_date);
        const oldDateStr = receiptDate ? format(receiptDate, 'dd.MM.yyyy') : '-';
        const newDateStr = format(newDate, 'dd.MM.yyyy');
        if (oldDateStr !== newDateStr) {
          changes['Datum'] = { old: oldDateStr, new: newDateStr };
          setReceiptDate(newDate);
        }
      }
      
      if (shouldUpdate('amount_gross') && normalized.amount_gross !== null) {
        const newAmount = normalized.amount_gross.toString();
        if (amountGross !== newAmount) {
          changes['Bruttobetrag'] = { old: amountGross || '-', new: newAmount };
          setAmountGross(newAmount);
        }
      }
      
      if (shouldUpdate('vat_rate') && normalized.vat_rate !== null) {
        const newRate = normalized.vat_rate.toString();
        if (vatRate !== newRate) {
          changes['MwSt-Satz'] = { old: vatRate || '-', new: newRate + '%' };
          setVatRate(newRate);
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

  // General reanalysis modes
  const reanalyzeGeneral = async (mode: 'smart' | 'empty' | 'full') => {
    let fieldsToAnalyze: string[];
    
    switch (mode) {
      case 'smart':
        // Only fields the user has NOT manually modified
        fieldsToAnalyze = REANALYZABLE_FIELDS
          .map(f => f.id)
          .filter(id => !receipt?.user_modified_fields?.includes(id));
        
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
        fieldsToAnalyze = REANALYZABLE_FIELDS
          .map(f => f.id)
          .filter(id => {
            const value = receipt?.[id as keyof Receipt];
            return !value || value === '';
          });
        
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

  // Reanalyze only fields that haven't been manually modified
  const reanalyzeUnmodifiedFields = () => {
    const modifiedFields = receipt?.user_modified_fields || [];
    const unmodifiedFields = REANALYZABLE_FIELDS
      .map(f => f.id)
      .filter(id => !modifiedFields.includes(id));
    reanalyzeFields(unmodifiedFields);
  };

  // Reanalyze a single field
  const reanalyzeSingleField = (fieldId: string) => {
    reanalyzeFields([fieldId]);
  };


  // Fields that are tracked for manual modifications
  const TRACKABLE_FIELDS = [
    'vendor', 'invoice_number', 'receipt_date', 
    'amount_gross', 'amount_net', 'vat_rate', 'vat_amount', 
    'description', 'category'
  ] as const;

  // Calculate current field changes for learning dialog
  const calculateFieldChanges = useCallback((): Record<string, FieldChange> => {
    if (!originalReceipt) return {};
    
    const changes: Record<string, FieldChange> = {};
    const currentValues: Record<string, unknown> = {
      vendor: vendor || null,
      invoice_number: invoiceNumber || null,
      receipt_date: receiptDate ? format(receiptDate, 'yyyy-MM-dd') : null,
      amount_gross: parseFloat(amountGross) || null,
      vat_rate: parseFloat(vatRate) || null,
      description: description || null,
      category: category || null,
    };
    
    for (const field of LEARNABLE_FIELDS) {
      const fieldId = field.id;
      if (fieldId === 'amount_net' || fieldId === 'vat_amount') continue; // Skip calculated fields
      
      const originalValue = originalReceipt[fieldId as keyof Receipt];
      const newValue = currentValues[fieldId];
      
      const normalizedOriginal = originalValue === undefined ? null : originalValue;
      const normalizedNew = newValue === undefined ? null : newValue;
      
      if (String(normalizedOriginal || '') !== String(normalizedNew || '')) {
        changes[fieldId] = {
          original: normalizedOriginal,
          current: normalizedNew
        };
      }
    }
    
    return changes;
  }, [originalReceipt, vendor, invoiceNumber, receiptDate, amountGross, vatRate, description, category]);

  // Handle save click - show dialog if there are changes and vendor assigned
  const handleSaveClick = (newStatus?: 'approved' | 'rejected' | 'review') => {
    const changes = calculateFieldChanges();
    const hasChanges = Object.keys(changes).length > 0;
    
    if (hasChanges && selectedVendorId) {
      setFieldChanges(changes);
      setShowSaveDialog(true);
      // Store status for later execution
      (window as unknown as { pendingSaveStatus?: typeof newStatus }).pendingSaveStatus = newStatus;
    } else {
      handleSave(newStatus);
    }
  };

  // Execute save after dialog confirmation
  const executeSaveWithLearning = () => {
    const pendingStatus = (window as unknown as { pendingSaveStatus?: 'approved' | 'rejected' | 'review' }).pendingSaveStatus;
    setShowSaveDialog(false);
    
    // If user chose not to remember, we still save but skip the learning
    if (!rememberCorrections) {
      // Save without learning - we'll handle this in handleSave
      setFieldChanges({}); // Clear changes so tracking doesn't happen
    }
    
    handleSave(pendingStatus);
  };

  const handleSave = async (newStatus?: 'approved' | 'rejected' | 'review') => {
    if (!receipt || !originalReceipt) return;

    setSaving(true);
    try {
      // If rejecting, use rejectReceipt to clear file_hash for re-upload capability
      if (newStatus === 'rejected') {
        await rejectReceipt(receipt.id, { deleteFile: true, reason: 'Manuell abgelehnt' });
        
        toast({
          title: 'Beleg abgelehnt',
          description: 'Die Datei kann erneut hochgeladen werden',
        });

        // Reset AI changes state
        setHasUnsavedAiChanges(false);
        setChangedFields({});

        // Notify parent
        onUpdate?.();
        setSaving(false);
        return;
      }

      // Process description according to user settings
      const processedDescription = description 
        ? processDescription(description, descriptionSettings)
        : null;
      
      // Track which fields were manually modified
      const existingModifiedFields = (receipt.user_modified_fields as string[]) || [];
      const modifiedFields = new Set(existingModifiedFields);

      // Current form values mapped to field names
      const currentValues: Record<string, unknown> = {
        vendor: vendor || null,
        invoice_number: invoiceNumber || null,
        receipt_date: receiptDate ? format(receiptDate, 'yyyy-MM-dd') : null,
        amount_gross: parseFloat(amountGross) || null,
        amount_net: calculatedValues.net || null,
        vat_rate: parseFloat(vatRate) || null,
        vat_amount: calculatedValues.vat || null,
        description: processedDescription,
        category: category || null,
      };

      // Check each trackable field for changes
      for (const fieldId of TRACKABLE_FIELDS) {
        const originalValue = originalReceipt[fieldId as keyof Receipt];
        const newValue = currentValues[fieldId];
        
        // Normalize values for comparison
        const normalizedOriginal = originalValue === undefined ? null : originalValue;
        const normalizedNew = newValue === undefined ? null : newValue;
        
        // If value changed and not already tracked, add to modified fields
        if (String(normalizedOriginal) !== String(normalizedNew)) {
          modifiedFields.add(fieldId);
        }
      }

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
        user_modified_fields: Array.from(modifiedFields),
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

      // Track corrections for AI learning (only if vendor is assigned)
      if (selectedVendorId) {
        const corrections: CorrectionData[] = [];
        
        for (const field of LEARNABLE_FIELDS) {
          const fieldId = field.id;
          const originalValue = originalReceipt[fieldId as keyof Receipt];
          const newValue = currentValues[fieldId];
          
          // Normalize values for comparison
          const normalizedOriginal = originalValue === undefined ? null : originalValue;
          const normalizedNew = newValue === undefined ? null : newValue;
          
          if (String(normalizedOriginal || '') !== String(normalizedNew || '')) {
            corrections.push({
              fieldName: fieldId,
              detectedValue: normalizedOriginal,
              correctedValue: normalizedNew,
              receiptId: receipt.id,
              vendorId: selectedVendorId
            });
          }
        }
        
        if (corrections.length > 0) {
          // Track corrections for AI learning
          trackCorrections(corrections);
        } else {
          // No corrections = AI was correct, track successful prediction
          trackSuccessfulPrediction(receipt.id, selectedVendorId);
        }
      }

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
              <div className="w-1/2 flex flex-col bg-background relative">
                {/* Loading Overlay during reanalysis */}
                {isRerunning && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 rounded-lg backdrop-blur-sm">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                      <p className="text-sm text-muted-foreground mt-2">Analysiere...</p>
                    </div>
                  </div>
                )}
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
                          variant="outline" 
                          size="sm" 
                          disabled={isRerunning || fileLoading}
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
                          {(receipt.user_modified_fields?.length || 0) > 0 && (
                            <Badge variant="outline" className="text-xs ml-2">
                              {REANALYZABLE_FIELDS.length - (receipt.user_modified_fields?.length || 0)} Felder
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
                        
                        <DropdownMenuItem onClick={() => setShowFieldSelectDialog(true)}>
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
                            onClick={() => reanalyzeSingleField('vendor')}
                            className="flex-col items-start py-1.5"
                          >
                            <div className="flex items-center gap-1">
                              <Building className="w-3 h-3" />
                              <span className="text-xs">Lieferant</span>
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
                              <CalendarIconLucide className="w-3 h-3" />
                              <span className="text-xs">Datum</span>
                            </div>
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem 
                            onClick={() => reanalyzeFields(['amount_gross', 'amount_net', 'vat_amount', 'vat_rate'])}
                            className="flex-col items-start py-1.5"
                          >
                            <div className="flex items-center gap-1">
                              <Euro className="w-3 h-3" />
                              <span className="text-xs">Beträge</span>
                            </div>
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem 
                            onClick={() => reanalyzeSingleField('description')}
                            className="flex-col items-start py-1.5 col-span-2"
                          >
                            <div className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              <span className="text-xs">Beschreibung</span>
                            </div>
                          </DropdownMenuItem>
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {/* Manual Training Button - shown when confidence is low */}
                  {selectedVendorId && (receipt?.ai_confidence ?? 0) < 0.7 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowManualTraining(true)}
                          className="border-orange-300 text-orange-700 hover:bg-orange-50"
                        >
                          <GraduationCap className="w-4 h-4 mr-1" />
                          KI trainieren
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Die KI-Erkennung war unsicher ({Math.round((receipt?.ai_confidence ?? 0) * 100)}%).</p>
                        <p className="text-xs text-muted-foreground">Gib manuelle Hinweise um zukünftige Erkennungen zu verbessern.</p>
                      </TooltipContent>
                    </Tooltip>
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
                    <VendorAutocomplete
                      value={vendor}
                      vendorId={selectedVendorId}
                      onChange={(value, id) => {
                        setVendor(value);
                        setSelectedVendorId(id || null);
                      }}
                      onVendorSelect={handleVendorSelect}
                      disabled={saving}
                    />
                    
                    {/* Brand name field - shown if exists or if vendor looks like a legal name */}
                    {(vendorBrand || vendor.match(/(GmbH|AG|e\.U\.|OG|KG|Ltd\.|S\.à r\.l\.|ApS|Inc\.|Corp\.)/i)) && (
                      <div>
                        <Label htmlFor="vendorBrand" className="text-muted-foreground flex items-center gap-2">
                          Markenname
                          {selectedVendorId && (
                            <span className="text-xs font-normal">(aus Lieferantenstamm)</span>
                          )}
                        </Label>
                        {selectedVendorId ? (
                          // Read-only when linked to a vendor
                          <div className="flex items-center gap-2">
                            <Input
                              id="vendorBrand"
                              value={vendorBrand}
                              readOnly
                              disabled
                              className="text-muted-foreground bg-muted/50"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="shrink-0 text-xs"
                              onClick={() => {
                                window.open('/settings?tab=vendors', '_blank');
                              }}
                            >
                              <Settings className="w-3 h-3 mr-1" />
                              Bearbeiten
                            </Button>
                          </div>
                        ) : (
                          // Editable when no vendor linked (new vendor)
                          <Input
                            id="vendorBrand"
                            value={vendorBrand}
                            onChange={(e) => setVendorBrand(e.target.value)}
                            placeholder="z.B. Amazon, spusu, MediaMarkt"
                            className="text-muted-foreground"
                          />
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {selectedVendorId 
                            ? 'Änderungen nur in der Lieferantenverwaltung möglich'
                            : 'Bekannter Name/Marke falls abweichend vom rechtlichen Namen'
                          }
                        </p>
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
                    <LearnableField
                      fieldName="invoice_number"
                      label="Rechnungsnummer"
                      value={invoiceNumber}
                      originalValue={originalReceipt?.invoice_number}
                      vendorLearning={vendorLearning}
                      onReset={() => setInvoiceNumber(originalReceipt?.invoice_number || '')}
                    >
                      <Input
                        id="invoiceNumber"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="z.B. RE-2024-001"
                      />
                    </LearnableField>

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
                      <LearnableField
                        fieldName="amount_gross"
                        label="Bruttobetrag"
                        value={parseFloat(amountGross) || null}
                        originalValue={originalReceipt?.amount_gross}
                        vendorLearning={vendorLearning}
                        onReset={() => setAmountGross(originalReceipt?.amount_gross?.toString() || '')}
                      >
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
                      </LearnableField>
                      <LearnableField
                        fieldName="vat_rate"
                        label="MwSt-Satz"
                        value={parseFloat(vatRate) || null}
                        originalValue={originalReceipt?.vat_rate}
                        vendorLearning={vendorLearning}
                        onReset={() => setVatRate(originalReceipt?.vat_rate?.toString() || '20')}
                      >
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
                      </LearnableField>
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
                      onClick={() => handleSaveClick('rejected')}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Ablehnen
                    </Button>
                    <Button
                      variant="outline"
                      className="border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                      onClick={() => handleSaveClick('review')}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Überprüfen
                    </Button>
                    <Button
                      variant="outline"
                      className="border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
                      onClick={() => handleSaveClick('approved')}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Freigeben
                    </Button>
                    <Button
                      className="gradient-primary hover:opacity-90"
                      onClick={() => handleSaveClick()}
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

      {/* Field Selection Dialog for Re-analysis */}
      <Dialog open={showFieldSelectDialog} onOpenChange={setShowFieldSelectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Felder neu analysieren</DialogTitle>
            <DialogDescription>
              Wähle die Felder die neu erkannt werden sollen.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="grid grid-cols-2 gap-2">
              {REANALYZABLE_FIELDS.map(field => {
                const Icon = field.icon;
                const currentValue = receipt?.[field.id as keyof Receipt];
                const isModified = receipt?.user_modified_fields?.includes(field.id);
                const isSelected = selectedReanalysisFields.includes(field.id);
                
                return (
                  <button
                    key={field.id}
                    type="button"
                    onClick={() => {
                      setSelectedReanalysisFields(prev =>
                        prev.includes(field.id)
                          ? prev.filter(f => f !== field.id)
                          : [...prev, field.id]
                      );
                    }}
                    className={cn(
                      "flex items-start gap-2 p-3 border rounded-lg text-left transition-all",
                      isSelected 
                        ? "border-primary bg-primary/5" 
                        : "hover:bg-muted"
                    )}
                  >
                    <Checkbox 
                      checked={isSelected} 
                      className="mt-0.5 pointer-events-none" 
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <Icon className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm font-medium">{field.label}</span>
                        {isModified && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Pencil className="w-3 h-3 text-orange-500" />
                            </TooltipTrigger>
                            <TooltipContent>Manuell bearbeitet</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {currentValue?.toString() || '(leer)'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
            
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSelectedReanalysisFields(REANALYZABLE_FIELDS.map(f => f.id))}
              >
                Alle
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSelectedReanalysisFields([])}
              >
                Keine
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSelectedReanalysisFields(
                  REANALYZABLE_FIELDS.filter(f => !receipt?.[f.id as keyof Receipt]).map(f => f.id)
                )}
              >
                Nur leere
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSelectedReanalysisFields(
                  REANALYZABLE_FIELDS.filter(f => !receipt?.user_modified_fields?.includes(f.id)).map(f => f.id)
                )}
              >
                Nur unveränderte
              </Button>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFieldSelectDialog(false)}>
              Abbrechen
            </Button>
            <Button 
              onClick={() => {
                reanalyzeFields(selectedReanalysisFields);
                setShowFieldSelectDialog(false);
              }}
              disabled={selectedReanalysisFields.length === 0}
            >
              {selectedReanalysisFields.length} Feld(er) analysieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full Re-analyze Confirmation */}
      <AlertDialog open={showFullReanalyzeConfirm} onOpenChange={setShowFullReanalyzeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-5 h-5" />
              Komplett neu analysieren?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>ALLE Felder werden überschrieben, auch deine manuellen Korrekturen.</p>
                
                {(receipt?.user_modified_fields?.length || 0) > 0 && (
                  <div className="mt-3 p-2 bg-orange-50 rounded border border-orange-200">
                    <p className="text-sm text-orange-800 font-medium mb-1">
                      Folgende Felder wurden manuell bearbeitet:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {receipt?.user_modified_fields?.map(fieldId => (
                        <Badge key={fieldId} variant="outline" className="text-xs">
                          {REANALYZABLE_FIELDS.find(f => f.id === fieldId)?.label || fieldId}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
              Ja, alles überschreiben
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save with Learning Dialog */}
      <SaveWithLearningDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        fieldChanges={fieldChanges}
        vendorName={vendor || 'Unbekannt'}
        rememberCorrections={rememberCorrections}
        onRememberChange={setRememberCorrections}
        onConfirm={executeSaveWithLearning}
      />

      {/* Manual Training Modal */}
      {selectedVendorId && (
        <ManualTrainingModal
          open={showManualTraining}
          onOpenChange={setShowManualTraining}
          vendorId={selectedVendorId}
          vendorName={vendor || 'Unbekannt'}
          currentValues={{
            vendor,
            invoice_number: invoiceNumber,
            receipt_date: receiptDate ? format(receiptDate, 'yyyy-MM-dd') : '',
            amount_gross: amountGross,
            amount_net: calculatedValues.net.toFixed(2),
            vat_amount: calculatedValues.vat.toFixed(2),
            vat_rate: vatRate,
            description,
          }}
        />
      )}
    </>
  );
}
