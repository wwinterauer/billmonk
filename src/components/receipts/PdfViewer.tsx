import { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  url: string;
  fileName?: string;
  className?: string;
  onError?: () => void;
}

export function PdfViewer({ url, fileName, className, onError }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(false);
  }, []);

  const onDocumentLoadError = useCallback(() => {
    setLoading(false);
    setError(true);
    onError?.();
  }, [onError]);

  const goToPrevPage = () => setPageNumber((prev) => Math.max(prev - 1, 1));
  const goToNextPage = () => setPageNumber((prev) => Math.min(prev + 1, numPages));
  const zoomIn = () => setScale((prev) => Math.min(prev + 0.25, 2.5));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));

  if (error) {
    return null; // Let parent handle error state
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Controls */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b mb-3">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-2 min-w-[80px] text-center">
            {pageNumber} / {numPages || '...'}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={zoomOut}
            disabled={scale <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-2 min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={zoomIn}
            disabled={scale >= 2.5}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Document */}
      <div className="flex-1 overflow-auto bg-muted/30 rounded-lg flex justify-center">
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="flex items-center justify-center h-full min-h-[300px]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }
          className="flex justify-center py-4"
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            loading={
              <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            }
            className="shadow-lg"
          />
        </Document>
      </div>
    </div>
  );
}
