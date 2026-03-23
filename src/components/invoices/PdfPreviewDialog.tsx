import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PdfViewer } from '@/components/receipts/PdfViewer';
import { supabase } from '@/integrations/supabase/client';
import { Printer, Download, Loader2 } from 'lucide-react';

interface PdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfStoragePath?: string | null;
  pdfUrl?: string | null;
  invoiceNumber?: string;
  title?: string;
}

export function PdfPreviewDialog({ open, onOpenChange, pdfStoragePath, pdfUrl: directPdfUrl, invoiceNumber, title }: PdfPreviewDialogProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setResolvedUrl(null);
      return;
    }
    if (directPdfUrl) {
      setResolvedUrl(directPdfUrl);
    } else if (pdfStoragePath) {
      setLoading(true);
      supabase.storage
        .from('invoices')
        .createSignedUrl(pdfStoragePath, 3600)
        .then(({ data }) => {
          setResolvedUrl(data?.signedUrl || null);
          setLoading(false);
        });
    }
  }, [open, pdfStoragePath, directPdfUrl]);

  const displayTitle = title || (invoiceNumber ? `${invoiceNumber} — PDF` : 'PDF');
  const downloadName = invoiceNumber || 'document';

  const handlePrint = () => {
    if (!resolvedUrl) return;
    const w = window.open(resolvedUrl, '_blank');
    if (w) {
      w.addEventListener('load', () => setTimeout(() => w.print(), 500));
    }
  };

  const handleDownload = () => {
    if (!resolvedUrl) return;
    const a = document.createElement('a');
    a.href = resolvedUrl;
    a.download = `${downloadName}.pdf`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>{displayTitle}</DialogTitle>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={handlePrint} disabled={!resolvedUrl}>
              <Printer className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDownload} disabled={!resolvedUrl}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : resolvedUrl ? (
            <PdfViewer url={resolvedUrl} className="h-full" />
          ) : (
            <p className="text-center text-muted-foreground py-12">Kein PDF verfügbar</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
