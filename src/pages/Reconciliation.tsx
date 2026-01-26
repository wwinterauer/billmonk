import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  AlertTriangle, 
  ArrowRight, 
  Check, 
  Eye, 
  X,
  Link as LinkIcon,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ReceiptAssignmentModal } from '@/components/bank-import/ReceiptAssignmentModal';
import { cn } from '@/lib/utils';

interface BankTransaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  status: 'matched' | 'open' | 'ignored';
  receiptId?: string;
  receiptVendor?: string;
}

// Mock data for demonstration
const mockTransactions: BankTransaction[] = [
  { id: '1', date: new Date('2025-01-20'), description: 'Amazon Marketplace', amount: -47.99, status: 'matched', receiptId: 'r1', receiptVendor: 'Amazon' },
  { id: '2', date: new Date('2025-01-19'), description: 'MediaMarkt Wien', amount: -299.00, status: 'open' },
  { id: '3', date: new Date('2025-01-18'), description: 'IKEA Vösendorf', amount: -156.80, status: 'matched', receiptId: 'r2', receiptVendor: 'IKEA' },
  { id: '4', date: new Date('2025-01-17'), description: 'Bauhaus Wien 21', amount: -89.50, status: 'open' },
  { id: '5', date: new Date('2025-01-16'), description: 'REWE Supermarkt', amount: -34.20, status: 'ignored' },
  { id: '6', date: new Date('2025-01-15'), description: 'A1 Telekom Austria', amount: -39.90, status: 'open' },
  { id: '7', date: new Date('2025-01-14'), description: 'Hofer KG', amount: -67.80, status: 'open' },
  { id: '8', date: new Date('2025-01-13'), description: 'ÖBB Ticket', amount: -24.00, status: 'matched', receiptId: 'r3', receiptVendor: 'ÖBB' },
  { id: '9', date: new Date('2025-01-12'), description: 'Shell Tankstelle', amount: -72.50, status: 'open' },
  { id: '10', date: new Date('2025-01-11'), description: 'Spotify AB', amount: -9.99, status: 'ignored' },
];

export default function Reconciliation() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<BankTransaction[]>(mockTransactions);
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const openTransactionsCount = transactions.filter(t => t.status === 'open').length;

  const handleAssignClick = (transaction: BankTransaction) => {
    setSelectedTransaction(transaction);
    setShowAssignModal(true);
  };

  const handleAssign = (transactionId: string, receiptId: string) => {
    setTransactions(prev => 
      prev.map(t => 
        t.id === transactionId 
          ? { ...t, status: 'matched' as const, receiptId, receiptVendor: 'Zugeordneter Beleg' }
          : t
      )
    );
    toast({
      title: 'Beleg zugeordnet',
      description: 'Die Buchung wurde erfolgreich mit dem Beleg verknüpft.',
    });
  };

  const handleIgnore = (transactionId: string) => {
    setTransactions(prev => 
      prev.map(t => 
        t.id === transactionId 
          ? { ...t, status: 'ignored' as const }
          : t
      )
    );
    toast({
      title: 'Buchung ignoriert',
      description: 'Die Buchung wird nicht mehr für den Abgleich berücksichtigt.',
    });
  };

  const handleUploadNew = () => {
    setShowAssignModal(false);
    navigate('/upload');
  };

  const getStatusBadge = (status: BankTransaction['status']) => {
    switch (status) {
      case 'matched':
        return <Badge className="bg-success/10 text-success border-success/20">Zugeordnet</Badge>;
      case 'open':
        return <Badge className="bg-warning/10 text-warning border-warning/20">Offen</Badge>;
      case 'ignored':
        return <Badge variant="secondary">Ignoriert</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-2xl font-bold text-foreground">Kontoabgleich</h1>
          <p className="text-muted-foreground mt-1">
            Ordne Bankbuchungen deinen Belegen zu
          </p>
        </motion.div>

        {/* Warning Banner */}
        {openTransactionsCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <span className="font-medium text-warning">
                  {openTransactionsCount} Bankbuchungen warten auf Zuordnung
                </span>
              </div>
              <Button 
                size="sm" 
                className="bg-warning hover:bg-warning/90 text-warning-foreground"
              >
                Jetzt abgleichen
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Transactions Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Importierte Bankbuchungen</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Beschreibung</TableHead>
                    <TableHead className="text-right">Betrag</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium">
                        {format(transaction.date, 'dd.MM.yyyy', { locale: de })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{transaction.description}</p>
                          {transaction.status === 'matched' && transaction.receiptVendor && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                              <LinkIcon className="h-3 w-3" />
                              {transaction.receiptVendor}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-destructive">
                        {new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(transaction.amount)}
                      </TableCell>
                      <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                      <TableCell className="text-right">
                        {transaction.status === 'open' && (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAssignClick(transaction)}
                            >
                              <FileText className="mr-1 h-3 w-3" />
                              Beleg zuordnen
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleIgnore(transaction.id)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        {transaction.status === 'matched' && (
                          <Button variant="ghost" size="sm">
                            <Eye className="mr-1 h-3 w-3" />
                            Anzeigen
                          </Button>
                        )}
                        {transaction.status === 'ignored' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setTransactions(prev => 
                              prev.map(t => t.id === transaction.id ? { ...t, status: 'open' as const } : t)
                            )}
                            className="text-muted-foreground"
                          >
                            <Check className="mr-1 h-3 w-3" />
                            Wiederherstellen
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Receipt Assignment Modal */}
      <ReceiptAssignmentModal
        open={showAssignModal}
        onOpenChange={setShowAssignModal}
        transaction={selectedTransaction}
        onAssign={handleAssign}
        onUploadNew={handleUploadNew}
      />
    </DashboardLayout>
  );
}
