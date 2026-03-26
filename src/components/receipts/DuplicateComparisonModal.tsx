import { useState, useEffect } from 'react';
import { 
  GitCompare, 
  Copy, 
  FileCheck, 
  ExternalLink, 
  Trash2, 
  X, 
  Loader2,
  FileText,
  ImageIcon,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PdfViewer } from '@/components/receipts/PdfViewer';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ReceiptData {
  id: string;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  vendor: string | null;
  vendor_brand: string | null;
  amount_gross: number | null;
  amount_net: number | null;
  vat_amount: number | null;
  vat_rate: number | null;
  receipt_date: string | null;
  invoice_number: string | null;
  category: string | null;
  status: string | null;
  is_duplicate: boolean | null;
  duplicate_of: string | null;
  duplicate_score: number | null;
  created_at: string | null;
}

interface DuplicateComparisonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateId: string | null;
  originalId: string | null;
  onRefresh?: () => void;
}

interface ComparisonRowProps {
  label: string;
  value?: string | number | null;
  otherValue?: string | number | null;
  isOriginal?: boolean;
  format?: 'currency' | 'date' | 'percent' | 'text';
}

function ComparisonRow({ label, value, otherValue, isOriginal = false, format: formatType = 'text' }: ComparisonRowProps) {
  const formatValue = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '–';
    
    switch (formatType) {
      case 'currency':
        return `€ ${Number(val).toFixed(2)}`;
      case 'date':
        try {
          return format(new Date(val as string), 'dd.MM.yyyy', { locale: de });
        } catch {
          return String(val);
        }
      case 'percent':
        return `${val}%`;
      default:
        return String(val);
    }
  };

  const formattedValue = formatValue(value);
  const formattedOther = formatValue(otherValue);
  const isDifferent = formattedValue !== formattedOther;

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn(
        "text-sm font-medium",
        isDifferent && !isOriginal && "text-warning"
      )}>
        {formattedValue}
        {isDifferent && !isOriginal && (
          <span className="ml-1 text-xs text-muted-foreground">≠</span>
        )}
      </span>
    </div>
  );
}

interface ReceiptPreviewCardProps {
  receipt: ReceiptData | null;
  otherReceipt: ReceiptData | null;
  type: 'duplicate' | 'original';
  onDelete: () => void;
  onViewDetails: () => void;
  loading?: boolean;
}

function ReceiptPreviewCard({ receipt, otherReceipt, type, onDelete, onViewDetails, loading }: ReceiptPreviewCardProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    let currentBlobUrl: string | null = null;
    
    async function loadPreview() {
      if (!receipt?.file_url) {
        return;
      }
      
      setPreviewLoading(true);
      setPreviewError(false);
      setPreviewUrl(null);
      
      try {
        // Get signed URL
        const { data, error } = await supabase.storage
          .from('receipts')
          .createSignedUrl(receipt.file_url, 3600);

        if (isCancelled) return;

        if (error) {
          console.error('[Preview] Signed URL error:', error);
          throw new Error(`Signed URL failed: ${error.message}`);
        }
        
        if (!data?.signedUrl) {
          throw new Error('No signed URL returned');
        }

        // Fetch the file as blob
        const response = await fetch(data.signedUrl);
        
        if (isCancelled) return;
        
        if (!response.ok) {
          throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();
        
        if (isCancelled) {
          return;
        }
        
        // Create blob URL and set state
        currentBlobUrl = URL.createObjectURL(blob);
        setPreviewUrl(currentBlobUrl);
        setPreviewLoading(false);
        
      } catch (error) {
        if (!isCancelled) {
          console.error('[Preview] Load error:', error);
          setPreviewError(true);
          setPreviewLoading(false);
        }
      }
    }

    loadPreview();

    return () => {
      isCancelled = true;
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [receipt?.file_url, receipt?.id]);

  // Better file type detection
  const fileType = receipt?.file_type?.toLowerCase() || '';
  const fileName = receipt?.file_name?.toLowerCase() || '';
  const isPdf = fileType === 'pdf' || fileType === 'application/pdf' || fileName.endsWith('.pdf');
  const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fileType) || 
                  fileType.startsWith('image/') ||
                  /\.(jpg|jpeg|png|webp|gif)$/i.test(fileName);
  const isDuplicate = type === 'duplicate';

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-muted rounded w-24" />
        <div className="h-[400px] bg-muted rounded-lg" />
        <div className="h-[200px] bg-muted rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Badge */}
      <div className="flex items-center justify-between">
        <Badge 
          variant="outline" 
          className={cn(
            isDuplicate 
              ? "bg-warning/10 text-warning border-warning/30" 
              : "bg-success/10 text-success border-success/30"
          )}
        >
          {isDuplicate ? (
            <>
              <Copy className="w-3 h-3 mr-1" />
              Duplikat
            </>
          ) : (
            <>
              <FileCheck className="w-3 h-3 mr-1" />
              Original
            </>
          )}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {receipt?.created_at 
            ? format(new Date(receipt.created_at), 'dd.MM.yyyy HH:mm', { locale: de })
            : '–'}
        </span>
      </div>

      {/* Preview - larger container */}
      <div className="h-[400px] bg-muted/50 rounded-lg overflow-hidden border flex items-center justify-center">
        {previewLoading ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : previewError ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground p-4 text-center">
            <AlertCircle className="h-8 w-8" />
            <span className="text-sm font-medium">Vorschau nicht verfügbar</span>
            <span className="text-xs opacity-70">{receipt?.file_name || 'Datei nicht gefunden'}</span>
          </div>
        ) : previewUrl ? (
          isPdf ? (
            <div className="w-full h-full overflow-hidden">
              <PdfViewer 
                url={previewUrl} 
                fileName={receipt?.file_name || undefined}
                onError={() => setPreviewError(true)}
                className="h-full"
              />
            </div>
          ) : isImage ? (
            <img
              src={previewUrl}
              alt={receipt?.file_name || 'Beleg'}
              className="max-w-full max-h-full object-contain"
              onError={() => setPreviewError(true)}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <FileText className="h-8 w-8" />
              <span className="text-sm">{receipt?.file_name}</span>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ImageIcon className="h-8 w-8" />
            <span className="text-sm">Keine Vorschau</span>
          </div>
        )}
      </div>

      {/* Details Card */}
      <Card>
        <CardContent className="pt-4 space-y-0">
          <ComparisonRow 
            label="Dateiname" 
            value={receipt?.file_name}
            otherValue={otherReceipt?.file_name}
            isOriginal={!isDuplicate}
          />
          <ComparisonRow 
            label="Lieferant" 
            value={receipt?.vendor_brand || receipt?.vendor}
            otherValue={otherReceipt?.vendor_brand || otherReceipt?.vendor}
            isOriginal={!isDuplicate}
          />
          <ComparisonRow 
            label="Betrag (Brutto)" 
            value={receipt?.amount_gross}
            otherValue={otherReceipt?.amount_gross}
            isOriginal={!isDuplicate}
            format="currency"
          />
          <ComparisonRow 
            label="Datum" 
            value={receipt?.receipt_date}
            otherValue={otherReceipt?.receipt_date}
            isOriginal={!isDuplicate}
            format="date"
          />
          <ComparisonRow 
            label="Rechnungsnr." 
            value={receipt?.invoice_number}
            otherValue={otherReceipt?.invoice_number}
            isOriginal={!isDuplicate}
          />
          <ComparisonRow 
            label="MwSt-Satz" 
            value={receipt?.vat_rate}
            otherValue={otherReceipt?.vat_rate}
            isOriginal={!isDuplicate}
            format="percent"
          />
          <ComparisonRow 
            label="Status" 
            value={receipt?.status}
            otherValue={otherReceipt?.status}
            isOriginal={!isDuplicate}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          className="flex-1"
          onClick={onViewDetails}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Details
        </Button>
        <Button 
          variant="destructive" 
          className="flex-1"
          onClick={onDelete}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Löschen
        </Button>
      </div>
    </div>
  );
}

export function DuplicateComparisonModal({ 
  open, 
  onOpenChange, 
  duplicateId, 
  originalId,
  onRefresh 
}: DuplicateComparisonModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [duplicate, setDuplicate] = useState<ReceiptData | null>(null);
  const [original, setOriginal] = useState<ReceiptData | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; type: 'duplicate' | 'original' | null }>({
    open: false,
    type: null
  });

  useEffect(() => {
    async function loadReceipts() {
      if (!open || !duplicateId || !originalId || !user) return;

      setLoading(true);
      try {
        const [duplicateRes, originalRes] = await Promise.all([
          supabase
            .from('receipts')
            .select('*')
            .eq('id', duplicateId)
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('receipts')
            .select('*')
            .eq('id', originalId)
            .eq('user_id', user.id)
            .maybeSingle()
        ]);

        if (duplicateRes.error) throw duplicateRes.error;
        if (originalRes.error) throw originalRes.error;

        setDuplicate(duplicateRes.data);
        setOriginal(originalRes.data);
      } catch (error) {
        console.error('Error loading receipts:', error);
        toast.error('Fehler beim Laden der Belege');
      } finally {
        setLoading(false);
      }
    }

    loadReceipts();
  }, [open, duplicateId, originalId, user]);

  const handleDelete = async (type: 'duplicate' | 'original') => {
    const receiptToDelete = type === 'duplicate' ? duplicate : original;
    const otherReceipt = type === 'duplicate' ? original : duplicate;
    
    if (!receiptToDelete) return;

    try {
      // If deleting original, promote duplicate to original
      if (type === 'original' && otherReceipt) {
        await supabase
          .from('receipts')
          .update({
            is_duplicate: false,
            duplicate_of: null,
            duplicate_score: null,
            status: 'review'
          })
          .eq('id', otherReceipt.id);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('receipts')
        .delete()
        .eq('id', receiptToDelete.id);

      if (dbError) throw dbError;

      // Delete from storage
      if (receiptToDelete.file_url) {
        await supabase.storage
          .from('receipts')
          .remove([receiptToDelete.file_url]);
      }

      toast.success('Beleg gelöscht');
      setDeleteConfirm({ open: false, type: null });
      onOpenChange(false);
      onRefresh?.();
    } catch (error) {
      console.error('Error deleting receipt:', error);
      toast.error('Fehler beim Löschen');
    }
  };

  const handleMarkAsNotDuplicate = async () => {
    if (!duplicate) return;

    try {
      await supabase
        .from('receipts')
        .update({
          is_duplicate: false,
          duplicate_of: null,
          duplicate_score: null,
          status: 'review'
        })
        .eq('id', duplicate.id);

      toast.success('Beleg ist kein Duplikat mehr');
      onOpenChange(false);
      onRefresh?.();
    } catch (error) {
      console.error('Error updating receipt:', error);
      toast.error('Fehler beim Aktualisieren');
    }
  };

  const handleViewDetails = (receiptId: string) => {
    // Navigate to expenses page with receipt selected
    window.location.href = `/expenses?receipt=${receiptId}`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] w-[1400px] max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="w-5 h-5" />
              Duplikat-Vergleich
            </DialogTitle>
            <DialogDescription>
              Vergleiche die beiden Belege und entscheide welchen du behalten möchtest
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Duplicate Column */}
              <ReceiptPreviewCard
                receipt={duplicate}
                otherReceipt={original}
                type="duplicate"
                loading={loading}
                onDelete={() => setDeleteConfirm({ open: true, type: 'duplicate' })}
                onViewDetails={() => duplicate && handleViewDetails(duplicate.id)}
              />

              {/* Original Column */}
              <ReceiptPreviewCard
                receipt={original}
                otherReceipt={duplicate}
                type="original"
                loading={loading}
                onDelete={() => setDeleteConfirm({ open: true, type: 'original' })}
                onViewDetails={() => original && handleViewDetails(original.id)}
              />
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <div className="flex items-center gap-2 mr-auto">
              {duplicate?.duplicate_score && (
                <Badge variant="secondary">
                  {duplicate.duplicate_score}% Übereinstimmung
                </Badge>
              )}
            </div>
            <Button variant="outline" onClick={handleMarkAsNotDuplicate}>
              <X className="w-4 h-4 mr-2" />
              Kein Duplikat
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog 
        open={deleteConfirm.open} 
        onOpenChange={(open) => setDeleteConfirm({ open, type: deleteConfirm.type })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteConfirm.type === 'duplicate' 
                ? 'Duplikat löschen?' 
                : 'Original löschen?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm.type === 'duplicate' 
                ? 'Das Duplikat wird unwiderruflich gelöscht.' 
                : 'Achtung: Du löschst das Original. Das Duplikat wird zum neuen Original.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm.type && handleDelete(deleteConfirm.type)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
