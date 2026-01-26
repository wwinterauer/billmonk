import { useState, useEffect } from 'react';
import { 
  Download, 
  ExternalLink, 
  Loader2, 
  FileText, 
  ZoomIn, 
  ZoomOut, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { PdfViewer } from './PdfViewer';
import { useReceipts, type Receipt } from '@/hooks/useReceipts';

interface ReceiptPreviewDialogProps {
  receiptId: string | null;
  open: boolean;
  onClose: () => void;
}

export function ReceiptPreviewDialog({ 
  receiptId, 
  open, 
  onClose 
}: ReceiptPreviewDialogProps) {
  const { getReceipt } = useReceipts();

  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  // File type detection
  const isImage = (() => {
    const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    const fileType = receipt?.file_type?.toLowerCase() || '';
    const fileName = receipt?.file_name?.toLowerCase() || '';
    return imageExts.some(ext => fileType === ext || fileName.endsWith('.' + ext));
  })();

  const isPdf = (() => {
    const fileType = receipt?.file_type?.toLowerCase() || '';
    const fileName = receipt?.file_name?.toLowerCase() || '';
    return fileType === 'pdf' || fileName.endsWith('.pdf');
  })();

  // Load receipt data
  useEffect(() => {
    if (!receiptId || !open) {
      setReceipt(null);
      setPreviewBlobUrl(null);
      setSignedUrl(null);
      setFileError(false);
      setIsZoomed(false);
      return;
    }

    const loadReceipt = async () => {
      setLoading(true);
      try {
        const data = await getReceipt(receiptId);
        if (data) {
          setReceipt(data);
        }
      } catch (error) {
        console.error('Error loading receipt:', error);
      } finally {
        setLoading(false);
      }
    };

    loadReceipt();
  }, [receiptId, open]);

  // Load file as Blob URL
  useEffect(() => {
    let isMounted = true;
    let blobUrl: string | null = null;

    async function loadPreview() {
      if (!receipt?.file_url) return;

      setFileLoading(true);
      setFileError(false);

      try {
        const { data: signedData, error: signedError } = await supabase.storage
          .from('receipts')
          .createSignedUrl(receipt.file_url, 3600);

        if (signedError || !signedData?.signedUrl) {
          throw new Error('Could not get signed URL');
        }

        if (!isMounted) return;
        setSignedUrl(signedData.signedUrl);

        const response = await fetch(signedData.signedUrl);
        if (!response.ok) {
          throw new Error('Could not fetch file');
        }

        const blob = await response.blob();
        if (!isMounted) return;

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

    return () => {
      isMounted = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [receipt?.file_url]);

  const handleDownload = () => {
    if (signedUrl) {
      const link = document.createElement('a');
      link.href = signedUrl;
      link.download = receipt?.file_name || 'download';
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

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent 
        className="max-w-[98vw] w-[98vw] h-[98vh] max-h-[98vh] p-0 gap-0 flex flex-col overflow-hidden"
        style={{ maxWidth: '98vw', width: '98vw', height: '98vh', maxHeight: '98vh' }}
      >
        {/* Header */}
        <DialogHeader className="px-6 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              {loading ? 'Lade Vorschau...' : receipt?.file_name || 'Beleg-Vorschau'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={!signedUrl}>
                <Download className="h-4 w-4 mr-2" />
                Herunterladen
              </Button>
              <Button variant="outline" size="sm" onClick={handleOpenInNewTab} disabled={!signedUrl}>
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
          ) : !receipt ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-muted-foreground">Beleg nicht gefunden</p>
            </div>
          ) : (
            <>
              {/* Controls for images only (PDFs have built-in controls) */}
              {!isPdf && (
                <div className="flex items-center justify-center gap-4 px-4 py-2 border-b bg-background flex-shrink-0">
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
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8" 
                      disabled={!isImage || !isZoomed} 
                      onClick={() => setIsZoomed(false)}
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground min-w-[50px] text-center">
                      {isZoomed ? '150%' : '100%'}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8" 
                      disabled={!isImage || isZoomed} 
                      onClick={() => setIsZoomed(true)}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Preview Area */}
              <div className="flex-1 p-4 overflow-auto flex items-center justify-center">
                {fileLoading ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="mt-2 text-sm text-muted-foreground">Lade Vorschau...</p>
                  </div>
                ) : fileError ? (
                  <div className="flex flex-col items-center gap-4 text-muted-foreground">
                    <AlertCircle className="h-16 w-16" />
                    <p className="text-center text-foreground">Vorschau konnte nicht geladen werden</p>
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
                ) : previewBlobUrl ? (
                  isPdf ? (
                    <div className="w-full h-full" style={{ minHeight: 'calc(98vh - 80px)' }}>
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
                          "transition-transform duration-300 rounded shadow-lg cursor-zoom-in max-h-[calc(98vh-120px)]",
                        isZoomed ? "scale-150 cursor-zoom-out" : "max-w-full object-contain"
                      )}
                      onClick={() => setIsZoomed(!isZoomed)}
                      onError={() => setFileError(true)}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-muted-foreground">
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
                  <div className="flex flex-col items-center gap-4 text-muted-foreground">
                    <FileText className="h-24 w-24" />
                    <p>Keine Datei vorhanden</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
