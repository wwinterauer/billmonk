import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PdfViewer } from '@/components/receipts/PdfViewer';
import { supabase } from '@/integrations/supabase/client';
import { Download, ExternalLink, Loader2, Printer, Send } from 'lucide-react';

interface PdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfStoragePath?: string | null;
  pdfUrl?: string | null;
  invoiceNumber?: string;
  title?: string;
  onSend?: () => void;
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

  const handleOpenInNewTab = () => {
    if (resolvedUrl) {
      window.open(resolvedUrl, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[98vw] w-[98vw] h-[98vh] max-h-[98vh] p-0 gap-0 flex flex-col overflow-hidden"
        style={{ maxWidth: '98vw', width: '98vw', height: '98vh', maxHeight: '98vh' }}
      >
        {/* Header */}
        <DialogHeader className="px-6 py-3 border-b flex-shrink-0 pr-14">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold truncate mr-4">
              {displayTitle}
            </DialogTitle>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={handlePrint} disabled={!resolvedUrl}>
                <Printer className="h-4 w-4 mr-2" />
                Drucken
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={!resolvedUrl}>
                <Download className="h-4 w-4 mr-2" />
                Herunterladen
              </Button>
              <Button variant="outline" size="sm" onClick={handleOpenInNewTab} disabled={!resolvedUrl}>
                <ExternalLink className="h-4 w-4 mr-2" />
                In neuem Tab
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 bg-muted/50 flex flex-col overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          ) : resolvedUrl ? (
            <div className="flex-1 p-4 overflow-auto flex items-center justify-center">
              <div className="w-full h-full" style={{ minHeight: 'calc(98vh - 80px)' }}>
                <PdfViewer
                  url={resolvedUrl}
                  fileName={`${downloadName}.pdf`}
                  className="h-full"
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-muted-foreground">Kein PDF verfügbar</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
