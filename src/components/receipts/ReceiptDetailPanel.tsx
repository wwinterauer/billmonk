import { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { useReceipts, type Receipt } from '@/hooks/useReceipts';
import { useCategories } from '@/hooks/useCategories';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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

  // Form state
  const [vendor, setVendor] = useState('');
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

  // Load receipt data
  useEffect(() => {
    if (!receiptId || !open) {
      setReceipt(null);
      setPreviewBlobUrl(null);
      setSignedUrl(null);
      setFileError(false);
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

  // Download/Open handlers using signedUrl
  const handleDownload = () => {
    if (signedUrl && receipt?.file_name) {
      const link = document.createElement('a');
      link.href = signedUrl;
      link.download = receipt.file_name;
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

  const handleSave = async (newStatus?: 'approved' | 'rejected') => {
    if (!receipt) return;

    setSaving(true);
    try {
      await updateReceipt(receipt.id, {
        vendor: vendor || null,
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
        ...(newStatus && { status: newStatus }),
      });

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
                          <div className="h-[500px] w-full flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-muted/50 to-muted rounded-lg p-8">
                            {/* PDF Icon and Info */}
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-24 h-28 bg-background rounded-lg shadow-md flex flex-col items-center justify-center border">
                                <FileText className="h-12 w-12 text-red-500" />
                                <span className="text-xs font-semibold text-red-500 mt-1">PDF</span>
                              </div>
                              <p className="font-medium text-foreground text-center max-w-[250px] truncate">
                                {receipt?.file_name}
                              </p>
                              <p className="text-sm text-muted-foreground text-center">
                                PDF-Vorschau im Browser nicht möglich
                              </p>
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3">
                              <Button onClick={handleOpenInNewTab} className="gap-2">
                                <ExternalLink className="h-4 w-4" />
                                PDF in neuem Tab öffnen
                              </Button>
                              <Button variant="outline" onClick={handleDownload} className="gap-2">
                                <Download className="h-4 w-4" />
                                Herunterladen
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
                  </div>

                  {/* Right Column - Form */}
                  <div className="space-y-4">
                    {/* AI Confidence Box */}
                    {receipt.ai_confidence && receipt.ai_confidence > 0 && (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
                        <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-primary/10 text-primary">
                              KI-Erkennung: {Math.round(receipt.ai_confidence * 100)}%
                            </Badge>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-4 w-4 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-[200px]">
                                  Diese Werte wurden automatisch erkannt. 
                                  Bitte überprüfen und bei Bedarf korrigieren.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Form Fields */}
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="vendor">Lieferant</Label>
                        <Input
                          id="vendor"
                          value={vendor}
                          onChange={(e) => setVendor(e.target.value)}
                          placeholder="z.B. Amazon, MediaMarkt..."
                        />
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
