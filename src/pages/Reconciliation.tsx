import { useState, useEffect } from 'react';
import { FeatureGate } from '@/components/FeatureGate';
import { motion } from 'framer-motion';
import { 
  AlertTriangle, 
  Eye, 
  X,
  Link as LinkIcon,
  FileText,
  FileSpreadsheet,
  CheckCircle,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  RotateCcw
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ReceiptAssignmentModal } from '@/components/bank-import/ReceiptAssignmentModal';
import { ReceiptDetailPanel } from '@/components/receipts/ReceiptDetailPanel';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

type StatusFilter = 'all' | 'unmatched' | 'matched' | 'ignored';
type SortField = 'transaction_date' | 'amount';
type SortOrder = 'asc' | 'desc';

interface BankTransaction {
  id: string;
  transaction_date: string | null;
  description: string | null;
  amount: number | null;
  status: string | null;
  receipt_id: string | null;
  receipt?: {
    id: string;
    vendor: string | null;
    amount_gross: number | null;
  } | null;
}

const ITEMS_PER_PAGE = 20;

export default function Reconciliation() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('unmatched');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  
  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('transaction_date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  // Modals
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [showReceiptPanel, setShowReceiptPanel] = useState(false);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery, dateFrom, dateTo]);

  // Fetch transactions
  const { data: transactionsData, isLoading } = useQuery({
    queryKey: ['bank-transactions', statusFilter, searchQuery, dateFrom, dateTo, currentPage, sortField, sortOrder],
    queryFn: async () => {
      if (!user?.id) return { transactions: [], total: 0 };

      let query = supabase
        .from('bank_transactions')
        .select(`
          id,
          transaction_date,
          description,
          amount,
          status,
          receipt_id,
          receipts:receipt_id (
            id,
            vendor,
            amount_gross
          )
        `, { count: 'exact' })
        .eq('user_id', user.id);

      // Status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      // Search filter
      if (searchQuery) {
        query = query.ilike('description', `%${searchQuery}%`);
      }

      // Date filters
      if (dateFrom) {
        query = query.gte('transaction_date', format(dateFrom, 'yyyy-MM-dd'));
      }
      if (dateTo) {
        query = query.lte('transaction_date', format(dateTo, 'yyyy-MM-dd'));
      }

      // Sorting
      query = query.order(sortField, { ascending: sortOrder === 'asc' });

      // Pagination
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      // Transform data to match our interface
      const transactions = (data || []).map((t: any) => ({
        ...t,
        receipt: t.receipts,
      }));

      return { transactions, total: count || 0 };
    },
    enabled: !!user?.id,
  });

  // Fetch unmatched count for badge
  const { data: unmatchedCount } = useQuery({
    queryKey: ['bank-transactions-unmatched-count'],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count } = await supabase
        .from('bank_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'unmatched');
      return count || 0;
    },
    enabled: !!user?.id,
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ transactionId, status }: { transactionId: string; status: string }) => {
      const updates: any = { status };
      
      // Clear receipt_id when unmatching
      if (status === 'unmatched') {
        updates.receipt_id = null;
      }

      const { error } = await supabase
        .from('bank_transactions')
        .update(updates)
        .eq('id', transactionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['bank-transactions-unmatched-count'] });
    },
  });

  const transactions = transactionsData?.transactions || [];
  const totalItems = transactionsData?.total || 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  const handleAssignClick = (transaction: BankTransaction) => {
    setSelectedTransaction(transaction);
    setShowAssignModal(true);
  };

  const handleAssign = async (transactionId: string, receiptId: string) => {
    try {
      // Update transaction
      const { error: txError } = await supabase
        .from('bank_transactions')
        .update({ 
          status: 'matched',
          receipt_id: receiptId 
        })
        .eq('id', transactionId);

      if (txError) throw txError;

      // Update receipt
      const { error: rcptError } = await supabase
        .from('receipts')
        .update({ bank_transaction_id: transactionId })
        .eq('id', receiptId);

      if (rcptError) throw rcptError;

      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['bank-transactions-unmatched-count'] });
      
      toast({
        title: 'Beleg zugeordnet',
        description: 'Die Buchung wurde erfolgreich mit dem Beleg verknüpft.',
      });
      
      setShowAssignModal(false);
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Die Zuordnung konnte nicht gespeichert werden.',
        variant: 'destructive',
      });
    }
  };

  const handleIgnore = async (transactionId: string) => {
    try {
      await updateStatusMutation.mutateAsync({ transactionId, status: 'ignored' });
      toast({
        title: 'Buchung ignoriert',
        description: 'Die Buchung wird nicht mehr für den Abgleich berücksichtigt.',
      });
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Status konnte nicht aktualisiert werden.',
        variant: 'destructive',
      });
    }
  };

  const handleRestore = async (transactionId: string) => {
    try {
      await updateStatusMutation.mutateAsync({ transactionId, status: 'unmatched' });
      toast({
        title: 'Buchung wiederhergestellt',
        description: 'Die Buchung ist wieder für den Abgleich verfügbar.',
      });
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Status konnte nicht aktualisiert werden.',
        variant: 'destructive',
      });
    }
  };

  const handleUnmatch = async (transactionId: string, receiptId: string | null) => {
    try {
      // Clear receipt link
      if (receiptId) {
        await supabase
          .from('receipts')
          .update({ bank_transaction_id: null })
          .eq('id', receiptId);
      }

      await updateStatusMutation.mutateAsync({ transactionId, status: 'unmatched' });
      
      toast({
        title: 'Zuordnung aufgehoben',
        description: 'Die Verknüpfung wurde entfernt.',
      });
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Die Zuordnung konnte nicht aufgehoben werden.',
        variant: 'destructive',
      });
    }
  };

  const handleViewReceipt = (receiptId: string) => {
    setSelectedReceiptId(receiptId);
    setShowReceiptPanel(true);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'matched':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">Zugeordnet</Badge>;
      case 'unmatched':
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">Offen</Badge>;
      case 'ignored':
        return <Badge variant="secondary">Ignoriert</Badge>;
      default:
        return <Badge variant="secondary">Unbekannt</Badge>;
    }
  };

  const truncateText = (text: string | null, maxLength: number = 50) => {
    if (!text) return '–';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const formatAmount = (amount: number | null) => {
    if (amount === null) return '–';
    return new Intl.NumberFormat('de-AT', { 
      style: 'currency', 
      currency: 'EUR' 
    }).format(amount);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-start justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold text-foreground">Kontoabgleich</h1>
            <p className="text-muted-foreground mt-1">
              Ordne Bankbuchungen deinen Belegen zu
            </p>
          </div>
          {unmatchedCount !== undefined && unmatchedCount > 0 && (
            <Badge variant="secondary" className="text-base px-3 py-1">
              {unmatchedCount} offen
            </Badge>
          )}
        </motion.div>

        {/* Filter Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-center">
                {/* Status Tabs */}
                <div className="flex gap-1 bg-muted p-1 rounded-lg">
                  {[
                    { value: 'all', label: 'Alle' },
                    { value: 'unmatched', label: 'Offen' },
                    { value: 'matched', label: 'Zugeordnet' },
                    { value: 'ignored', label: 'Ignoriert' },
                  ].map((tab) => (
                    <Button
                      key={tab.value}
                      variant={statusFilter === tab.value ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setStatusFilter(tab.value as StatusFilter)}
                      className={cn(
                        'px-3',
                        statusFilter === tab.value ? '' : 'hover:bg-background'
                      )}
                    >
                      {tab.label}
                    </Button>
                  ))}
                </div>

                {/* Date Range */}
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          'w-[130px] justify-start text-left font-normal',
                          !dateFrom && 'text-muted-foreground'
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, 'dd.MM.yyyy') : 'Von'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="text-muted-foreground">–</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          'w-[130px] justify-start text-left font-normal',
                          !dateTo && 'text-muted-foreground'
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, 'dd.MM.yyyy') : 'Bis'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Suche in Beschreibung..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Warning Banner */}
        {unmatchedCount !== undefined && unmatchedCount > 0 && statusFilter !== 'unmatched' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <span className="font-medium text-amber-800 dark:text-amber-300">
                  {unmatchedCount} Bankbuchungen warten auf Zuordnung
                </span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    size="sm" 
                    variant="outline"
                    disabled
                    className="opacity-50"
                  >
                    Automatisch matchen
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Kommt bald</p>
                </TooltipContent>
              </Tooltip>
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
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-5 flex-1" />
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-5 w-32" />
                    </div>
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  {statusFilter === 'unmatched' && totalItems === 0 ? (
                    <>
                      <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                      <h3 className="text-lg font-medium">Alle Buchungen sind zugeordnet! 🎉</h3>
                      <p className="text-muted-foreground mt-1">
                        Keine offenen Buchungen vorhanden.
                      </p>
                    </>
                  ) : totalItems === 0 ? (
                    <>
                      <FileSpreadsheet className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-medium">Noch keine Bankbuchungen importiert</h3>
                      <p className="text-muted-foreground mt-1 mb-4">
                        Importiere einen Kontoauszug, um Buchungen mit Belegen abzugleichen.
                      </p>
                      <Button onClick={() => navigate('/bank-import')}>
                        Kontoauszug importieren
                      </Button>
                    </>
                  ) : (
                    <>
                      <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-medium">Keine Ergebnisse</h3>
                      <p className="text-muted-foreground mt-1">
                        Keine Buchungen entsprechen deinen Filterkriterien.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('transaction_date')}
                        >
                          <div className="flex items-center gap-1">
                            Datum
                            {sortField === 'transaction_date' && (
                              <ArrowUpDown className="h-3 w-3" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead>Beschreibung</TableHead>
                        <TableHead 
                          className="text-right cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('amount')}
                        >
                          <div className="flex items-center justify-end gap-1">
                            Betrag
                            {sortField === 'amount' && (
                              <ArrowUpDown className="h-3 w-3" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Zugeordneter Beleg</TableHead>
                        <TableHead className="text-right">Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell className="font-medium whitespace-nowrap">
                            {transaction.transaction_date 
                              ? format(new Date(transaction.transaction_date), 'dd.MM.yyyy', { locale: de })
                              : '–'}
                          </TableCell>
                          <TableCell>
                            <span title={transaction.description || ''}>
                              {truncateText(transaction.description)}
                            </span>
                          </TableCell>
                          <TableCell className={cn(
                            'text-right font-mono whitespace-nowrap',
                            transaction.amount && transaction.amount < 0 
                              ? 'text-red-600 dark:text-red-400' 
                              : 'text-green-600 dark:text-green-400'
                          )}>
                            {formatAmount(transaction.amount)}
                          </TableCell>
                          <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                          <TableCell>
                            {transaction.status === 'matched' && transaction.receipt ? (
                              <div className="flex items-center gap-2 text-sm">
                                <LinkIcon className="h-3 w-3 text-muted-foreground" />
                                <span>{transaction.receipt.vendor || 'Beleg'}</span>
                                <span className="text-muted-foreground">
                                  ({formatAmount(transaction.receipt.amount_gross)})
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">–</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {transaction.status === 'unmatched' && (
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
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => transaction.receipt && handleViewReceipt(transaction.receipt.id)}
                                >
                                  <Eye className="mr-1 h-3 w-3" />
                                  Anzeigen
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUnmatch(transaction.id, transaction.receipt_id)}
                                  className="text-muted-foreground"
                                >
                                  Trennen
                                </Button>
                              </div>
                            )}
                            {transaction.status === 'ignored' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRestore(transaction.id)}
                                className="text-muted-foreground"
                              >
                                <RotateCcw className="mr-1 h-3 w-3" />
                                Wiederherstellen
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Zeige {(currentPage - 1) * ITEMS_PER_PAGE + 1} bis{' '}
                        {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} von {totalItems}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => p - 1)}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm px-2">
                          Seite {currentPage} von {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => p + 1)}
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Receipt Assignment Modal */}
      <ReceiptAssignmentModal
        open={showAssignModal}
        onOpenChange={setShowAssignModal}
        transaction={selectedTransaction ? {
          id: selectedTransaction.id,
          date: selectedTransaction.transaction_date ? new Date(selectedTransaction.transaction_date) : new Date(),
          description: selectedTransaction.description || '',
          amount: selectedTransaction.amount || 0,
        } : null}
        onAssign={handleAssign}
        onUploadNew={() => {
          setShowAssignModal(false);
          navigate('/upload');
        }}
      />

      {/* Receipt Detail Panel */}
      <ReceiptDetailPanel
        receiptId={selectedReceiptId}
        open={showReceiptPanel}
        onClose={() => setShowReceiptPanel(false)}
        onUpdate={() => {
          queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
        }}
      />
    </DashboardLayout>
  );
}
