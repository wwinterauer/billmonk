import { useState } from 'react';
import { Search, Upload, FileText, Calendar, Building2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
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
}

interface ReceiptAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: BankTransaction | null;
  onAssign: (transactionId: string, receiptId: string) => void;
  onUploadNew: () => void;
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

  // Fetch unassigned receipts
  const { data: receipts, isLoading } = useQuery({
    queryKey: ['unassigned-receipts', transaction?.amount],
    queryFn: async () => {
      if (!user?.id || !transaction) return [];

      const { data, error } = await supabase
        .from('receipts')
        .select('id, receipt_date, vendor, amount_gross, file_url')
        .eq('user_id', user.id)
        .is('bank_transaction_id', null)
        .order('receipt_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Receipt[];
    },
    enabled: open && !!user?.id && !!transaction,
  });

  if (!transaction) return null;

  // Filter receipts by search and similar amount (±10%)
  const filteredReceipts = (receipts || []).filter((receipt) => {
    // Search filter
    const matchesSearch = !searchQuery || 
      (receipt.vendor?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Amount filter - within 10%
    if (receipt.amount_gross === null) return matchesSearch;
    
    const amountDiff = Math.abs(receipt.amount_gross - Math.abs(transaction.amount));
    const withinRange = amountDiff <= Math.abs(transaction.amount) * 0.1;
    
    return matchesSearch && withinRange;
  });

  // Also show all receipts that don't match the amount criteria
  const otherReceipts = (receipts || []).filter((receipt) => {
    const matchesSearch = !searchQuery || 
      (receipt.vendor?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (receipt.amount_gross === null) return false;
    
    const amountDiff = Math.abs(receipt.amount_gross - Math.abs(transaction.amount));
    const withinRange = amountDiff <= Math.abs(transaction.amount) * 0.1;
    
    return matchesSearch && !withinRange;
  });

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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Beleg zu Buchung zuordnen</DialogTitle>
        </DialogHeader>

        {/* Transaction Info */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{format(transaction.date, 'dd. MMMM yyyy', { locale: de })}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{transaction.description}</span>
          </div>
          <div className="text-lg font-bold text-destructive">
            {new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(transaction.amount)}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Beleg suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Receipt List */}
        <div className="flex-1 overflow-y-auto min-h-[200px] space-y-4">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                  <Skeleton className="h-12 w-12 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : filteredReceipts.length === 0 && otherReceipts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Keine passenden Belege gefunden</p>
              <p className="text-sm">Versuche einen anderen Suchbegriff oder lade einen neuen Beleg hoch</p>
            </div>
          ) : (
            <RadioGroup value={selectedReceipt || ''} onValueChange={setSelectedReceipt}>
              {/* Matching receipts */}
              {filteredReceipts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Vorgeschlagen (±10% Betrag)
                  </p>
                  {filteredReceipts.map((receipt) => (
                    <div
                      key={receipt.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                        selectedReceipt === receipt.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      )}
                      onClick={() => setSelectedReceipt(receipt.id)}
                    >
                      <RadioGroupItem value={receipt.id} id={receipt.id} />
                      <div className="h-12 w-12 bg-muted rounded flex items-center justify-center flex-shrink-0">
                        <FileText className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Label htmlFor={receipt.id} className="font-medium cursor-pointer">
                          {receipt.vendor || 'Unbekannter Lieferant'}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {receipt.receipt_date 
                            ? format(new Date(receipt.receipt_date), 'dd.MM.yyyy', { locale: de })
                            : 'Kein Datum'}
                        </p>
                      </div>
                      <div className="font-semibold">
                        {formatAmount(receipt.amount_gross)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Other receipts */}
              {otherReceipts.length > 0 && (
                <div className="space-y-2 mt-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Weitere Belege
                  </p>
                  {otherReceipts.slice(0, 10).map((receipt) => (
                    <div
                      key={receipt.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                        selectedReceipt === receipt.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      )}
                      onClick={() => setSelectedReceipt(receipt.id)}
                    >
                      <RadioGroupItem value={receipt.id} id={receipt.id} />
                      <div className="h-12 w-12 bg-muted rounded flex items-center justify-center flex-shrink-0">
                        <FileText className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Label htmlFor={receipt.id} className="font-medium cursor-pointer">
                          {receipt.vendor || 'Unbekannter Lieferant'}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {receipt.receipt_date 
                            ? format(new Date(receipt.receipt_date), 'dd.MM.yyyy', { locale: de })
                            : 'Kein Datum'}
                        </p>
                      </div>
                      <div className="font-semibold text-muted-foreground">
                        {formatAmount(receipt.amount_gross)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </RadioGroup>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={handleClose} className="sm:order-1">
            Abbrechen
          </Button>
          <Button variant="secondary" onClick={onUploadNew} className="sm:order-2">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
