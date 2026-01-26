import { CheckCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ImportResult {
  totalTransactions: number;
  expenses: number;
  income: number;
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
            <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
            <DialogTitle className="text-xl">Import erfolgreich!</DialogTitle>
          </div>
        </DialogHeader>
        
        <div className="space-y-3 py-4">
          <div className="flex justify-between items-center py-2 border-b border-border">
            <span className="text-muted-foreground">Buchungen gefunden</span>
            <span className="font-semibold">{result.totalTransactions}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border">
            <span className="text-muted-foreground">Ausgaben (Abbuchungen)</span>
            <span className="font-semibold">{result.expenses}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border">
            <span className="text-muted-foreground">Einnahmen (ignoriert)</span>
            <span className="font-semibold text-muted-foreground">{result.income}</span>
          </div>
          <div className="flex justify-between items-center py-2 bg-primary/5 rounded-lg px-3 -mx-3">
            <span className="text-primary font-medium">Mögliche Matches mit Belegen</span>
            <span className="font-bold text-primary">{result.possibleMatches}</span>
          </div>
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
