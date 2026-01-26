import { useState } from 'react';
import { Search, Upload, FileText, Calendar, Building2 } from 'lucide-react';
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
import { cn } from '@/lib/utils';

interface BankTransaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
}

interface Receipt {
  id: string;
  date: Date;
  vendor: string;
  amount: number;
  thumbnail?: string;
}

interface ReceiptAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: BankTransaction | null;
  onAssign: (transactionId: string, receiptId: string) => void;
  onUploadNew: () => void;
}

// Mock receipts for demonstration
const mockReceipts: Receipt[] = [
  { id: '1', date: new Date('2025-01-15'), vendor: 'Amazon', amount: 47.99 },
  { id: '2', date: new Date('2025-01-14'), vendor: 'MediaMarkt', amount: 299.00 },
  { id: '3', date: new Date('2025-01-12'), vendor: 'IKEA', amount: 156.80 },
  { id: '4', date: new Date('2025-01-10'), vendor: 'Bauhaus', amount: 89.50 },
  { id: '5', date: new Date('2025-01-08'), vendor: 'Office Depot', amount: 234.00 },
];

export function ReceiptAssignmentModal({
  open,
  onOpenChange,
  transaction,
  onAssign,
  onUploadNew,
}: ReceiptAssignmentModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);

  if (!transaction) return null;

  // Filter receipts by search and similar amount (±10%)
  const filteredReceipts = mockReceipts.filter((receipt) => {
    const matchesSearch = receipt.vendor.toLowerCase().includes(searchQuery.toLowerCase());
    const amountDiff = Math.abs(receipt.amount - Math.abs(transaction.amount));
    const withinRange = amountDiff <= Math.abs(transaction.amount) * 0.1;
    return matchesSearch && withinRange;
  });

  const handleAssign = () => {
    if (selectedReceipt) {
      onAssign(transaction.id, selectedReceipt);
      setSelectedReceipt(null);
      setSearchQuery('');
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setSelectedReceipt(null);
    setSearchQuery('');
    onOpenChange(false);
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
        <div className="flex-1 overflow-y-auto min-h-[200px] space-y-2">
          {filteredReceipts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Keine passenden Belege gefunden</p>
              <p className="text-sm">Versuche einen anderen Suchbegriff oder lade einen neuen Beleg hoch</p>
            </div>
          ) : (
            <RadioGroup value={selectedReceipt || ''} onValueChange={setSelectedReceipt}>
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
                      {receipt.vendor}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {format(receipt.date, 'dd.MM.yyyy', { locale: de })}
                    </p>
                  </div>
                  <div className="font-semibold">
                    {new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(receipt.amount)}
                  </div>
                </div>
              ))}
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
            disabled={!selectedReceipt}
            className="sm:order-3"
          >
            Zuordnen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
