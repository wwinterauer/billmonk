import { useState, useEffect, useMemo, useCallback } from 'react';
import { TAX_TYPES, PAYMENT_METHODS } from '@/lib/constants';
import { Repeat } from 'lucide-react';
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
  ChevronLeft,
  ChevronRight,
  Pencil,
  X,
  Check,
  RotateCcw,
  Copy,
  Settings,
  Tag,
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
  SelectGroup,
  SelectItem,
  SelectLabel,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useReceipts, type Receipt } from '@/hooks/useReceipts';
import { useCategories } from '@/hooks/useCategories';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PdfViewer } from './PdfViewer';
import { fetchDescriptionSettings, processDescription, DEFAULT_DESCRIPTION_SETTINGS, type DescriptionSettings } from '@/services/aiService';

import { VendorAutocomplete } from './VendorAutocomplete';
import { 
  generateFileName, 
  getFileExtension,
  parseNamingSettings, 
  DEFAULT_NAMING_SETTINGS,
  type NamingSettings 
} from '@/lib/filenameUtils';
import { AlertTriangle, GraduationCap, Trash2 } from 'lucide-react';
import { useCorrectionTracking, type CorrectionData } from '@/hooks/useCorrectionTracking';
import { LEARNABLE_FIELDS } from '@/types/learning';
import { useVendorLearning } from '@/hooks/useVendorLearning';
import { LearnableField } from './LearnableField';
import { SaveWithLearningDialog, type FieldChange } from './SaveWithLearningDialog';
import { ManualTrainingModal } from './ManualTrainingModal';
import { SourceBadge, NoReceiptBadge } from './SourceBadge';
import { ReanalyzeOptions } from './ReanalyzeOptions';
import { TagSelector } from '@/components/tags/TagSelector';
import { useTags } from '@/hooks/useTags';
import { SplitBookingEditor } from './SplitBookingEditor';
import { usePlan } from '@/hooks/usePlan';
import { useVatRates } from '@/hooks/useVatRates';

interface ReceiptDetailPanelProps {
  receiptId: string | null;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

interface TaxRateDetail {
  rate: number;
  net_amount: number;
  tax_amount: number;
  description?: string;
}



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
  const { splitBookingEnabled } = usePlan();
  const { vatRateGroups } = useVatRates();

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [emailData, setEmailData] = useState<{
    email_from: string | null;
    email_subject: string | null;
    email_received_at: string | null;
  } | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  
  // AI Re-analysis state (managed by ReanalyzeOptions but tracked here for change display)
  const [hasUnsavedAiChanges, setHasUnsavedAiChanges] = useState(false);
  const [changedFields, setChangedFields] = useState<Record<string, { old: string; new: string }>>({});
  const [currentAiConfidence, setCurrentAiConfidence] = useState<number | null>(null);
  
  // Recurring expense badge state
  const [recurringInfo, setRecurringInfo] = useState<{ frequency: string } | null>(null);

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
  const [isMixedTaxRate, setIsMixedTaxRate] = useState(false);
  const [taxRateDetails, setTaxRateDetails] = useState<TaxRateDetail[] | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [taxType, setTaxType] = useState('');
  const [notes, setNotes] = useState('');
  const [amountNetOverride, setAmountNetOverride] = useState('');
  const [vatAmountOverride, setVatAmountOverride] = useState('');
  // Field changes tracking for learning dialog
  const [fieldChanges, setFieldChanges] = useState<Record<string, FieldChange>>({});
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [rememberCorrections, setRememberCorrections] = useState(true);

  // Manual training state
  const [showManualTraining, setShowManualTraining] = useState(false);

  // Vendor learning data
  const { vendorLearning } = useVendorLearning(selectedVendorId);

  // Vendor extraction data for ReanalyzeOptions
  const [vendorExtractionData, setVendorExtractionData] = useState<{
    expenses_only_extraction: boolean;
    extraction_keywords: string[];
    extraction_hint: string;
  } | null>(null);

  useEffect(() => {
    if (!selectedVendorId) {
      setVendorExtractionData(null);
      return;
    }
    supabase
      .from('vendors')
      .select('expenses_only_extraction, extraction_keywords, extraction_hint')
      .eq('id', selectedVendorId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setVendorExtractionData({
            expenses_only_extraction: data.expenses_only_extraction,
            extraction_keywords: data.extraction_keywords || [],
            extraction_hint: data.extraction_hint || '',
          });
        } else {
          setVendorExtractionData(null);
        }
      });
  }, [selectedVendorId]);

  // Calculated values
  const calculatedValues = useMemo(() => {
    const gross = parseFloat(amountGross) || 0;
    
    // Bei gemischten Steuersätzen: Netto direkt aus den Details berechnen
    if (isMixedTaxRate && taxRateDetails && taxRateDetails.length > 0) {
      const totalNet = taxRateDetails.reduce((sum, d) => sum + (d.net_amount || 0), 0);
      const totalVat = taxRateDetails.reduce((sum, d) => sum + (d.tax_amount || 0), 0);
      return {
        net: totalNet,
        vat: totalVat,
      };
    }
    
    const rate = parseFloat(vatRate) || 0;
    const net = gross / (1 + rate / 100);
    const vat = gross - net;
    return {
      net: isNaN(net) ? 0 : net,
      vat: isNaN(vat) ? 0 : vat,
    };
  }, [amountGross, vatRate, isMixedTaxRate, taxRateDetails]);

  // Generated filename based on current form values
  const generatedFilename = useMemo(() => {
    const previewReceipt = {
      vendor,
      vendor_brand: vendorBrand,
      receipt_date: receiptDate ? format(receiptDate, 'yyyy-MM-dd') : null,
      amount_gross: amountGross !== '' ? parseFloat(amountGross) : null,
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
      setEmailData(null);
      setPreviewBlobUrl(null);
      setSignedUrl(null);
      setFileError(false);
      setIsEditingFilename(false);
      return;
    }

    const loadReceipt = async () => {
      setLoading(true);
      setEmailData(null);
      try {
        const data = await getReceipt(receiptId);
        if (data) {
          setReceipt(data);
          setOriginalReceipt(data); // Store original for change tracking
          
          // Load email attachment data if this is an email-imported receipt
          if (data.email_attachment_id) {
            const { data: emailAttachment } = await supabase
              .from('email_attachments')
              .select('email_from, email_subject, email_received_at')
              .eq('id', data.email_attachment_id)
              .single();
            
            if (emailAttachment) {
              setEmailData(emailAttachment);
            }
          }
          // Populate form
          setVendor(data.vendor || '');
          setVendorBrand(data.vendor_brand || '');
          setDescription(data.description || '');
          setReceiptDate(data.receipt_date ? new Date(data.receipt_date) : undefined);
          setInvoiceNumber(data.invoice_number || '');
          setCategory(data.category || '');
          setAmountGross(data.amount_gross?.toString() || '');
          setVatRate(data.vat_rate !== null && data.vat_rate !== undefined ? data.vat_rate.toString() : '20');
          // Handle mixed tax rate fields (may not be in types yet)
          const receiptData = data as unknown as Record<string, unknown>;
          const isMixed = (receiptData.is_mixed_tax_rate as boolean) || false;
          const taxDetails = (receiptData.tax_rate_details as TaxRateDetail[]) || null;
          setIsMixedTaxRate(isMixed);
          setTaxRateDetails(taxDetails);
          setPaymentMethod(data.payment_method || '');
          setTaxType((receiptData.tax_type as string) || '');
          setNotes(data.notes || '');
          setSelectedVendorId(data.vendor_id || null);
          
          // Detect manual overrides by comparing DB values to calculated
          const gross = data.amount_gross || 0;
          const rateVal = data.vat_rate !== null && data.vat_rate !== undefined ? data.vat_rate : 20;
          let calcNet = 0;
          let calcVat = 0;
          if (isMixed && taxDetails && taxDetails.length > 0) {
            calcNet = taxDetails.reduce((sum, d) => sum + (d.net_amount || 0), 0);
            calcVat = taxDetails.reduce((sum, d) => sum + (d.tax_amount || 0), 0);
          } else if (gross) {
            calcNet = gross / (1 + rateVal / 100);
            calcVat = gross - calcNet;
          }
          
          if (data.amount_net !== null && data.amount_net !== undefined && Math.abs((data.amount_net || 0) - calcNet) > 0.01) {
            setAmountNetOverride(data.amount_net.toString());
          } else {
            setAmountNetOverride('');
          }
          if (data.vat_amount !== null && data.vat_amount !== undefined && Math.abs((data.vat_amount || 0) - calcVat) > 0.01) {
            setVatAmountOverride(data.vat_amount.toString());
          } else {
            setVatAmountOverride('');
          }
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

  // Check if receipt belongs to a recurring expense
  useEffect(() => {
    if (!receiptId || !open) {
      setRecurringInfo(null);
      return;
    }
    const check = async () => {
      const { data } = await supabase
        .from('recurring_expense_entries')
        .select('recurring_expense_id, recurring_expenses(frequency)')
        .eq('expense_id', receiptId)
        .limit(1);
      if (data && data.length > 0) {
        const re = (data[0] as any).recurring_expenses;
        setRecurringInfo({ frequency: re?.frequency || 'monthly' });
      } else {
        setRecurringInfo(null);
      }
    };
    check();
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


  // Tags hook for auto-assignment
  const { assignTag, useReceiptTags } = useTags();
  const { data: currentReceiptTags } = useReceiptTags(receiptId);

  // Handle vendor selection from autocomplete
  const handleVendorSelect = useCallback((vendorData: {
    id: string;
    display_name: string;
    legal_names: string[] | null;
    default_category_id: string | null;
    default_tag_id?: string | null;
    default_vat_rate: number | null;
    field_defaults?: Record<string, string> | null;
    default_category: { id: string; name: string; color: string | null } | null;
  }) => {
    // Set primary legal name as the main vendor field (or display_name as fallback)
    const primaryLegalName = vendorData.legal_names?.length ? vendorData.legal_names[0] : null;
    const legalName = primaryLegalName || vendorData.display_name;
    setVendor(legalName);
    setSelectedVendorId(vendorData.id);

    const applied: string[] = ['Lieferant'];
    const defaults = vendorData.field_defaults || {};

    // Set brand name only if different from legal name
    if (primaryLegalName && vendorData.display_name !== primaryLegalName) {
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

    // Apply default tag if not already assigned
    if (vendorData.default_tag_id && receiptId) {
      const alreadyAssigned = currentReceiptTags?.some(t => t.id === vendorData.default_tag_id);
      if (!alreadyAssigned) {
        assignTag(receiptId, vendorData.default_tag_id);
        applied.push('Tag');
      }
    }

    // Apply default payment method from field_defaults if not already set
    if (defaults.payment_method && !paymentMethod) {
      setPaymentMethod(defaults.payment_method);
      applied.push('Zahlungsart');
    }

    toast({
      title: `${applied.join(', ')} vom Lieferanten übernommen`,
    });
  }, [category, vatRate, paymentMethod, toast, receiptId, currentReceiptTags, assignTag]);

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
      amount_gross: amountGross !== '' ? parseFloat(amountGross) : null,
      vat_rate: vatRate !== '' ? parseFloat(vatRate) : null,
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
  const handleSaveClick = (newStatus?: 'approved' | 'rejected' | 'review' | 'completed') => {
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
    const pendingStatus = (window as unknown as { pendingSaveStatus?: 'approved' | 'rejected' | 'review' | 'completed' }).pendingSaveStatus;
    setShowSaveDialog(false);
    
    // If user chose not to remember, we still save but skip the learning
    if (!rememberCorrections) {
      // Save without learning - we'll handle this in handleSave
      setFieldChanges({}); // Clear changes so tracking doesn't happen
    }
    
    handleSave(pendingStatus);
  };

  const handleSave = async (newStatus?: 'approved' | 'rejected' | 'review' | 'completed') => {
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
        amount_gross: amountGross !== '' ? parseFloat(amountGross) : null,
        amount_net: amountNetOverride ? parseFloat(amountNetOverride) : (calculatedValues.net ?? null),
        vat_rate: vatRate !== '' ? parseFloat(vatRate) : null,
        vat_amount: vatAmountOverride ? parseFloat(vatAmountOverride) : (calculatedValues.vat ?? null),
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
        amount_gross: amountGross !== '' ? parseFloat(amountGross) : null,
        amount_net: amountNetOverride ? parseFloat(amountNetOverride) : (calculatedValues.net ?? null),
        vat_amount: vatAmountOverride ? parseFloat(vatAmountOverride) : (calculatedValues.vat ?? null),
        vat_rate: isMixedTaxRate ? null : (vatRate !== '' && vatRate !== undefined ? parseFloat(vatRate) : null),
        is_mixed_tax_rate: isMixedTaxRate,
        tax_rate_details: isMixedTaxRate ? taxRateDetails : null,
        payment_method: paymentMethod || null,
        tax_type: taxType || null,
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

      const statusMessages: Record<string, string> = {
        approved: 'Beleg freigegeben',
        rejected: 'Beleg abgelehnt',
        review: 'Beleg zur Überprüfung',
        completed: 'Beleg abgeschlossen',
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
                    
                    {/* Source Badge */}
                    {receipt && (
                      <SourceBadge 
                        receipt={receipt} 
                        emailData={emailData}
                        compact 
                      />
                    )}
                    
                    {/* No Receipt Badge */}
                    {receipt?.is_no_receipt_entry && (
                      <NoReceiptBadge compact />
                    )}
                  </div>
                  
                  {/* Re-run AI Button - uses shared ReanalyzeOptions component */}
                  {receipt?.file_url && (
                    <ReanalyzeOptions
                      receiptId={receipt.id}
                      fileUrl={receipt.file_url}
                      fileName={receipt.file_name}
                      signedUrl={signedUrl}
                      userModifiedFields={receipt.user_modified_fields || []}
                       currentFormData={{
                        vendor,
                        vendor_brand: vendorBrand,
                        description,
                        invoice_number: invoiceNumber,
                        receipt_date: receiptDate,
                        amount_gross: amountGross,
                        vat_rate: vatRate,
                        category,
                      }}
                      vendorId={selectedVendorId || undefined}
                      vendorExpensesOnly={vendorExtractionData?.expenses_only_extraction}
                      vendorExtractionKeywords={vendorExtractionData?.extraction_keywords || []}
                      vendorExtractionHint={vendorExtractionData?.extraction_hint || ''}
                      onExpensesOnlyReanalyze={(remember, keywords, hint) => {
                        if (remember && selectedVendorId) {
                          const updates: Record<string, unknown> = { expenses_only_extraction: true };
                          if (keywords && keywords.length > 0) {
                            updates.extraction_keywords = keywords;
                          }
                          if (hint !== undefined) {
                            updates.extraction_hint = hint;
                          }
                          supabase
                            .from('vendors')
                            .update(updates)
                            .eq('id', selectedVendorId)
                            .then(() => {
                              // Refresh local vendor data
                              setVendorExtractionData(prev => ({
                                expenses_only_extraction: true,
                                extraction_keywords: (keywords && keywords.length > 0) ? keywords : (prev?.extraction_keywords || []),
                                extraction_hint: hint !== undefined ? hint : (prev?.extraction_hint || ''),
                              }));
                            });
                        }
                      }}
                      onReanalyzeComplete={() => {
                        // onFieldsUpdated has already set all AI-extracted fields in-memory.
                        // A DB reload here would overwrite those values with stale data (not yet saved).
                        onUpdate();
                      }}
                      onFieldsUpdated={(updates) => {
                        const changes: Record<string, { old: string; new: string }> = {};
                        
                        if (updates.vendor !== undefined) {
                          if (vendor !== updates.vendor) {
                            changes['Lieferant'] = { old: vendor || '-', new: updates.vendor };
                          }
                          setVendor(updates.vendor);
                        }
                        if (updates.vendor_brand !== undefined) {
                          if (vendorBrand !== updates.vendor_brand) {
                            changes['Markenname'] = { old: vendorBrand || '-', new: updates.vendor_brand };
                          }
                          setVendorBrand(updates.vendor_brand);
                        }
                        if (updates.description !== undefined) {
                          if (description !== updates.description) {
                            changes['Beschreibung'] = { old: description || '-', new: updates.description };
                          }
                          setDescription(updates.description);
                        }
                        if (updates.invoice_number !== undefined) {
                          if (invoiceNumber !== updates.invoice_number) {
                            changes['Rechnungsnr.'] = { old: invoiceNumber || '-', new: updates.invoice_number };
                          }
                          setInvoiceNumber(updates.invoice_number);
                        }
                        if (updates.receipt_date !== undefined) {
                          const oldDateStr = receiptDate ? format(receiptDate, 'dd.MM.yyyy') : '-';
                          const newDateStr = format(updates.receipt_date, 'dd.MM.yyyy');
                          if (oldDateStr !== newDateStr) {
                            changes['Datum'] = { old: oldDateStr, new: newDateStr };
                          }
                          setReceiptDate(updates.receipt_date);
                        }
                        if (updates.amount_gross !== undefined) {
                          if (amountGross !== updates.amount_gross) {
                            changes['Bruttobetrag'] = { old: amountGross || '-', new: updates.amount_gross };
                          }
                          setAmountGross(updates.amount_gross);
                          // KI hat Bruttobetrag geändert → manuelle Net/VAT-Overrides zurücksetzen
                          setAmountNetOverride('');
                          setVatAmountOverride('');
                        }
                        if (updates.vat_rate !== undefined) {
                          if (vatRate !== updates.vat_rate) {
                            changes['MwSt-Satz'] = { old: vatRate || '-', new: updates.vat_rate + '%' };
                          }
                          setVatRate(updates.vat_rate);
                          // KI hat MwSt-Satz geändert → manuelle Net/VAT-Overrides zurücksetzen
                          setAmountNetOverride('');
                          setVatAmountOverride('');
                        }
                        if (updates.category !== undefined) {
                          if (category !== updates.category) {
                            changes['Kategorie'] = { old: category || '-', new: updates.category };
                          }
                          setCategory(updates.category);
                        }
                        if (updates.confidence !== undefined) {
                          setCurrentAiConfidence(updates.confidence);
                        }
                        
                        if (Object.keys(changes).length > 0) {
                          setChangedFields(changes);
                          setHasUnsavedAiChanges(true);
                        }
                      }}
                      disabled={fileLoading}
                    />
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

                    {/* Recurring expense badge */}
                    {recurringInfo && (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1.5">
                        <Repeat className="h-3 w-3" />
                        Wiederkehrend · {
                          { monthly: 'Monatlich', quarterly: 'Quartalsweise', semi_annual: 'Halbjährlich', annual: 'Jährlich' }[recurringInfo.frequency] || recurringInfo.frequency
                        }
                      </Badge>
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

                    {/* Non-Receipt Document Hint */}
                    {receipt?.category === 'Keine Rechnung' && (
                      <Alert className="bg-muted/50 border-muted-foreground/20">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <AlertDescription>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">
                              Erkannt als: {receipt.notes?.replace('Dokumenttyp: ', '').split('.')[0] || 'Sonstiges Dokument'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Dieses Dokument wurde nicht als Rechnung erkannt. Sie können die Kategorie ändern falls es doch ein Beleg ist.
                            </p>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Vendor Brand/Marke */}
                    {selectedVendorId ? (
                      <div>
                        <Label htmlFor="vendorBrand" className="flex items-center gap-2">
                          Lieferant (Markenname)
                          <span className="text-xs font-normal text-muted-foreground">(aus Lieferantenstamm)</span>
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="vendorBrand"
                            value={vendorBrand || vendor}
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
                              window.open(`/settings?tab=vendors&vendorId=${selectedVendorId}`, '_blank');
                            }}
                          >
                            <Settings className="w-3 h-3 mr-1" />
                            Bearbeiten
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <LearnableField
                        fieldName="vendor_brand"
                        label="Lieferant (Markenname)"
                        value={vendorBrand}
                        originalValue={originalReceipt?.vendor_brand}
                        onReset={() => setVendorBrand(originalReceipt?.vendor_brand || '')}
                      >
                        <Input
                          id="vendorBrand"
                          value={vendorBrand}
                          onChange={(e) => setVendorBrand(e.target.value)}
                          placeholder="z.B. timr, Amazon, A1"
                        />
                      </LearnableField>
                    )}

                    {/* Vendor Legal Name */}
                    <LearnableField
                      fieldName="vendor"
                      label="Rechtlicher Firmenname"
                      value={vendor}
                      originalValue={originalReceipt?.vendor}
                      onReset={() => {
                        setVendor(originalReceipt?.vendor || '');
                        setSelectedVendorId(null);
                      }}
                    >
                      <VendorAutocomplete
                        value={vendor}
                        vendorId={selectedVendorId}
                        onChange={(value, id) => {
                          setVendor(value);
                          setSelectedVendorId(id || null);
                        }}
                        onVendorSelect={handleVendorSelect}
                        disabled={saving}
                        hideLabel
                        placeholder="z.B. troii Software GmbH"
                      />
                    </LearnableField>

                    {/* Description with character counter */}
                    <LearnableField
                      fieldName="description"
                      label="Beschreibung"
                      value={description}
                      originalValue={originalReceipt?.description}
                      onReset={() => setDescription(originalReceipt?.description || '')}
                      labelExtra={
                        <span className={cn(
                          "text-xs",
                          description.length > descriptionSettings.max_length 
                            ? "text-orange-500" 
                            : "text-muted-foreground"
                        )}>
                          {description.length} / {descriptionSettings.max_length} Zeichen
                        </span>
                      }
                    >
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
                    </LearnableField>

                    {/* Date */}
                    <LearnableField
                      fieldName="receipt_date"
                      label="Belegdatum"
                      value={receiptDate ? format(receiptDate, 'yyyy-MM-dd') : null}
                      originalValue={originalReceipt?.receipt_date ? originalReceipt.receipt_date.substring(0, 10) : null}
                      onReset={() => setReceiptDate(originalReceipt?.receipt_date ? new Date(originalReceipt.receipt_date) : undefined)}
                    >
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
                    </LearnableField>

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
                    <LearnableField
                      fieldName="category"
                      label="Kategorie"
                      value={category}
                      originalValue={originalReceipt?.category}
                      onReset={() => setCategory(originalReceipt?.category || '')}
                    >
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger>
                          <SelectValue placeholder="Nicht zugeordnet" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.name}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </LearnableField>

                    {/* Buchungsart (tax_type) */}
                    <div className="space-y-2">
                      <Label>Buchungsart</Label>
                      <Select value={taxType} onValueChange={setTaxType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Offen" />
                        </SelectTrigger>
                        <SelectContent>
                          {TAX_TYPES.map(t => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Split Booking Editor */}
                    {splitBookingEnabled && receiptId && (
                      <SplitBookingEditor
                        receiptId={receiptId}
                        totalGross={amountGross !== '' ? parseFloat(amountGross) : 0}
                        mainCategory={category}
                        mainVatRate={vatRate !== '' ? parseFloat(vatRate) : 20}
                        onSplitChange={() => onUpdate()}
                        vendorId={selectedVendorId}
                      />
                    )}

                    {/* Amount & VAT */}
                    <div className="grid grid-cols-2 gap-4">
                      <LearnableField
                        fieldName="amount_gross"
                        label="Bruttobetrag"
                        value={amountGross !== '' ? parseFloat(amountGross) : null}
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
                        value={isMixedTaxRate ? null : (vatRate !== '' ? parseFloat(vatRate) : null)}
                        originalValue={originalReceipt?.vat_rate}
                        vendorLearning={vendorLearning}
                        onReset={() => {
                          setVatRate(originalReceipt?.vat_rate?.toString() || '20');
                          setIsMixedTaxRate(false);
                        }}
                        vatRateSource={(receipt as unknown as Record<string, unknown>)?.vat_rate_source as 'ai' | 'learned' | 'manual' | null}
                      >
                        <div className="flex items-center gap-2">
                          <Select 
                            value={isMixedTaxRate ? 'mixed' : vatRate} 
                            onValueChange={(value) => {
                              if (value === 'mixed') {
                                setIsMixedTaxRate(true);
                                setVatRate('0');
                              } else {
                                setIsMixedTaxRate(false);
                                setVatRate(value);
                                setTaxRateDetails(null);
                              }
                            }}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {vatRateGroups.map(group => (
                                <SelectGroup key={group.label}>
                                  <SelectLabel>{group.label}</SelectLabel>
                                  {group.rates.map(rate => (
                                    <SelectItem key={rate.value} value={rate.value}>
                                      {rate.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              ))}
                            </SelectContent>
                          </Select>
                          {/* Low VAT confidence warning */}
                          {(receipt as unknown as Record<string, unknown>)?.vat_confidence !== null && 
                           (receipt as unknown as Record<string, unknown>)?.vat_confidence !== undefined && 
                           ((receipt as unknown as Record<string, unknown>)?.vat_confidence as number) < 0.7 && (
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent>
                                MwSt-Satz unsicher erkannt ({Math.round((((receipt as unknown as Record<string, unknown>)?.vat_confidence as number) || 0) * 100)}% Konfidenz). Bitte überprüfen.
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </LearnableField>
                    </div>

                    {/* Special VAT Case Badge */}
                    {(receipt as unknown as Record<string, unknown>)?.special_vat_case && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-300">
                          {(receipt as unknown as Record<string, unknown>)?.special_vat_case === 'kleinunternehmer' && 'Kleinunternehmer-Rechnung (0% MwSt)'}
                          {(receipt as unknown as Record<string, unknown>)?.special_vat_case === 'reverse_charge' && 'Reverse-Charge (Steuerschuldnerschaft)'}
                          {(receipt as unknown as Record<string, unknown>)?.special_vat_case === 'ig_lieferung' && 'Innergemeinschaftliche Lieferung'}
                          {(receipt as unknown as Record<string, unknown>)?.special_vat_case === 'export' && 'Steuerfreie Ausfuhr'}
                        </Badge>
                        {(receipt as unknown as Record<string, unknown>)?.vendor_country && (
                          <span className="text-xs text-muted-foreground">
                            Land: {(receipt as unknown as Record<string, unknown>)?.vendor_country as string}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Mixed Tax Rate Details */}
                    {isMixedTaxRate && taxRateDetails && taxRateDetails.length > 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <span className="text-sm font-medium text-amber-800">Mehrere Steuersätze erkannt</span>
                        </div>
                        <div className="space-y-1">
                          {taxRateDetails.map((detail, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-amber-700">
                                {detail.rate}% {detail.description && `(${detail.description})`}
                              </span>
                              <span className="text-amber-800">
                                Netto: €{detail.net_amount?.toFixed(2)} / MwSt: €{detail.tax_amount?.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Net & VAT Amount (editable with calculated placeholder) */}
                    <div className="grid grid-cols-2 gap-4 items-end">
                      <LearnableField
                        fieldName="amount_net"
                        label="Nettobetrag"
                        value={amountNetOverride ? parseFloat(amountNetOverride) : null}
                        originalValue={originalReceipt?.amount_net}
                      >
                        <Input
                          type="number"
                          step="0.01"
                          value={amountNetOverride}
                          onChange={(e) => setAmountNetOverride(e.target.value)}
                          placeholder={calculatedValues.net ? `${calculatedValues.net.toFixed(2)} (berechnet)` : '—'}
                          className={amountNetOverride ? '' : 'bg-muted text-muted-foreground'}
                        />
                      </LearnableField>
                      <LearnableField
                        fieldName="vat_amount"
                        label="MwSt-Betrag"
                        labelExtra={isMixedTaxRate ? <span className="text-xs text-muted-foreground">(gemischt)</span> : undefined}
                        value={vatAmountOverride ? parseFloat(vatAmountOverride) : null}
                        originalValue={originalReceipt?.vat_amount}
                      >
                        <Input
                          type="number"
                          step="0.01"
                          value={vatAmountOverride}
                          onChange={(e) => setVatAmountOverride(e.target.value)}
                          placeholder={calculatedValues.vat ? `${calculatedValues.vat.toFixed(2)} (berechnet)` : '—'}
                          className={vatAmountOverride ? '' : 'bg-muted text-muted-foreground'}
                        />
                      </LearnableField>
                    </div>

                    {/* Payment Method */}
                    <LearnableField
                      fieldName="payment_method"
                      label="Zahlungsart"
                      value={paymentMethod}
                      originalValue={originalReceipt?.payment_method}
                      onReset={() => setPaymentMethod(originalReceipt?.payment_method || '')}
                    >
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
                    </LearnableField>

                    {/* Notes */}
                    <LearnableField
                      fieldName="notes"
                      label="Notizen"
                      value={notes}
                      originalValue={originalReceipt?.notes}
                      onReset={() => setNotes(originalReceipt?.notes || '')}
                    >
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Optionale Anmerkungen..."
                        rows={2}
                      />
                    </LearnableField>

                    {/* Tags */}
                    <div className="pt-2 border-t">
                      <div className="flex items-center gap-2 mb-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <Label>Tags</Label>
                      </div>
                      {receipt && (
                        <TagSelector
                          receiptId={receipt.id}
                          size="md"
                        />
                      )}
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Tags werden sofort gespeichert
                      </p>
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
                    <Trash2 className="h-4 w-4 mr-2" />
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
                    {receipt.status === 'approved' && (
                      <Button
                        variant="outline"
                        className="border-slate-500 text-slate-600 hover:bg-slate-50 hover:text-slate-700"
                        onClick={() => handleSaveClick('completed')}
                        disabled={saving}
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Abschließen
                      </Button>
                    )}
                    {(receipt.status as string) === 'completed' && (
                      <Button
                        variant="outline"
                        className="border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
                        onClick={() => handleSaveClick('approved')}
                        disabled={saving}
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Zurück zu Genehmigt
                      </Button>
                    )}
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
