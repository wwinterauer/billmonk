import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  ExternalLink
} from 'lucide-react';
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
  SelectItem,
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
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarIcon } from 'lucide-react';

const VAT_RATES = [
  { value: '20', label: '20%' },
  { value: '19', label: '19%' },
  { value: '13', label: '13%' },
  { value: '10', label: '10%' },
  { value: '7', label: '7%' },
  { value: '0', label: '0%' },
];

const PAYMENT_METHODS = [
  { value: 'Überweisung', label: 'Überweisung' },
  { value: 'Kreditkarte', label: 'Kreditkarte' },
  { value: 'Bar', label: 'Bar' },
  { value: 'PayPal', label: 'PayPal' },
  { value: 'Lastschrift', label: 'Lastschrift' },
];

interface FormData {
  vendor: string;
  description: string;
  receipt_date: Date | null;
  category: string;
  amount_gross: string;
  vat_rate: string;
  payment_method: string;
}

const Review = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getReceipts, updateReceipt, getReceiptFileUrl } = useReceipts();
  const { categories } = useCategories();

  // State
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    vendor: '',
    description: '',
    receipt_date: null,
    category: '',
    amount_gross: '',
    vat_rate: '20',
    payment_method: '',
  });

  // Load receipts with status='review'
  const loadReceipts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getReceipts({ status: 'review' });
      setReceipts(data);
      if (data.length > 0) {
        populateForm(data[0]);
        loadImage(data[0]);
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

  // Load image for current receipt
  const loadImage = async (receipt: Receipt) => {
    setImageLoading(true);
    setImageError(null);
    setImageUrl(null);
    
    if (receipt.file_url) {
      try {
        const url = await getReceiptFileUrl(receipt.file_url);
        setImageUrl(url);
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
    setFormData({
      vendor: receipt.vendor || '',
      description: receipt.description || '',
      receipt_date: receipt.receipt_date ? new Date(receipt.receipt_date) : null,
      category: receipt.category || '',
      amount_gross: receipt.amount_gross?.toString() || '',
      vat_rate: receipt.vat_rate?.toString() || '20',
      payment_method: receipt.payment_method || '',
    });
  };

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
    const vatRate = parseFloat(formData.vat_rate) || 0;
    const net = gross / (1 + vatRate / 100);
    const vat = gross - net;
    return { net, vat };
  }, [formData.amount_gross, formData.vat_rate]);

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
      const gross = parseFloat(formData.amount_gross) || null;
      const vatRate = parseFloat(formData.vat_rate) || null;
      let net = null;
      let vatAmount = null;
      
      if (gross && vatRate !== null) {
        net = gross / (1 + vatRate / 100);
        vatAmount = gross - net;
      }

      const updateData: Partial<Receipt> = {
        vendor: formData.vendor || null,
        description: formData.description || null,
        receipt_date: formData.receipt_date ? format(formData.receipt_date, 'yyyy-MM-dd') : null,
        category: formData.category || null,
        amount_gross: gross,
        amount_net: net,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        payment_method: formData.payment_method || null,
      };

      if (newStatus) {
        updateData.status = newStatus as Receipt['status'];
      }

      await updateReceipt(currentReceipt.id, updateData);

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
  const reviewedCount = 0; // This would come from a separate counter in a real app

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
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
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
              {/* Confidence Header */}
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-lg">
                        KI-Erkennung: {Math.round((currentReceipt?.ai_confidence || 0) * 100)}%
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Basierend auf Lovable AI Analyse
                      </p>
                    </div>
                  </div>
                  <Progress 
                    value={(currentReceipt?.ai_confidence || 0) * 100} 
                    className="w-32 h-2"
                  />
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid lg:grid-cols-5 gap-8">
                  {/* Left Side - Image Preview */}
                  <div className="lg:col-span-2">
                    <div className="sticky top-6">
                      <div 
                        className="relative aspect-[3/4] bg-muted rounded-lg overflow-hidden cursor-pointer group"
                        onClick={() => imageUrl && setLightboxOpen(true)}
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
                            {currentReceipt?.file_type?.toLowerCase() === 'pdf' ? (
                              <div className="flex flex-col items-center justify-center h-full p-6">
                                <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                                <p className="text-foreground font-medium mb-2 text-center truncate max-w-full">
                                  {currentReceipt?.file_name}
                                </p>
                                <p className="text-muted-foreground text-sm mb-4">PDF-Vorschau nicht verfügbar</p>
                                <div className="flex gap-2">
                                  <Button variant="outline" size="sm" asChild>
                                    <a href={imageUrl} download={currentReceipt?.file_name} target="_blank" rel="noopener noreferrer">
                                      <Download className="h-4 w-4 mr-2" />
                                      Herunterladen
                                    </a>
                                  </Button>
                                  <Button variant="outline" size="sm" asChild>
                                    <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="h-4 w-4 mr-2" />
                                      Öffnen
                                    </a>
                                  </Button>
                                </div>
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
                  <div className="lg:col-span-3 space-y-6">
                    {/* Vendor */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="vendor">Lieferant</Label>
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
                      </div>
                      <Input
                        id="vendor"
                        value={formData.vendor}
                        onChange={(e) => setFormData(prev => ({ ...prev, vendor: e.target.value }))}
                        placeholder="z.B. Amazon, Office Depot"
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

                    {/* Date & Category Row */}
                    <div className="grid sm:grid-cols-2 gap-4">
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
                    </div>

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
                        </div>
                        <Select
                          value={formData.vat_rate}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, vat_rate: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VAT_RATES.map(rate => (
                              <SelectItem key={rate.value} value={rate.value}>
                                {rate.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Calculated Fields (readonly) */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Nettobetrag (berechnet)</Label>
                        <Input
                          value={calculations.net ? `€ ${calculations.net.toFixed(2)}` : '—'}
                          readOnly
                          className="bg-muted"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">MwSt-Betrag (berechnet)</Label>
                        <Input
                          value={calculations.vat ? `€ ${calculations.vat.toFixed(2)}` : '—'}
                          readOnly
                          className="bg-muted"
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
                currentReceipt?.file_type?.toLowerCase() === 'pdf' ? (
                  <div className="flex flex-col items-center justify-center h-full p-8">
                    <FileText className="h-24 w-24 text-muted-foreground mb-6" />
                    <p className="text-foreground font-medium mb-2 text-lg">
                      {currentReceipt?.file_name}
                    </p>
                    <p className="text-muted-foreground mb-6">PDF-Vorschau nicht verfügbar</p>
                    <div className="flex gap-3">
                      <Button variant="outline" asChild>
                        <a href={imageUrl} download={currentReceipt?.file_name} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4 mr-2" />
                          Herunterladen
                        </a>
                      </Button>
                      <Button variant="outline" asChild>
                        <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          In neuem Tab öffnen
                        </a>
                      </Button>
                    </div>
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
      </div>
    </DashboardLayout>
  );
};

export default Review;
