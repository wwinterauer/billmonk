import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Upload,
  ZoomIn,
  FileText,
  Sparkles,
  Save,
  SkipForward,
  Loader2,
  AlertTriangle,
  Download,
  RefreshCw,
  Tag,
  ExternalLink,
  Trash2,
} from 'lucide-react';
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
import { PdfViewer } from '@/components/receipts/PdfViewer';
import { MultiInvoiceAlert } from '@/components/receipts/MultiInvoiceAlert';
import { ReanalyzeOptions } from '@/components/receipts/ReanalyzeOptions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import { useReceipts, type Receipt } from '@/hooks/useReceipts';
import { useCategories } from '@/hooks/useCategories';
import { useCorrectionTracking } from '@/hooks/useCorrectionTracking';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { TagSelector } from '@/components/tags/TagSelector';
import { SplitBookingEditor } from '@/components/receipts/SplitBookingEditor';
import { usePlan } from '@/hooks/usePlan';
import { useVatRates } from '@/hooks/useVatRates';

const PAYMENT_METHODS = [
  { value: 'Überweisung', label: 'Überweisung' },
  { value: 'Kreditkarte', label: 'Kreditkarte' },
  { value: 'Debitkarte', label: 'Karte Debitzahlung' },
  { value: 'Bar', label: 'Barzahlung' },
  { value: 'PayPal', label: 'PayPal' },
  { value: 'Apple Pay', label: 'Apple Pay' },
  { value: 'Google Pay', label: 'Google Pay' },
  { value: 'Lastschrift', label: 'Lastschrift' },
  { value: 'Sonstige', label: 'Sonstige' },
];

interface TaxRateDetail {
  rate: number;
  net_amount: number;
  tax_amount: number;
  description?: string;
}

interface FormData {
  vendor: string;
  vendor_brand: string;
  invoice_number: string;
  description: string;
  receipt_date: Date | null;
  category: string;
  amount_gross: string;
  vat_rate: string;
  is_mixed_tax_rate: boolean;
  tax_rate_details: TaxRateDetail[] | null;
  payment_method: string;
  amount_net_override: string;
  vat_amount_override: string;
}

const Review = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getReceipts, updateReceipt, getReceiptFileUrl, deleteReceipt } = useReceipts();
  const { categories } = useCategories();
  const { trackCorrections, trackSuccessfulPrediction } = useCorrectionTracking();
  const { splitBookingEnabled } = usePlan();
  const { vatRateGroups } = useVatRates();
  const queryClient = useQueryClient();

  // State
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    vendor: '',
    vendor_brand: '',
    invoice_number: '',
    description: '',
    receipt_date: null,
    category: '',
    amount_gross: '',
    vat_rate: '20',
    is_mixed_tax_rate: false,
    tax_rate_details: null,
    payment_method: '',
    amount_net_override: '',
    vat_amount_override: '',
  });

  // Load receipts with status='review' or 'needs_splitting'
  const loadReceipts = useCallback(async () => {
    setLoading(true);
    try {
      // Get both review and needs_splitting receipts
      const reviewData = await getReceipts({ status: 'review' });
      const splittingData = await getReceipts({ status: 'needs_splitting' as any });
      
      // Combine and sort by created_at (splitting first, then review)
      const allData = [...splittingData, ...reviewData];
      
      setReceipts(allData);
      if (allData.length > 0) {
        populateForm(allData[0]);
        loadImage(allData[0]);
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
  }, [getReceipts, toast]);

  useEffect(() => {
    loadReceipts();
  }, []);

  const currentReceipt = receipts[currentIndex] || null;

  // Vendor extraction data for ReanalyzeOptions
  const [currentVendorData, setCurrentVendorData] = useState<{
    expenses_only_extraction: boolean;
    extraction_keywords: string[];
    extraction_hint: string;
  } | null>(null);

  useEffect(() => {
    const vendorId = currentReceipt?.vendor_id;
    if (!vendorId) {
      setCurrentVendorData(null);
      return;
    }
    supabase
      .from('vendors')
      .select('expenses_only_extraction, extraction_keywords, extraction_hint')
      .eq('id', vendorId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCurrentVendorData({
            expenses_only_extraction: data.expenses_only_extraction,
            extraction_keywords: data.extraction_keywords || [],
            extraction_hint: data.extraction_hint || '',
          });
        } else {
          setCurrentVendorData(null);
        }
      });
  }, [currentReceipt?.vendor_id]);

  // Load image for current receipt
  const loadImage = async (receipt: Receipt) => {
    setImageLoading(true);
    setImageError(null);
    setImageUrl(null);
    setSignedUrl(null);
    setAiConfidence(receipt.ai_confidence ?? null);
    
    if (receipt.file_url) {
      try {
        const url = await getReceiptFileUrl(receipt.file_url);
        setImageUrl(url);
        setSignedUrl(url); // Store for reanalysis
      } catch (error) {
        console.error('Failed to load image:', error);
        setImageError(error instanceof Error ? error.message : 'Fehler beim Laden der Vorschau');
        setImageUrl(null);
      }
    } else {
      setImageError('Keine Datei vorhanden');
    }
    
    setImageLoading(false);
  };

  // Populate form with receipt data
  const populateForm = (receipt: Receipt) => {
    const receiptData = receipt as unknown as Record<string, unknown>;
    
    // Calculate expected net/vat to detect manual overrides from DB
    const gross = receipt.amount_gross || 0;
    const vatRateVal = receipt.vat_rate !== null && receipt.vat_rate !== undefined ? receipt.vat_rate : 20;
    const isMixed = (receiptData.is_mixed_tax_rate as boolean) || false;
    const taxDetails = (receiptData.tax_rate_details as TaxRateDetail[]) || null;
    
    let calculatedNet = 0;
    let calculatedVat = 0;
    if (isMixed && taxDetails && taxDetails.length > 0) {
      calculatedNet = taxDetails.reduce((sum, d) => sum + (d.net_amount || 0), 0);
      calculatedVat = taxDetails.reduce((sum, d) => sum + (d.tax_amount || 0), 0);
    } else if (gross) {
      calculatedNet = gross / (1 + vatRateVal / 100);
      calculatedVat = gross - calculatedNet;
    }
    
    // If DB values differ from calculated, treat as override
    let amountNetOverride = '';
    let vatAmountOverride = '';
    if (receipt.amount_net !== null && receipt.amount_net !== undefined) {
      const diff = Math.abs((receipt.amount_net || 0) - calculatedNet);
      if (diff > 0.01) {
        amountNetOverride = receipt.amount_net.toString();
      }
    }
    if (receipt.vat_amount !== null && receipt.vat_amount !== undefined) {
      const diff = Math.abs((receipt.vat_amount || 0) - calculatedVat);
      if (diff > 0.01) {
        vatAmountOverride = receipt.vat_amount.toString();
      }
    }
    
    setFormData({
      vendor: receipt.vendor || '',
      vendor_brand: receipt.vendor_brand || '',
      invoice_number: receipt.invoice_number || '',
      description: receipt.description || '',
      receipt_date: receipt.receipt_date ? new Date(receipt.receipt_date) : null,
      category: receipt.category || '',
      amount_gross: receipt.amount_gross?.toString() || '',
      // IMPORTANT: 0% VAT is valid, so we need to check for null/undefined specifically
      vat_rate: receipt.vat_rate !== null && receipt.vat_rate !== undefined ? receipt.vat_rate.toString() : '20',
      is_mixed_tax_rate: isMixed,
      tax_rate_details: taxDetails,
      payment_method: receipt.payment_method || '',
      amount_net_override: amountNetOverride,
      vat_amount_override: vatAmountOverride,
    });
    setAiConfidence(receipt.ai_confidence ?? null);
  };

  // Handle reanalysis updates
  const handleReanalysisUpdate = useCallback((updates: {
    vendor?: string;
    vendor_brand?: string;
    description?: string;
    invoice_number?: string;
    receipt_date?: Date;
    amount_gross?: string;
    vat_rate?: string;
    category?: string;
    confidence?: number;
  }) => {
    setFormData(prev => ({
      ...prev,
      vendor: updates.vendor ?? prev.vendor,
      vendor_brand: updates.vendor_brand ?? prev.vendor_brand,
      description: updates.description ?? prev.description,
      invoice_number: updates.invoice_number ?? prev.invoice_number,
      receipt_date: updates.receipt_date ?? prev.receipt_date,
      amount_gross: updates.amount_gross ?? prev.amount_gross,
      vat_rate: updates.vat_rate ?? prev.vat_rate,
      category: updates.category ?? prev.category,
    }));
    if (updates.confidence !== undefined) {
      setAiConfidence(updates.confidence);
    }
  }, []);

  // Navigate to receipt
  const goToReceipt = useCallback((index: number) => {
    if (index >= 0 && index < receipts.length) {
      setCurrentIndex(index);
      populateForm(receipts[index]);
      loadImage(receipts[index]);
    }
  }, [receipts]);

  // Calculate net amount and VAT
  const calculations = useMemo(() => {
    const gross = parseFloat(formData.amount_gross) || 0;
    
    // Bei gemischten Steuersätzen: Netto aus den Details
    if (formData.is_mixed_tax_rate && formData.tax_rate_details && formData.tax_rate_details.length > 0) {
      const totalNet = formData.tax_rate_details.reduce((sum, d) => sum + (d.net_amount || 0), 0);
      const totalVat = formData.tax_rate_details.reduce((sum, d) => sum + (d.tax_amount || 0), 0);
      return { net: totalNet, vat: totalVat };
    }
    
    const vatRate = parseFloat(formData.vat_rate) || 0;
    const net = gross / (1 + vatRate / 100);
    const vat = gross - net;
    return { net, vat };
  }, [formData.amount_gross, formData.vat_rate, formData.is_mixed_tax_rate, formData.tax_rate_details]);

  // Get confidence indicator color
  const getConfidenceColor = (confidence: number | null | undefined): string => {
    if (confidence === null || confidence === undefined) return 'bg-muted-foreground';
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.5) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Get field confidence (simplified - in a real app, you'd have per-field confidence)
  const getFieldConfidence = (fieldValue: string | null | undefined, aiConfidence: number | null | undefined): number | null => {
    if (!fieldValue) return null;
    return aiConfidence;
  };

  // Save receipt
  const saveReceipt = async (newStatus?: string) => {
    if (!currentReceipt) return;
    
    setSaving(true);
    try {
      const gross = formData.amount_gross !== '' ? parseFloat(formData.amount_gross) : null;
      const vatRate = formData.is_mixed_tax_rate ? null : (formData.vat_rate !== '' && formData.vat_rate !== undefined ? parseFloat(formData.vat_rate) : null);
      let net = null;
      let vatAmount = null;
      
      // Use manual overrides if provided, otherwise calculate
      if (formData.amount_net_override) {
        net = parseFloat(formData.amount_net_override);
      } else if (formData.is_mixed_tax_rate && formData.tax_rate_details) {
        net = formData.tax_rate_details.reduce((sum, d) => sum + (d.net_amount || 0), 0);
      } else if (gross && vatRate !== null) {
        net = gross / (1 + vatRate / 100);
      }
      
      if (formData.vat_amount_override) {
        vatAmount = parseFloat(formData.vat_amount_override);
      } else if (formData.is_mixed_tax_rate && formData.tax_rate_details) {
        vatAmount = formData.tax_rate_details.reduce((sum, d) => sum + (d.tax_amount || 0), 0);
      } else if (gross && vatRate !== null) {
        vatAmount = gross - (net ?? (gross / (1 + vatRate / 100)));
      }

      const updateData: Record<string, unknown> = {
        vendor: formData.vendor || null,
        vendor_brand: formData.vendor_brand || null,
        invoice_number: formData.invoice_number || null,
        description: formData.description || null,
        receipt_date: formData.receipt_date ? format(formData.receipt_date, 'yyyy-MM-dd') : null,
        category: formData.category || null,
        amount_gross: gross,
        amount_net: net,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        is_mixed_tax_rate: formData.is_mixed_tax_rate,
        tax_rate_details: formData.is_mixed_tax_rate ? formData.tax_rate_details : null,
        payment_method: formData.payment_method || null,
      };

      if (newStatus) {
        updateData.status = newStatus as Receipt['status'];
      }

      await updateReceipt(currentReceipt.id, updateData as Partial<Receipt>);

      // Track corrections for AI learning
      // Use existing vendor_id, or look up vendor by name if not linked
      let trackingVendorId = currentReceipt.vendor_id;
      if (!trackingVendorId && formData.vendor) {
        const { data: matchedVendor } = await supabase
          .from('vendors')
          .select('id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
          .or(`display_name.ilike.%${formData.vendor}%,legal_name.ilike.%${formData.vendor}%`)
          .limit(1)
          .maybeSingle();
        if (matchedVendor) {
          trackingVendorId = matchedVendor.id;
        }
      }

      if (trackingVendorId) {
        const fieldsToTrack = [
          { fieldName: 'vat_rate', detected: currentReceipt.vat_rate, corrected: formData.is_mixed_tax_rate ? null : (formData.vat_rate !== '' ? parseFloat(formData.vat_rate) : null) },
          { fieldName: 'amount_gross', detected: currentReceipt.amount_gross, corrected: gross },
          { fieldName: 'vendor', detected: currentReceipt.vendor, corrected: formData.vendor || null },
          { fieldName: 'vendor_brand', detected: currentReceipt.vendor_brand, corrected: formData.vendor_brand || null },
          { fieldName: 'invoice_number', detected: currentReceipt.invoice_number, corrected: formData.invoice_number || null },
          { fieldName: 'category', detected: currentReceipt.category, corrected: formData.category || null },
        ];

        const corrections = fieldsToTrack
          .filter(f => String(f.detected ?? '') !== String(f.corrected ?? ''))
          .map(f => ({
            fieldName: f.fieldName,
            detectedValue: f.detected,
            correctedValue: f.corrected,
            receiptId: currentReceipt.id,
            vendorId: trackingVendorId!,
          }));

        if (corrections.length > 0) {
          trackCorrections(corrections);
        } else {
          trackSuccessfulPrediction(currentReceipt.id, trackingVendorId);
        }
      }

      if (newStatus) {
        // Remove from list and go to next
        const newReceipts = receipts.filter((_, i) => i !== currentIndex);
        setReceipts(newReceipts);
        
        if (newReceipts.length > 0) {
          const nextIndex = Math.min(currentIndex, newReceipts.length - 1);
          setCurrentIndex(nextIndex);
          populateForm(newReceipts[nextIndex]);
          loadImage(newReceipts[nextIndex]);
        }

        // Invalidate receipts query and trigger sidebar refresh
        queryClient.invalidateQueries({ queryKey: ['receipts'] });
        window.dispatchEvent(new CustomEvent('refresh-review-count'));

        toast({
          title: newStatus === 'approved' ? 'Beleg freigegeben' : 'Beleg abgelehnt',
        });
      } else {
        toast({ title: 'Änderungen gespeichert' });
      }
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

  // Skip to next receipt
  const skipReceipt = () => {
    if (currentIndex < receipts.length - 1) {
      goToReceipt(currentIndex + 1);
    } else if (currentIndex > 0) {
      goToReceipt(currentIndex - 1);
    }
  };

  // Delete current receipt
  const handleDelete = async () => {
    if (!currentReceipt) return;
    setSaving(true);
    try {
      await deleteReceipt(currentReceipt.id);
      const newReceipts = receipts.filter((_, i) => i !== currentIndex);
      setReceipts(newReceipts);
      if (newReceipts.length > 0) {
        const nextIndex = Math.min(currentIndex, newReceipts.length - 1);
        setCurrentIndex(nextIndex);
        populateForm(newReceipts[nextIndex]);
        loadImage(newReceipts[nextIndex]);
      }
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      window.dispatchEvent(new CustomEvent('refresh-review-count'));
      toast({ title: 'Beleg gelöscht' });
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

  // Approve all with high confidence
  const canApproveAll = useMemo(() => {
    return receipts.every(r => 
      r.ai_confidence !== null && 
      r.ai_confidence >= 0.8 &&
      r.vendor &&
      r.amount_gross
    );
  }, [receipts]);

  const handleApproveAll = async () => {
    if (!canApproveAll) return;
    
    setSaving(true);
    try {
      for (const receipt of receipts) {
        await updateReceipt(receipt.id, { status: 'approved' });
      }
      setReceipts([]);
      // Invalidate receipts query and trigger sidebar refresh
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      window.dispatchEvent(new CustomEvent('refresh-review-count'));
      toast({ title: `${receipts.length} Belege freigegeben` });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    } finally {
      setSaving(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (e.key === 'ArrowLeft') {
        goToReceipt(currentIndex - 1);
      } else if (e.key === 'ArrowRight') {
        goToReceipt(currentIndex + 1);
      } else if (e.key === 'Escape') {
        skipReceipt();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, goToReceipt]);

  // Reviewed count for progress
  const totalToReview = receipts.length;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8 max-w-6xl mx-auto">
          <div className="mb-8">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-5 w-96" />
          </div>
          <Skeleton className="h-[600px] w-full" />
        </div>
      </DashboardLayout>
    );
  }

  // Empty state
  if (receipts.length === 0) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8">
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="h-20 w-20 rounded-full bg-success/20 flex items-center justify-center mb-6"
            >
              <CheckCircle className="h-10 w-10 text-success" />
            </motion.div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Alle Belege überprüft! 🎉
            </h2>
            <p className="text-muted-foreground mb-6">
              Keine offenen Überprüfungen vorhanden
            </p>
            <div className="flex gap-3">
              <Button 
                className="gradient-primary hover:opacity-90"
                onClick={() => navigate('/upload')}
              >
                <Upload className="h-4 w-4 mr-2" />
                Neue Belege hochladen
              </Button>
              <Button 
                variant="outline"
                onClick={() => navigate('/expenses')}
              >
                Zur Übersicht
              </Button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Belege überprüfen</h1>
            <p className="text-muted-foreground">
              Prüfe und bestätige die automatisch erkannten Daten
            </p>
          </div>
          <Badge variant="secondary" className="text-sm w-fit">
            {totalToReview} zur Überprüfung
          </Badge>
        </div>

        {/* Progress Bar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Beleg {currentIndex + 1} von {totalToReview}
            </span>
            {canApproveAll && receipts.length > 1 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleApproveAll}
                disabled={saving}
              >
                Alle bestätigen
              </Button>
            )}
          </div>
          <Progress 
            value={((currentIndex + 1) / totalToReview) * 100} 
            className="h-2"
          />
        </motion.div>

        {/* Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToReceipt(currentIndex - 1)}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Vorheriger
          </Button>
          <span className="text-sm font-medium text-muted-foreground">
            Beleg {currentIndex + 1} von {totalToReview}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToReceipt(currentIndex + 1)}
            disabled={currentIndex === totalToReview - 1}
          >
            Nächster
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Main Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentReceipt?.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <Card>
              {/* Confidence Header with Reanalyze */}
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-lg">
                        KI-Erkennung: {Math.round((aiConfidence ?? currentReceipt?.ai_confidence ?? 0) * 100)}%
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Basierend auf Lovable AI Analyse
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress 
                      value={(aiConfidence ?? currentReceipt?.ai_confidence ?? 0) * 100} 
                      className="w-24 h-2"
                    />
                    {currentReceipt && (
                      <ReanalyzeOptions
                        receiptId={currentReceipt.id}
                        fileUrl={currentReceipt.file_url}
                        fileName={currentReceipt.file_name}
                        signedUrl={signedUrl}
                        userModifiedFields={currentReceipt.user_modified_fields || []}
                         currentFormData={{
                          vendor: formData.vendor,
                          vendor_brand: formData.vendor_brand,
                          description: formData.description,
                          invoice_number: formData.invoice_number,
                          receipt_date: formData.receipt_date,
                          amount_gross: formData.amount_gross,
                          vat_rate: formData.vat_rate,
                          category: formData.category,
                        }}
                        onFieldsUpdated={handleReanalysisUpdate}
                        disabled={imageLoading}
                        vendorId={currentReceipt.vendor_id || undefined}
                        vendorExpensesOnly={currentVendorData?.expenses_only_extraction}
                        vendorExtractionKeywords={currentVendorData?.extraction_keywords || []}
                        vendorExtractionHint={currentVendorData?.extraction_hint || ''}
                        onExpensesOnlyReanalyze={(remember, keywords, hint) => {
                          if (remember && currentReceipt.vendor_id) {
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
                              .eq('id', currentReceipt.vendor_id)
                              .then(({ data }) => {
                                // Refresh local vendor data
                                if (data) {
                                  setCurrentVendorData({
                                    expenses_only_extraction: true,
                                    extraction_keywords: (keywords && keywords.length > 0) ? keywords : (currentVendorData?.extraction_keywords || []),
                                    extraction_hint: hint !== undefined ? hint : (currentVendorData?.extraction_hint || ''),
                                  });
                                }
                              });
                          }
                        }}
                        onReanalyzeComplete={() => {
                          // handleReanalysisUpdate (onFieldsUpdated) has already set all fields in-memory.
                          // Reloading from DB here would overwrite AI values with stale data.
                          queryClient.invalidateQueries({ queryKey: ['receipts'] });
                        }}
                      />
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {/* Multi-Invoice Alert for PDFs with multiple invoices */}
                {currentReceipt?.status === 'needs_splitting' && (
                  <div className="mb-6">
                    <MultiInvoiceAlert
                      receiptId={currentReceipt.id}
                      splitSuggestion={currentReceipt.split_suggestion as any}
                      pageCount={currentReceipt.page_count || 1}
                      onSplitComplete={() => {
                        queryClient.invalidateQueries({ queryKey: ['receipts'] });
                      }}
                    />
                  </div>
                )}

                {/* Hint for non-receipt documents */}
                {currentReceipt?.category === 'Keine Rechnung' && (
                  <div className="mb-6 p-4 bg-muted/50 border border-muted-foreground/20 rounded-lg flex items-start gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">
                        Erkannt als: {currentReceipt.notes?.replace('Dokumenttyp: ', '').split('.')[0] || 'Sonstiges Dokument'}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Dieses Dokument wurde nicht als Rechnung erkannt. Sie können die Kategorie ändern falls es doch ein Beleg ist.
                      </p>
                    </div>
                  </div>
                )}
                <div className="grid lg:grid-cols-2 gap-8 items-stretch">
                  {/* Left Side - Image Preview */}
                  <div className="lg:col-span-1">
                    <div className="sticky top-6 h-full flex flex-col">
                      <div 
                        className={cn(
                          "relative bg-muted rounded-lg overflow-hidden",
                          currentReceipt?.file_type?.toLowerCase() === 'pdf' || 
                          currentReceipt?.file_name?.toLowerCase().endsWith('.pdf')
                            ? "flex-1 min-h-[400px]"
                            : "aspect-[3/4] cursor-pointer group"
                        )}
                        onClick={() => {
                          // Only open lightbox for images, not PDFs (they have their own controls)
                          if (imageUrl && 
                              !(currentReceipt?.file_type?.toLowerCase() === 'pdf' || 
                                currentReceipt?.file_name?.toLowerCase().endsWith('.pdf'))) {
                            setLightboxOpen(true);
                          }
                        }}
                      >
                        {imageLoading ? (
                          <div className="flex flex-col items-center justify-center h-full">
                            <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
                            <p className="text-sm text-muted-foreground">Vorschau wird geladen...</p>
                          </div>
                        ) : imageError ? (
                          <div className="flex flex-col items-center justify-center h-full p-4">
                            <AlertTriangle className="h-12 w-12 text-warning mb-3" />
                            <p className="text-sm text-muted-foreground text-center mb-4">{imageError}</p>
                            {currentReceipt?.file_url && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (currentReceipt) {
                                    loadImage(currentReceipt);
                                  }
                                }}
                              >
                                <Loader2 className={cn("h-4 w-4 mr-2", imageLoading && "animate-spin")} />
                                Erneut versuchen
                              </Button>
                            )}
                          </div>
                        ) : imageUrl ? (
                          <>
                            {currentReceipt?.file_type?.toLowerCase() === 'pdf' || 
                             currentReceipt?.file_name?.toLowerCase().endsWith('.pdf') ? (
                              <div className="h-full w-full p-2">
                                <PdfViewer 
                                  url={imageUrl} 
                                  fileName={currentReceipt?.file_name || 'document.pdf'}
                                  className="h-full"
                                  compact={true}
                                  onError={() => setImageError('PDF konnte nicht geladen werden')}
                                />
                              </div>
                            ) : (
                              <>
                                <img 
                                  src={imageUrl} 
                                  alt={currentReceipt?.file_name || 'Beleg'}
                                  className="w-full h-full object-contain"
                                  crossOrigin="anonymous"
                                  onError={() => {
                                    setImageError('Bild konnte nicht geladen werden');
                                    setImageUrl(null);
                                  }}
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <ZoomIn className="h-8 w-8 text-white" />
                                </div>
                              </>
                            )}
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full">
                            <FileText className="h-16 w-16 text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">Keine Vorschau</p>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2 truncate text-center">
                        {currentReceipt?.file_name}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => setLightboxOpen(true)}
                          disabled={!imageUrl || imageLoading}
                        >
                          <ZoomIn className="h-4 w-4 mr-2" />
                          Vergrößern
                        </Button>
                        {imageUrl && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            asChild
                          >
                            <a href={imageUrl} download={currentReceipt?.file_name} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Side - Form */}
                  <div className="lg:col-span-1 space-y-6">
                    {/* Vendor Brand Name (Markenname) */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="vendor_brand">Lieferant (Markenname)</Label>
                        {currentReceipt?.vendor_id && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() => window.open(`/settings?tab=vendors&vendorId=${currentReceipt.vendor_id}`, '_blank')}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Lieferant in Einstellungen bearbeiten</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger>
                            <div className={cn(
                              'h-2 w-2 rounded-full',
                              getConfidenceColor(getFieldConfidence(currentReceipt?.vendor_brand, currentReceipt?.ai_confidence))
                            )} />
                          </TooltipTrigger>
                          <TooltipContent>
                            {currentReceipt?.vendor_brand ? 'Von KI erkannt' : 'Nicht erkannt'}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        id="vendor_brand"
                        value={formData.vendor_brand}
                        onChange={(e) => setFormData(prev => ({ ...prev, vendor_brand: e.target.value }))}
                        placeholder="z.B. timr, Amazon, A1"
                      />
                    </div>

                    {/* Legal Company Name (Rechtlicher Firmenname) */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="vendor" className="text-sm text-muted-foreground">
                          Rechtlicher Firmenname
                        </Label>
                        {currentReceipt?.vendor && (
                          <Tooltip>
                            <TooltipTrigger>
                              <div className={cn(
                                'h-2 w-2 rounded-full',
                                getConfidenceColor(getFieldConfidence(currentReceipt?.vendor, currentReceipt?.ai_confidence))
                              )} />
                            </TooltipTrigger>
                            <TooltipContent>
                              {currentReceipt?.vendor ? 'Von KI erkannt' : 'Nicht erkannt'}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <Input
                        id="vendor"
                        value={formData.vendor}
                        onChange={(e) => setFormData(prev => ({ ...prev, vendor: e.target.value }))}
                        placeholder="z.B. troii Software GmbH"
                        className="text-sm"
                      />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="description">Beschreibung</Label>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className={cn(
                              'h-2 w-2 rounded-full',
                              getConfidenceColor(getFieldConfidence(currentReceipt?.description, currentReceipt?.ai_confidence))
                            )} />
                          </TooltipTrigger>
                          <TooltipContent>
                            {currentReceipt?.description ? 'Von KI erkannt' : 'Nicht erkannt'}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Was wurde gekauft?"
                      />
                    </div>

                    {/* Invoice Number & Date Row */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      {/* Invoice Number */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="invoice_number">Rechnungsnummer</Label>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className={cn(
                                'h-2 w-2 rounded-full',
                                getConfidenceColor(getFieldConfidence(currentReceipt?.invoice_number, currentReceipt?.ai_confidence))
                              )} />
                            </TooltipTrigger>
                            <TooltipContent>
                              {currentReceipt?.invoice_number ? 'Von KI erkannt' : 'Nicht erkannt'}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          id="invoice_number"
                          value={formData.invoice_number}
                          onChange={(e) => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
                          placeholder="z.B. 150659225"
                        />
                      </div>

                      {/* Date */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label>Belegdatum</Label>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className={cn(
                                'h-2 w-2 rounded-full',
                                getConfidenceColor(getFieldConfidence(currentReceipt?.receipt_date, currentReceipt?.ai_confidence))
                              )} />
                            </TooltipTrigger>
                            <TooltipContent>
                              {currentReceipt?.receipt_date ? 'Von KI erkannt' : 'Nicht erkannt'}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full justify-start text-left font-normal',
                                !formData.receipt_date && 'text-muted-foreground'
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {formData.receipt_date 
                                ? format(formData.receipt_date, 'dd.MM.yyyy', { locale: de })
                                : 'Datum wählen'
                              }
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={formData.receipt_date || undefined}
                              onSelect={(date) => setFormData(prev => ({ ...prev, receipt_date: date || null }))}
                              initialFocus
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* Category */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label>Kategorie</Label>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className={cn(
                              'h-2 w-2 rounded-full',
                              getConfidenceColor(getFieldConfidence(currentReceipt?.category, currentReceipt?.ai_confidence))
                            )} />
                          </TooltipTrigger>
                          <TooltipContent>
                            {currentReceipt?.category ? 'Von KI erkannt' : 'Nicht erkannt'}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Select
                        value={formData.category}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Kategorie wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.name}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Split Booking Editor */}
                    {splitBookingEnabled && currentReceipt && (
                      <SplitBookingEditor
                        receiptId={currentReceipt.id}
                        totalGross={parseFloat(formData.amount_gross) || 0}
                        mainCategory={formData.category}
                        mainVatRate={parseFloat(formData.vat_rate) || 20}
                      />
                    )}

                    {/* Amount & VAT Row */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      {/* Gross Amount */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="amount_gross">Bruttobetrag</Label>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className={cn(
                                'h-2 w-2 rounded-full',
                                getConfidenceColor(getFieldConfidence(currentReceipt?.amount_gross?.toString(), currentReceipt?.ai_confidence))
                              )} />
                            </TooltipTrigger>
                            <TooltipContent>
                              {currentReceipt?.amount_gross ? 'Von KI erkannt' : 'Nicht erkannt'}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="relative">
                          <Input
                            id="amount_gross"
                            type="number"
                            step="0.01"
                            value={formData.amount_gross}
                            onChange={(e) => setFormData(prev => ({ ...prev, amount_gross: e.target.value }))}
                            placeholder="0.00"
                            className="pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            €
                          </span>
                        </div>
                      </div>

                      {/* VAT Rate */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label>MwSt-Satz</Label>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className={cn(
                                'h-2 w-2 rounded-full',
                                getConfidenceColor(getFieldConfidence(currentReceipt?.vat_rate?.toString(), currentReceipt?.ai_confidence))
                              )} />
                            </TooltipTrigger>
                            <TooltipContent>
                              {currentReceipt?.vat_rate ? 'Von KI erkannt' : 'Nicht erkannt'}
                            </TooltipContent>
                          </Tooltip>
                          {/* Low VAT confidence warning */}
                          {(currentReceipt as any)?.vat_confidence !== null && 
                           (currentReceipt as any)?.vat_confidence !== undefined && 
                           (currentReceipt as any)?.vat_confidence < 0.7 && (
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                              </TooltipTrigger>
                              <TooltipContent>
                                MwSt-Satz unsicher erkannt ({Math.round(((currentReceipt as any)?.vat_confidence || 0) * 100)}% Konfidenz). Bitte überprüfen.
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {/* Learned VAT badge */}
                          {(currentReceipt as any)?.vat_detection_method === 'learned' && (
                            <Badge variant="secondary" className="text-xs py-0 px-1.5">
                              Gelernt
                            </Badge>
                          )}
                        </div>
                        <Select
                          value={formData.is_mixed_tax_rate ? 'mixed' : formData.vat_rate}
                          onValueChange={(value) => {
                            if (value === 'mixed') {
                              setFormData(prev => ({ ...prev, vat_rate: '0', is_mixed_tax_rate: true }));
                            } else {
                              setFormData(prev => ({ ...prev, vat_rate: value, is_mixed_tax_rate: false, tax_rate_details: null }));
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VAT_RATE_GROUPS.map(group => (
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
                      </div>
                    </div>

                    {/* Special VAT Case Badge */}
                    {(currentReceipt as any)?.special_vat_case && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-300">
                          {(currentReceipt as any)?.special_vat_case === 'kleinunternehmer' && 'Kleinunternehmer-Rechnung (0% MwSt)'}
                          {(currentReceipt as any)?.special_vat_case === 'reverse_charge' && 'Reverse-Charge (Steuerschuldnerschaft)'}
                          {(currentReceipt as any)?.special_vat_case === 'ig_lieferung' && 'Innergemeinschaftliche Lieferung'}
                          {(currentReceipt as any)?.special_vat_case === 'export' && 'Steuerfreie Ausfuhr'}
                        </Badge>
                        {(currentReceipt as any)?.vendor_country && (
                          <span className="text-xs text-muted-foreground">
                            Land: {(currentReceipt as any)?.vendor_country}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Mixed Tax Rate Details */}
                    {formData.is_mixed_tax_rate && formData.tax_rate_details && formData.tax_rate_details.length > 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <span className="text-sm font-medium text-amber-800">Mehrere Steuersätze erkannt</span>
                        </div>
                        <div className="space-y-1">
                          {formData.tax_rate_details.map((detail, idx) => (
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
                    <div className="grid sm:grid-cols-2 gap-4 items-end">
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Nettobetrag</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.amount_net_override}
                          onChange={(e) => setFormData(prev => ({ ...prev, amount_net_override: e.target.value }))}
                          placeholder={calculations.net ? `${calculations.net.toFixed(2)} (berechnet)` : '—'}
                          className={formData.amount_net_override ? '' : 'bg-muted'}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground flex items-center gap-1">
                          MwSt-Betrag
                          {formData.is_mixed_tax_rate && (
                            <span className="text-xs">(gemischt)</span>
                          )}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.vat_amount_override}
                          onChange={(e) => setFormData(prev => ({ ...prev, vat_amount_override: e.target.value }))}
                          placeholder={calculations.vat ? `${calculations.vat.toFixed(2)} (berechnet)` : '—'}
                          className={formData.vat_amount_override ? '' : 'bg-muted'}
                        />
                      </div>
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label>Zahlungsart</Label>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className={cn(
                              'h-2 w-2 rounded-full',
                              getConfidenceColor(getFieldConfidence(currentReceipt?.payment_method, currentReceipt?.ai_confidence))
                            )} />
                          </TooltipTrigger>
                          <TooltipContent>
                            {currentReceipt?.payment_method ? 'Von KI erkannt' : 'Nicht erkannt'}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Select
                        value={formData.payment_method}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, payment_method: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Zahlungsart wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map(method => (
                            <SelectItem key={method.value} value={method.value}>
                              {method.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Tags */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <Label>Tags</Label>
                      </div>
                      {currentReceipt && (
                        <TagSelector
                          receiptId={currentReceipt.id}
                          size="sm"
                        />
                      )}
                    </div>

                    {/* Low Confidence Warning */}
                    {currentReceipt?.ai_confidence !== null && currentReceipt?.ai_confidence < 0.5 && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                        <AlertTriangle className="h-5 w-5 text-warning" />
                        <p className="text-sm text-warning">
                          Niedrige KI-Konfidenz. Bitte Daten sorgfältig prüfen.
                        </p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3 pt-4 border-t">
                      <Button
                        className="gradient-primary hover:opacity-90 flex-1 sm:flex-none"
                        onClick={() => saveReceipt('approved')}
                        disabled={saving}
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        )}
                        Bestätigen & Weiter
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => saveReceipt()}
                        disabled={saving}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Speichern
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => saveReceipt('rejected')}
                        disabled={saving}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Ablehnen
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={skipReceipt}
                        disabled={saving || receipts.length <= 1}
                      >
                        <SkipForward className="h-4 w-4 mr-2" />
                        Überspringen
                      </Button>
                      <Button
                        variant="ghost"
                        className="ml-auto text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteDialogOpen(true)}
                        disabled={saving}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Löschen
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Lightbox Dialog */}
        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent className="max-w-4xl h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span className="truncate">{currentReceipt?.file_name}</span>
                {imageUrl && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    asChild
                    className="ml-2"
                  >
                    <a href={imageUrl} download={currentReceipt?.file_name} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </a>
                  </Button>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto flex items-center justify-center">
              {imageUrl ? (
                currentReceipt?.file_type?.toLowerCase() === 'pdf' ||
                currentReceipt?.file_name?.toLowerCase().endsWith('.pdf') ? (
                  <div className="w-full h-full max-w-4xl mx-auto">
                    <PdfViewer 
                      url={imageUrl} 
                      fileName={currentReceipt?.file_name || 'document.pdf'}
                      className="h-full"
                      onError={() => {
                        toast({
                          variant: 'destructive',
                          title: 'PDF konnte nicht geladen werden',
                          description: 'Bitte versuchen Sie es erneut oder laden Sie die Datei herunter.',
                        });
                      }}
                    />
                  </div>
                ) : (
                  <img 
                    src={imageUrl} 
                    alt={currentReceipt?.file_name || 'Beleg'}
                    className="max-w-full max-h-full object-contain"
                    crossOrigin="anonymous"
                    onError={() => {
                      toast({
                        variant: 'destructive',
                        title: 'Bild konnte nicht geladen werden',
                        description: 'Bitte versuchen Sie es erneut oder laden Sie die Datei herunter.',
                      });
                    }}
                  />
                )
              ) : (
                <div className="flex flex-col items-center gap-4 text-muted-foreground">
                  <FileText className="h-16 w-16" />
                  <p>Keine Vorschau verfügbar</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Beleg wirklich löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{currentReceipt?.file_name}</strong> wird dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={saving}>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={saving}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Löschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default Review;
