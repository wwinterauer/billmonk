import { CheckCircle, ArrowRight, RefreshCw, Circle, Lightbulb } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ImportResult {
  imported: number;
  skippedIncome: number;
  skippedDuplicates: number;
  possibleMatches: number;
}

interface ImportResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: ImportResult;
  onImportAnother: () => void;
}

export function ImportResultDialog({ 
  open, 
  onOpenChange, 
  result,
  onImportAnother 
}: ImportResultDialogProps) {
  const navigate = useNavigate();

  const handleGoToReconciliation = () => {
    onOpenChange(false);
    navigate('/reconciliation');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle className="text-xl">Import erfolgreich!</DialogTitle>
          </div>
        </DialogHeader>
        
        <div className="space-y-3 py-4">
          <div className="flex items-center gap-3 py-2">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <span className="text-foreground">
              <strong>{result.imported}</strong> Buchungen importiert
            </span>
          </div>
          
          {result.skippedIncome > 0 && (
            <div className="flex items-center gap-3 py-2">
              <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">
                {result.skippedIncome} Einnahmen ignoriert
              </span>
            </div>
          )}
          
          {result.skippedDuplicates > 0 && (
            <div className="flex items-center gap-3 py-2">
              <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">
                {result.skippedDuplicates} Duplikate übersprungen
              </span>
            </div>
          )}
          
          {result.possibleMatches > 0 && (
            <div className="flex items-center gap-3 py-2 bg-primary/5 rounded-lg px-3 -mx-3">
              <Lightbulb className="h-5 w-5 text-primary flex-shrink-0" />
              <span className="text-primary font-medium">
                {result.possibleMatches} mögliche Matches mit Belegen
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={handleGoToReconciliation} className="w-full">
            Zum Kontoabgleich
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={onImportAnother} className="w-full">
            <RefreshCw className="mr-2 h-4 w-4" />
            Weitere Datei importieren
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
