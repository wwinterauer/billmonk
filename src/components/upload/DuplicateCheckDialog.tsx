import { useState } from 'react';
import { AlertTriangle, Upload as UploadIcon, FileText, Eye, AlertCircle, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export interface FileCheckResult {
  file: File;
  hash: string;
  isDuplicate: boolean;
  existingReceipt?: {
    id: string;
    file_name: string | null;
    file_url: string | null;
    vendor?: string | null;
    amount_gross?: number | null;
    receipt_date?: string | null;
  };
}

interface DuplicateCheckDialogProps {
  open: boolean;
  duplicates: FileCheckResult[];
  nonDuplicateCount: number;
  onComplete: (decisions: Map<File, 'skip' | 'upload'>) => void;
  onCancel: () => void;
}

export function DuplicateCheckDialog({
  open,
  duplicates,
  nonDuplicateCount,
  onComplete,
  onCancel,
}: DuplicateCheckDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [decisions, setDecisions] = useState<Map<File, 'skip' | 'upload'>>(new Map());

  const current = duplicates[currentIndex];
  const isLast = currentIndex === duplicates.length - 1;
  const remaining = duplicates.length - currentIndex;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDecision = (decision: 'skip' | 'upload') => {
    const newDecisions = new Map(decisions);
    newDecisions.set(current.file, decision);
    setDecisions(newDecisions);

    if (isLast) {
      onComplete(newDecisions);
      // Reset state for next use
      setCurrentIndex(0);
      setDecisions(new Map());
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleSkipAll = () => {
    const newDecisions = new Map(decisions);
    for (let i = currentIndex; i < duplicates.length; i++) {
      newDecisions.set(duplicates[i].file, 'skip');
    }
    onComplete(newDecisions);
    // Reset state
    setCurrentIndex(0);
    setDecisions(new Map());
  };

  const handleUploadAll = () => {
    const newDecisions = new Map(decisions);
    for (let i = currentIndex; i < duplicates.length; i++) {
      newDecisions.set(duplicates[i].file, 'upload');
    }
    onComplete(newDecisions);
    // Reset state
    setCurrentIndex(0);
    setDecisions(new Map());
  };

  const handleViewOriginal = () => {
    if (current?.existingReceipt?.id) {
      window.open(`/expenses?receipt=${current.existingReceipt.id}`, '_blank');
    }
  };

  const handleCancel = () => {
    // Reset state
    setCurrentIndex(0);
    setDecisions(new Map());
    onCancel();
  };

  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={() => {/* Don't close on overlay click */}}>
      <DialogContent 
        className="max-w-2xl w-[95vw]" 
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="w-5 h-5" />
            <span>Duplikat erkannt</span>
          </DialogTitle>
          {/* Summary */}
          <div className="flex gap-4 text-sm mt-2">
            <span className="text-success flex items-center gap-1">
              <span className="text-lg">✓</span> {nonDuplicateCount} neue Dateien
            </span>
            <span className="text-warning flex items-center gap-1">
              <span className="text-lg">⚠</span> {duplicates.length} Duplikate
            </span>
          </div>
        </DialogHeader>

        {/* Progress through duplicates */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="whitespace-nowrap">Duplikat {currentIndex + 1} von {duplicates.length}</span>
          <Progress value={((currentIndex + 1) / duplicates.length) * 100} className="flex-1 h-2" />
        </div>

        {/* Current duplicate */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
          {/* New file */}
          <Card className="p-4 border-warning/40 bg-warning/10">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-warning flex items-center justify-center">
                <UploadIcon className="h-4 w-4 text-warning-foreground" />
              </div>
              <span className="font-semibold text-warning text-sm">Neue Datei</span>
            </div>
            <p className="text-sm font-medium truncate" title={current.file.name}>
              {current.file.name}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatFileSize(current.file.size)}
            </p>
          </Card>

          {/* Existing file */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <span className="font-semibold text-foreground text-sm">Bereits vorhanden</span>
            </div>
            <p className="text-sm font-medium truncate" title={current.existingReceipt?.file_name || ''}>
              {current.existingReceipt?.file_name || '–'}
            </p>
            <div className="mt-3 space-y-1.5 text-sm">
              {current.existingReceipt?.vendor && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Lieferant:</span>
                  <span className="font-medium">{current.existingReceipt.vendor}</span>
                </div>
              )}
              {current.existingReceipt?.amount_gross && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Betrag:</span>
                  <span className="font-medium">€ {current.existingReceipt.amount_gross.toFixed(2)}</span>
                </div>
              )}
              {current.existingReceipt?.receipt_date && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Datum:</span>
                  <span className="font-medium">
                    {format(new Date(current.existingReceipt.receipt_date), 'dd.MM.yyyy', { locale: de })}
                  </span>
                </div>
              )}
            </div>
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto text-xs mt-2"
              onClick={handleViewOriginal}
            >
              <Eye className="w-3 h-3 mr-1" />
              Original ansehen
            </Button>
          </Card>
        </div>

        {/* Info hint */}
        <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Identische Dateien werden anhand ihres Inhalts erkannt (Hash-Vergleich).</span>
        </div>

        <DialogFooter className="flex-col gap-4 sm:flex-col">
          {/* Actions for this file */}
          <div className="flex justify-center gap-3 w-full">
            <Button
              variant="outline"
              onClick={() => handleDecision('skip')}
              className="flex-1 max-w-[180px]"
            >
              Überspringen
            </Button>
            <Button
              onClick={() => handleDecision('upload')}
              className="bg-warning text-warning-foreground hover:bg-warning/90 flex-1 max-w-[180px]"
            >
              <Copy className="w-4 h-4 mr-2" />
              Trotzdem hochladen
            </Button>
          </div>

          {/* Bulk actions - only shown when more than 1 remaining */}
          {remaining > 1 && (
            <>
              <div className="relative w-full">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-3 text-muted-foreground">
                    Für alle {remaining} verbleibenden
                  </span>
                </div>
              </div>
              <div className="flex justify-center gap-3 w-full">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkipAll}
                  className="text-muted-foreground"
                >
                  Alle überspringen
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUploadAll}
                  className="text-warning"
                >
                  Alle hochladen
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
