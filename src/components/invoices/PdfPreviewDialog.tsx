import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PdfViewer } from '@/components/receipts/PdfViewer';
import { supabase } from '@/integrations/supabase/client';
import { Printer, Download, Loader2 } from 'lucide-react';

interface PdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfStoragePath: string | null;
  invoiceNumber: string;
}

export function PdfPreviewDialog({ open, onOpenChange, pdfStoragePath, invoiceNumber }: PdfPreviewDialogProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && pdfStoragePath) {
      setLoading(true);
      supabase.storage
        .from('invoices')
        .createSignedUrl(pdfStoragePath, 3600)
        .then(({ data }) => {
          setPdfUrl(data?.signedUrl || null);
          setLoading(false);
        });
    } else if (!open) {
      setPdfUrl(null);
    }
  }, [open, pdfStoragePath]);

  const handlePrint = () => {
    if (!pdfUrl) return;
    const w = window.open(pdfUrl, '_blank');
    if (w) {
      w.addEventListener('load', () => setTimeout(() => w.print(), 500));
    }
  };

  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `${invoiceNumber}.pdf`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>{invoiceNumber} — PDF</DialogTitle>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={handlePrint} disabled={!pdfUrl}>
              <Printer className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDownload} disabled={!pdfUrl}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : pdfUrl ? (
            <PdfViewer url={pdfUrl} className="h-full" />
          ) : (
            <p className="text-center text-muted-foreground py-12">Kein PDF verfügbar</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
