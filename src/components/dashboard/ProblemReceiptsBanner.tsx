import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProblemReceiptCount } from '@/hooks/useReceiptRetry';

export function ProblemReceiptsBanner() {
  const { count } = useProblemReceiptCount();

  if (count === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
      <div className="flex-1">
        <p className="font-medium text-foreground">
          {count} {count === 1 ? 'Beleg konnte' : 'Belege konnten'} nicht verarbeitet werden
        </p>
        <p className="text-sm text-muted-foreground">
          Diese Belege erscheinen nicht in der Prüfliste. Sieh sie dir an und starte die Analyse neu.
        </p>
      </div>
      <Link to="/review?tab=problems">
        <Button variant="outline" className="w-full sm:w-auto border-destructive text-destructive hover:bg-destructive/10">
          Problembelege ansehen
        </Button>
      </Link>
    </div>
  );
}
