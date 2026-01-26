import { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Upload, 
  FileText, 
  Calendar, 
  Building2, 
  Loader2,
  ImageIcon,
  Percent
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';

interface BankTransaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
}

interface Receipt {
  id: string;
  receipt_date: string | null;
  vendor: string | null;
  amount_gross: number | null;
  file_url: string | null;
  category: string | null;
  bank_transaction_id: string | null;
}

interface ReceiptWithScore extends Receipt {
  matchScore: number;
  amountDiff: number;
  dateDiff: number | null;
}

interface ReceiptAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: BankTransaction | null;
  onAssign: (transactionId: string, receiptId: string) => void;
  onUploadNew: () => void;
}

// Calculate match score between transaction and receipt
function calculateMatchScore(
  transactionAmount: number,
  transactionDate: Date,
  receiptAmount: number | null,
  receiptDate: string | null
): { score: number; amountDiff: number; dateDiff: number | null } {
  let score = 0;
  const absTransactionAmount = Math.abs(transactionAmount);
  const amountDiff = receiptAmount !== null 
    ? Math.abs(absTransactionAmount - receiptAmount) / absTransactionAmount * 100
    : 100;
  
  // Amount matching (up to 70 points)
  if (receiptAmount !== null) {
    if (amountDiff < 1) {
      score += 70;
    } else if (amountDiff < 5) {
      score += 56;
    } else if (amountDiff < 10) {
      score += 42;
    } else if (amountDiff < 20) {
      score += 28;
    } else if (amountDiff < 50) {
      score += 14;
    }
  }
  
  // Date matching (up to 30 points)
  let dateDiff: number | null = null;
  if (receiptDate) {
    dateDiff = Math.abs(differenceInDays(transactionDate, new Date(receiptDate)));
    if (dateDiff === 0) {
      score += 30;
    } else if (dateDiff <= 3) {
      score += 24;
    } else if (dateDiff <= 7) {
      score += 18;
    } else if (dateDiff <= 14) {
      score += 12;
    } else if (dateDiff <= 30) {
      score += 6;
    }
  }
  
  return { score, amountDiff, dateDiff };
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function ReceiptAssignmentModal({
  open,
  onOpenChange,
  transaction,
  onAssign,
  onUploadNew,
}: ReceiptAssignmentModalProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  
  // Filter toggles
  const [filterSimilarAmount, setFilterSimilarAmount] = useState(true);
  const [filterSimilarDate, setFilterSimilarDate] = useState(false);
  const [filterUnassigned, setFilterUnassigned] = useState(true);
  
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSelectedReceipt(null);
      setSearchQuery('');
    }
  }, [open]);

  // Fetch receipts
  const { data: receipts, isLoading } = useQuery({
    queryKey: ['receipts-for-matching', debouncedSearch, filterUnassigned],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('receipts')
        .select('id, receipt_date, vendor, amount_gross, file_url, category, bank_transaction_id')
        .eq('user_id', user.id)
        .order('receipt_date', { ascending: false })
        .limit(100);

      // Only unassigned
      if (filterUnassigned) {
        query = query.is('bank_transaction_id', null);
      }

      // Search filter
      if (debouncedSearch) {
        query = query.or(`vendor.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Receipt[];
    },
    enabled: open && !!user?.id,
  });

  // Calculate scores and filter/sort receipts
  const scoredReceipts = useMemo(() => {
    if (!receipts || !transaction) return [];
    
    const scored: ReceiptWithScore[] = receipts.map(receipt => {
      const { score, amountDiff, dateDiff } = calculateMatchScore(
        transaction.amount,
        transaction.date,
        receipt.amount_gross,
        receipt.receipt_date
      );
      return { ...receipt, matchScore: score, amountDiff, dateDiff };
    });
    
    // Apply filters
    let filtered = scored;
    
    if (filterSimilarAmount) {
      filtered = filtered.filter(r => r.amountDiff <= 10);
    }
    
    if (filterSimilarDate) {
      filtered = filtered.filter(r => r.dateDiff !== null && r.dateDiff <= 7);
    }
    
    // Sort by match score descending
    filtered.sort((a, b) => b.matchScore - a.matchScore);
    
    return filtered.slice(0, 10);
  }, [receipts, transaction, filterSimilarAmount, filterSimilarDate]);

  // Get remaining receipts (not matching filters)
  const otherReceipts = useMemo(() => {
    if (!receipts || !transaction || (!filterSimilarAmount && !filterSimilarDate)) return [];
    
    const scored: ReceiptWithScore[] = receipts.map(receipt => {
      const { score, amountDiff, dateDiff } = calculateMatchScore(
        transaction.amount,
        transaction.date,
        receipt.amount_gross,
        receipt.receipt_date
      );
      return { ...receipt, matchScore: score, amountDiff, dateDiff };
    });
    
    // Get receipts NOT matching the active filters
    let others = scored.filter(r => {
      const matchesAmountFilter = !filterSimilarAmount || r.amountDiff <= 10;
      const matchesDateFilter = !filterSimilarDate || (r.dateDiff !== null && r.dateDiff <= 7);
      return !(matchesAmountFilter && matchesDateFilter);
    });
    
    // Sort by match score
    others.sort((a, b) => b.matchScore - a.matchScore);
    
    return others.slice(0, 5);
  }, [receipts, transaction, filterSimilarAmount, filterSimilarDate]);

  if (!transaction) return null;

  const handleAssign = async () => {
    if (selectedReceipt) {
      setIsAssigning(true);
      try {
        await onAssign(transaction.id, selectedReceipt);
      } finally {
        setIsAssigning(false);
        setSelectedReceipt(null);
        setSearchQuery('');
      }
    }
  };

  const handleClose = () => {
    setSelectedReceipt(null);
    setSearchQuery('');
    onOpenChange(false);
  };

  const formatAmount = (amount: number | null) => {
    if (amount === null) return '–';
    return new Intl.NumberFormat('de-AT', { 
      style: 'currency', 
      currency: 'EUR' 
    }).format(amount);
  };

  const getMatchBadge = (score: number) => {
    if (score >= 80) {
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">
          {score}% Match
        </Badge>
      );
    } else if (score >= 50) {
      return (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">
          {score}% Match
        </Badge>
      );
    }
    return null;
  };

  const ReceiptCard = ({ receipt, showScore = true }: { receipt: ReceiptWithScore; showScore?: boolean }) => (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
        selectedReceipt === receipt.id
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'border-border hover:border-primary/50 hover:bg-muted/30'
      )}
      onClick={() => setSelectedReceipt(receipt.id)}
    >
      <RadioGroupItem value={receipt.id} id={receipt.id} className="sr-only" />
      
      {/* Thumbnail */}
      <div className="h-14 w-14 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
        {receipt.file_url ? (
          receipt.file_url.toLowerCase().endsWith('.pdf') ? (
            <FileText className="h-7 w-7 text-red-500" />
          ) : (
            <ImageIcon className="h-7 w-7 text-muted-foreground" />
          )
        ) : (
          <FileText className="h-7 w-7 text-muted-foreground" />
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <Label htmlFor={receipt.id} className="font-medium cursor-pointer block truncate">
          {receipt.vendor || 'Unbekannter Lieferant'}
        </Label>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {receipt.receipt_date 
              ? format(new Date(receipt.receipt_date), 'dd.MM.yyyy', { locale: de })
              : 'Kein Datum'}
          </span>
          {receipt.category && (
            <>
              <span>•</span>
              <span className="truncate">{receipt.category}</span>
            </>
          )}
        </div>
      </div>
      
      {/* Amount & Match Score */}
      <div className="text-right flex-shrink-0">
        <p className="font-semibold tabular-nums">
          {formatAmount(receipt.amount_gross)}
        </p>
        {showScore && getMatchBadge(receipt.matchScore)}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Beleg zuordnen</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col px-6">
          {/* Transaction Info Card */}
          <div className="bg-muted/50 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{format(transaction.date, 'dd. MMMM yyyy', { locale: de })}</span>
                </div>
                <p className="font-medium truncate">{transaction.description}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={cn(
                  'text-2xl font-bold tabular-nums',
                  transaction.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                )}>
                  {formatAmount(transaction.amount)}
                </p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Lieferant, Beschreibung..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              variant={filterSimilarAmount ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterSimilarAmount(!filterSimilarAmount)}
              className="h-8"
            >
              <Percent className="h-3.5 w-3.5 mr-1.5" />
              Ähnlicher Betrag (±10%)
            </Button>
            <Button
              variant={filterSimilarDate ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterSimilarDate(!filterSimilarDate)}
              className="h-8"
            >
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              Ähnliches Datum (±7 Tage)
            </Button>
            <Button
              variant={filterUnassigned ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterUnassigned(!filterUnassigned)}
              className="h-8"
            >
              Nur ohne Zuordnung
            </Button>
          </div>

          {/* Receipt List */}
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 pb-4">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                      <Skeleton className="h-14 w-14 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <div className="text-right space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-5 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : scoredReceipts.length === 0 && otherReceipts.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="font-medium text-foreground">Keine passenden Belege gefunden</p>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    {filterSimilarAmount || filterSimilarDate 
                      ? 'Versuche die Filter anzupassen oder lade einen neuen Beleg hoch'
                      : 'Lade einen neuen Beleg hoch, um ihn zuzuordnen'}
                  </p>
                  <Button variant="outline" onClick={onUploadNew}>
                    <Upload className="mr-2 h-4 w-4" />
                    Neuen Beleg hochladen
                  </Button>
                </div>
              ) : (
                <RadioGroup value={selectedReceipt || ''} onValueChange={setSelectedReceipt}>
                  {/* Matching receipts */}
                  {scoredReceipts.length > 0 && (
                    <div className="space-y-2">
                      {(filterSimilarAmount || filterSimilarDate) && (
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Vorgeschlagene Belege
                        </p>
                      )}
                      {scoredReceipts.map((receipt) => (
                        <ReceiptCard key={receipt.id} receipt={receipt} />
                      ))}
                    </div>
                  )}

                  {/* Other receipts */}
                  {otherReceipts.length > 0 && (
                    <div className="space-y-2 mt-6">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Weitere Belege
                      </p>
                      {otherReceipts.map((receipt) => (
                        <ReceiptCard key={receipt.id} receipt={receipt} showScore={false} />
                      ))}
                    </div>
                  )}
                </RadioGroup>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/30">
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="ghost" onClick={handleClose} className="sm:order-1">
              Abbrechen
            </Button>
            <Button variant="outline" onClick={onUploadNew} className="sm:order-2">
              <Upload className="mr-2 h-4 w-4" />
              Neuen Beleg hochladen
            </Button>
            <Button 
              onClick={handleAssign} 
              disabled={!selectedReceipt || isAssigning}
              className="sm:order-3"
            >
              {isAssigning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Zuordne...
                </>
              ) : (
                'Zuordnen'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
