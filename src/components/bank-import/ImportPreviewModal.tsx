import { useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { AlertCircle, ChevronDown, ChevronUp, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { ParsedTransaction, ParseResult } from '@/hooks/useBankImport';

interface ImportPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parseResult: ParseResult;
  onlyExpenses: boolean;
  skipDuplicates: boolean;
  duplicateCount: number;
  onConfirmImport: () => void;
  isImporting: boolean;
  importProgress?: { current: number; total: number };
}

export function ImportPreviewModal({
  open,
  onOpenChange,
  parseResult,
  onlyExpenses,
  skipDuplicates,
  duplicateCount,
  onConfirmImport,
  isImporting,
  importProgress,
}: ImportPreviewModalProps) {
  const [showErrors, setShowErrors] = useState(false);
  
  const { transactions, totalRows, expenses, income, errors } = parseResult;
  
  // Filter transactions based on options for preview
  const previewTransactions = onlyExpenses 
    ? transactions.filter(t => t.isExpense)
    : transactions;
  
  const formatAmount = (amount: number, isExpense: boolean) => {
    const formatted = new Intl.NumberFormat('de-AT', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
    return isExpense ? `-${formatted.replace('€', '€ ')}` : `+${formatted.replace('€', '€ ')}`;
  };
  
  const truncateText = (text: string, maxLength: number = 40) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Import-Vorschau
          </DialogTitle>
        </DialogHeader>
        
        {/* Statistics Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            {totalRows} Buchungen gefunden
          </Badge>
          <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {expenses} Ausgaben
          </Badge>
          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            {income} Einnahmen
            {onlyExpenses && <span className="ml-1 opacity-70">(ignoriert)</span>}
          </Badge>
          {skipDuplicates && duplicateCount > 0 && (
            <Badge variant="secondary" className="bg-muted text-muted-foreground">
              {duplicateCount} Duplikate (übersprungen)
            </Badge>
          )}
        </div>
        
        {/* Preview Table */}
        <div className="border rounded-lg overflow-hidden">
          <ScrollArea className="h-[280px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-3 font-medium">Datum</th>
                  <th className="text-left p-3 font-medium">Beschreibung</th>
                  <th className="text-right p-3 font-medium">Betrag</th>
                </tr>
              </thead>
              <tbody>
                {previewTransactions.slice(0, 10).map((transaction, index) => (
                  <tr key={index} className="border-t border-border">
                    <td className="p-3 whitespace-nowrap">
                      {format(transaction.date, 'dd.MM.yyyy', { locale: de })}
                    </td>
                    <td className="p-3">
                      <span title={transaction.description}>
                        {truncateText(transaction.description)}
                      </span>
                    </td>
                    <td className={cn(
                      'p-3 text-right font-mono whitespace-nowrap',
                      transaction.isExpense ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                    )}>
                      {formatAmount(transaction.amount, transaction.isExpense)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </div>
        
        {previewTransactions.length > 10 && (
          <p className="text-sm text-muted-foreground text-center">
            Zeige 10 von {previewTransactions.length} Buchungen
          </p>
        )}
        
        {/* Errors Section */}
        {errors.length > 0 && (
          <Collapsible open={showErrors} onOpenChange={setShowErrors}>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{errors.length} Zeilen konnten nicht gelesen werden</span>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent">
                    {showErrors ? (
                      <ChevronUp className="h-4 w-4 ml-2" />
                    ) : (
                      <ChevronDown className="h-4 w-4 ml-2" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              </AlertDescription>
            </Alert>
            <CollapsibleContent>
              <div className="mt-2 p-3 bg-destructive/10 rounded-lg text-sm space-y-1 max-h-32 overflow-y-auto">
                {errors.map((error, index) => (
                  <p key={index} className="text-destructive">{error}</p>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
        
        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            disabled={isImporting}
          >
            Abbrechen
          </Button>
          <Button 
            onClick={onConfirmImport}
            disabled={isImporting || previewTransactions.length === 0}
          >
            {isImporting ? (
              <>
                <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                {importProgress 
                  ? `Importiere ${importProgress.current}/${importProgress.total}...`
                  : 'Importiere...'}
              </>
            ) : (
              `${previewTransactions.length} Buchungen importieren`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
