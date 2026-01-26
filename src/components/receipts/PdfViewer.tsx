import { useState, useCallback, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, Maximize2 } from 'lucide-react';
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
  compact?: boolean; // For smaller preview areas
}

export function PdfViewer({ url, fileName, className, onError, compact = false }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fitMode, setFitMode] = useState<'width' | 'manual'>('width');

  // Measure container width
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        // Account for padding
        const width = containerRef.current.clientWidth - 32;
        setContainerWidth(width > 0 ? width : null);
      }
    };

    updateWidth();
    
    const resizeObserver = new ResizeObserver(updateWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

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
  
  const zoomIn = () => {
    setFitMode('manual');
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  };
  
  const zoomOut = () => {
    setFitMode('manual');
    setScale((prev) => Math.max(prev - 0.25, 0.25));
  };

  const fitToWidth = () => {
    setFitMode('width');
    setScale(1.0);
  };

  if (error) {
    return null; // Let parent handle error state
  }

  return (
    <div ref={containerRef} className={cn("flex flex-col h-full", className)}>
      {/* Controls */}
      <div className={cn(
        "flex items-center justify-between gap-2 pb-2 border-b mb-2",
        compact && "pb-1 mb-1"
      )}>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className={cn("h-7 w-7", compact && "h-6 w-6")}
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className={cn("h-4 w-4", compact && "h-3 w-3")} />
          </Button>
          <span className={cn(
            "text-sm text-muted-foreground px-1 min-w-[60px] text-center",
            compact && "text-xs min-w-[50px]"
          )}>
            {pageNumber}/{numPages || '…'}
          </span>
          <Button
            variant="outline"
            size="icon"
            className={cn("h-7 w-7", compact && "h-6 w-6")}
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
          >
            <ChevronRight className={cn("h-4 w-4", compact && "h-3 w-3")} />
          </Button>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className={cn("h-7 w-7", compact && "h-6 w-6")}
            onClick={zoomOut}
            disabled={fitMode === 'width' ? false : scale <= 0.25}
            title="Verkleinern"
          >
            <ZoomOut className={cn("h-4 w-4", compact && "h-3 w-3")} />
          </Button>
          <Button
            variant={fitMode === 'width' ? 'secondary' : 'outline'}
            size="icon"
            className={cn("h-7 w-7", compact && "h-6 w-6")}
            onClick={fitToWidth}
            title="An Breite anpassen"
          >
            <Maximize2 className={cn("h-4 w-4", compact && "h-3 w-3")} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={cn("h-7 w-7", compact && "h-6 w-6")}
            onClick={zoomIn}
            disabled={fitMode === 'manual' && scale >= 3.0}
            title="Vergrößern"
          >
            <ZoomIn className={cn("h-4 w-4", compact && "h-3 w-3")} />
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
            <div className="flex items-center justify-center h-full min-h-[200px]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }
          className="flex justify-center py-2"
        >
          {fitMode === 'width' && containerWidth ? (
            <Page
              pageNumber={pageNumber}
              width={containerWidth}
              loading={
                <div className="flex items-center justify-center min-h-[200px]">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              }
              className="shadow-lg"
            />
          ) : (
            <Page
              pageNumber={pageNumber}
              scale={scale}
              loading={
                <div className="flex items-center justify-center min-h-[200px]">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              }
              className="shadow-lg"
            />
          )}
        </Document>
      </div>
    </div>
  );
}
