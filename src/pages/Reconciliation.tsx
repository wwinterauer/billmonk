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
  RotateCcw,
  Wallet,
  Receipt,
  FileWarning,
  Clock
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import { usePlan } from '@/hooks/usePlan';

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
  is_expense?: boolean | null;
  source?: string;
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
  const { features } = usePlan();
  
  // Main tab
  const [activeTab, setActiveTab] = useState('transactions');
  
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

  // ===== KPI Queries =====
  
  // Open invoices (sent/overdue, not paid)
  const { data: openInvoicesData } = useQuery({
    queryKey: ['kpi-open-invoices'],
    queryFn: async () => {
      if (!user?.id) return { count: 0, total: 0 };
      const { data, error } = await supabase
        .from('invoices')
        .select('total')
        .eq('user_id', user.id)
        .in('status', ['sent', 'overdue'])
        .is('paid_at', null);
      if (error) throw error;
      const total = (data || []).reduce((sum, inv) => sum + (inv.total || 0), 0);
      return { count: data?.length || 0, total };
    },
    enabled: !!user?.id,
  });

  // Receipts without payment (approved/completed, no bank_transaction_id)
  const { data: receiptsWithoutPaymentData } = useQuery({
    queryKey: ['kpi-receipts-without-payment'],
    queryFn: async () => {
      if (!user?.id) return { count: 0, total: 0 };
      const { data, error } = await supabase
        .from('receipts')
        .select('amount_gross')
        .eq('user_id', user.id)
        .in('status', ['approved', 'completed'])
        .is('bank_transaction_id', null);
      if (error) throw error;
      const total = (data || []).reduce((sum, r) => sum + (r.amount_gross || 0), 0);
      return { count: data?.length || 0, total };
    },
    enabled: !!user?.id,
  });

  // Unmatched transactions (payments without receipt)
  const { data: unmatchedPaymentsData } = useQuery({
    queryKey: ['kpi-unmatched-payments'],
    queryFn: async () => {
      if (!user?.id) return { count: 0, total: 0 };
      const { data, error } = await supabase
        .from('bank_transactions')
        .select('amount')
        .eq('user_id', user.id)
        .eq('status', 'unmatched');
      if (error) throw error;
      const total = (data || []).reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
      return { count: data?.length || 0, total };
    },
    enabled: !!user?.id,
  });

  // ===== Open Invoices Tab Query =====
  const { data: openInvoicesList, isLoading: invoicesLoading } = useQuery({
    queryKey: ['open-invoices-list'],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, customer_id, total, due_date, status, invoice_date, customers!inner(display_name)')
        .eq('user_id', user.id)
        .in('status', ['sent', 'overdue'])
        .is('paid_at', null)
        .order('due_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && activeTab === 'invoices',
  });

  // ===== Missing Receipts Tab Query =====
  const { data: missingReceiptsList, isLoading: missingLoading } = useQuery({
    queryKey: ['missing-receipts-list'],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('bank_transactions')
        .select('id, transaction_date, description, amount, source, is_expense')
        .eq('user_id', user.id)
        .eq('status', 'unmatched')
        .is('receipt_id', null)
        .eq('is_expense', true)
        .order('transaction_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && activeTab === 'missing',
  });

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
          source,
          receipts:receipt_id (
            id,
            vendor,
            amount_gross
          )
        `, { count: 'exact' })
        .eq('user_id', user.id);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (searchQuery) {
        query = query.ilike('description', `%${searchQuery}%`);
      }
      if (dateFrom) {
        query = query.gte('transaction_date', format(dateFrom, 'yyyy-MM-dd'));
      }
      if (dateTo) {
        query = query.lte('transaction_date', format(dateTo, 'yyyy-MM-dd'));
      }

      query = query.order(sortField, { ascending: sortOrder === 'asc' });
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

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
      queryClient.invalidateQueries({ queryKey: ['kpi-unmatched-payments'] });
      queryClient.invalidateQueries({ queryKey: ['kpi-receipts-without-payment'] });
      queryClient.invalidateQueries({ queryKey: ['missing-receipts-list'] });
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
      const { error: txError } = await supabase
        .from('bank_transactions')
        .update({ status: 'matched', receipt_id: receiptId })
        .eq('id', transactionId);
      if (txError) throw txError;

      const { error: rcptError } = await supabase
        .from('receipts')
        .update({ bank_transaction_id: transactionId })
        .eq('id', receiptId);
      if (rcptError) throw rcptError;

      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['bank-transactions-unmatched-count'] });
      queryClient.invalidateQueries({ queryKey: ['kpi-unmatched-payments'] });
      queryClient.invalidateQueries({ queryKey: ['kpi-receipts-without-payment'] });
      queryClient.invalidateQueries({ queryKey: ['missing-receipts-list'] });
      
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
      toast({ title: 'Buchung ignoriert', description: 'Die Buchung wird nicht mehr für den Abgleich berücksichtigt.' });
    } catch (error) {
      toast({ title: 'Fehler', description: 'Status konnte nicht aktualisiert werden.', variant: 'destructive' });
    }
  };

  const handleRestore = async (transactionId: string) => {
    try {
      await updateStatusMutation.mutateAsync({ transactionId, status: 'unmatched' });
      toast({ title: 'Buchung wiederhergestellt', description: 'Die Buchung ist wieder für den Abgleich verfügbar.' });
    } catch (error) {
      toast({ title: 'Fehler', description: 'Status konnte nicht aktualisiert werden.', variant: 'destructive' });
    }
  };

  const handleUnmatch = async (transactionId: string, receiptId: string | null) => {
    try {
      if (receiptId) {
        await supabase.from('receipts').update({ bank_transaction_id: null }).eq('id', receiptId);
      }
      await updateStatusMutation.mutateAsync({ transactionId, status: 'unmatched' });
      toast({ title: 'Zuordnung aufgehoben', description: 'Die Verknüpfung wurde entfernt.' });
    } catch (error) {
      toast({ title: 'Fehler', description: 'Die Zuordnung konnte nicht aufgehoben werden.', variant: 'destructive' });
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
    return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const getOverdueDays = (dueDate: string | null) => {
    if (!dueDate) return 0;
    const days = differenceInDays(new Date(), new Date(dueDate));
    return Math.max(0, days);
  };

  return (
    <DashboardLayout>
      <FeatureGate feature="reconciliation">
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-start justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold text-foreground">Finanzübersicht</h1>
            <p className="text-muted-foreground mt-1">
              Rechnungen, Belege und Bankbuchungen im Überblick
            </p>
          </div>
        </motion.div>

        {/* KPI Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {/* Open Invoices KPI */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('invoices')}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Offene Rechnungen</p>
                  <p className="text-2xl font-bold">{openInvoicesData?.count ?? '–'}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatAmount(openInvoicesData?.total ?? 0)} ausstehend
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Receipts without payment KPI */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('transactions')}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Belege ohne Zahlung</p>
                  <p className="text-2xl font-bold">{receiptsWithoutPaymentData?.count ?? '–'}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatAmount(receiptsWithoutPaymentData?.total ?? 0)} nicht zugeordnet
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-500/10">
                  <Receipt className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Unmatched payments KPI */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('missing')}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Zahlungen ohne Beleg</p>
                  <p className="text-2xl font-bold">{unmatchedPaymentsData?.count ?? '–'}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatAmount(unmatchedPaymentsData?.total ?? 0)} ohne Beleg
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-destructive/10">
                  <FileWarning className="h-5 w-5 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="transactions">
                Transaktionen
                {unmatchedCount !== undefined && unmatchedCount > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0">
                    {unmatchedCount}
                  </Badge>
                )}
              </TabsTrigger>
              {features.invoiceModule && (
                <TabsTrigger value="invoices">
                  Offene Rechnungen
                  {openInvoicesData && openInvoicesData.count > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0">
                      {openInvoicesData.count}
                    </Badge>
                  )}
                </TabsTrigger>
              )}
              <TabsTrigger value="missing">
                Fehlende Belege
                {unmatchedPaymentsData && unmatchedPaymentsData.count > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0">
                    {unmatchedPaymentsData.count}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* === Transactions Tab === */}
            <TabsContent value="transactions" className="space-y-4">
              {/* Filter Bar */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-4 items-center">
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
                          className={cn('px-3', statusFilter === tab.value ? '' : 'hover:bg-background')}
                        >
                          {tab.label}
                        </Button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className={cn('w-[130px] justify-start text-left font-normal', !dateFrom && 'text-muted-foreground')}>
                            <Calendar className="mr-2 h-4 w-4" />
                            {dateFrom ? format(dateFrom, 'dd.MM.yyyy') : 'Von'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                      <span className="text-muted-foreground">–</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className={cn('w-[130px] justify-start text-left font-normal', !dateTo && 'text-muted-foreground')}>
                            <Calendar className="mr-2 h-4 w-4" />
                            {dateTo ? format(dateTo, 'dd.MM.yyyy') : 'Bis'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Suche in Beschreibung..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Warning Banner */}
              {unmatchedCount !== undefined && unmatchedCount > 0 && statusFilter !== 'unmatched' && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <span className="font-medium text-amber-800 dark:text-amber-300">
                      {unmatchedCount} Bankbuchungen warten auf Zuordnung
                    </span>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="outline" disabled className="opacity-50">
                        Automatisch matchen
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Kommt bald</p></TooltipContent>
                  </Tooltip>
                </div>
              )}

              {/* Transactions Table */}
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
                          <p className="text-muted-foreground mt-1">Keine offenen Buchungen vorhanden.</p>
                        </>
                      ) : totalItems === 0 ? (
                        <>
                          <FileSpreadsheet className="h-12 w-12 text-muted-foreground/50 mb-4" />
                          <h3 className="text-lg font-medium">Noch keine Bankbuchungen importiert</h3>
                          <p className="text-muted-foreground mt-1 mb-4">Importiere einen Kontoauszug, um Buchungen mit Belegen abzugleichen.</p>
                          <Button onClick={() => navigate('/bank-import')}>Kontoauszug importieren</Button>
                        </>
                      ) : (
                        <>
                          <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                          <h3 className="text-lg font-medium">Keine Ergebnisse</h3>
                          <p className="text-muted-foreground mt-1">Keine Buchungen entsprechen deinen Filterkriterien.</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('transaction_date')}>
                              <div className="flex items-center gap-1">
                                Datum
                                {sortField === 'transaction_date' && <ArrowUpDown className="h-3 w-3" />}
                              </div>
                            </TableHead>
                            <TableHead>Beschreibung</TableHead>
                            <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('amount')}>
                              <div className="flex items-center justify-end gap-1">
                                Betrag
                                {sortField === 'amount' && <ArrowUpDown className="h-3 w-3" />}
                              </div>
                            </TableHead>
                            <TableHead>Quelle</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Zugeordneter Beleg</TableHead>
                            <TableHead className="text-right">Aktionen</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transactions.map((transaction) => (
                            <TableRow key={transaction.id}>
                              <TableCell className="font-medium whitespace-nowrap">
                                {transaction.transaction_date ? format(new Date(transaction.transaction_date), 'dd.MM.yyyy', { locale: de }) : '–'}
                              </TableCell>
                              <TableCell>
                                <span title={transaction.description || ''}>{truncateText(transaction.description)}</span>
                              </TableCell>
                              <TableCell className={cn('text-right font-mono whitespace-nowrap', transaction.amount && transaction.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400')}>
                                {formatAmount(transaction.amount)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs">
                                  {(transaction as any).source === 'live' ? 'Live-Bank' : 'CSV-Import'}
                                </Badge>
                              </TableCell>
                              <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                              <TableCell>
                                {transaction.status === 'matched' && transaction.receipt ? (
                                  <div className="flex items-center gap-2 text-sm">
                                    <LinkIcon className="h-3 w-3 text-muted-foreground" />
                                    <span>{transaction.receipt.vendor || 'Beleg'}</span>
                                    <span className="text-muted-foreground">({formatAmount(transaction.receipt.amount_gross)})</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">–</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {transaction.status === 'unmatched' && (
                                  <div className="flex justify-end gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleAssignClick(transaction)}>
                                      <FileText className="mr-1 h-3 w-3" />
                                      Beleg zuordnen
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleIgnore(transaction.id)} className="text-muted-foreground hover:text-destructive">
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                                {transaction.status === 'matched' && (
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => transaction.receipt && handleViewReceipt(transaction.receipt.id)}>
                                      <Eye className="mr-1 h-3 w-3" />
                                      Anzeigen
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleUnmatch(transaction.id, transaction.receipt_id)} className="text-muted-foreground">
                                      Trennen
                                    </Button>
                                  </div>
                                )}
                                {transaction.status === 'ignored' && (
                                  <Button variant="ghost" size="sm" onClick={() => handleRestore(transaction.id)} className="text-muted-foreground">
                                    <RotateCcw className="mr-1 h-3 w-3" />
                                    Wiederherstellen
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </div>

                      {totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t">
                          <p className="text-sm text-muted-foreground">
                            Zeige {(currentPage - 1) * ITEMS_PER_PAGE + 1} bis {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} von {totalItems}
                          </p>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm px-2">Seite {currentPage} von {totalPages}</span>
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* === Open Invoices Tab === */}
            {features.invoiceModule && (
              <TabsContent value="invoices" className="space-y-4">
                <Card>
                  <CardContent className="p-0">
                    {invoicesLoading ? (
                      <div className="p-6 space-y-4">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="flex gap-4">
                            <Skeleton className="h-5 w-24" />
                            <Skeleton className="h-5 flex-1" />
                            <Skeleton className="h-5 w-20" />
                            <Skeleton className="h-5 w-24" />
                          </div>
                        ))}
                      </div>
                    ) : !openInvoicesList || openInvoicesList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                        <h3 className="text-lg font-medium">Alle Rechnungen bezahlt! 🎉</h3>
                        <p className="text-muted-foreground mt-1">Keine offenen Ausgangsrechnungen vorhanden.</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Rechnungsnr.</TableHead>
                            <TableHead>Kunde</TableHead>
                            <TableHead className="text-right">Betrag</TableHead>
                            <TableHead>Fälligkeitsdatum</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Aktionen</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {openInvoicesList.map((invoice: any) => {
                            const overdueDays = getOverdueDays(invoice.due_date);
                            const isOverdue = overdueDays > 0;
                            return (
                              <TableRow key={invoice.id}>
                                <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                                <TableCell>{(invoice.customers as any)?.display_name || '–'}</TableCell>
                                <TableCell className="text-right font-mono">{formatAmount(invoice.total)}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {invoice.due_date ? format(new Date(invoice.due_date), 'dd.MM.yyyy', { locale: de }) : '–'}
                                    {isOverdue && (
                                      <Badge className="bg-destructive/10 text-destructive border-0 text-xs">
                                        <Clock className="h-3 w-3 mr-1" />
                                        {overdueDays} Tage
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {invoice.status === 'overdue' ? (
                                    <Badge className="bg-destructive/10 text-destructive border-0">Überfällig</Badge>
                                  ) : (
                                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">Gesendet</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button variant="outline" size="sm" onClick={() => navigate(`/invoices/${invoice.id}/edit`)}>
                                    <Eye className="mr-1 h-3 w-3" />
                                    Anzeigen
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* === Missing Receipts Tab === */}
            <TabsContent value="missing" className="space-y-4">
              <Card>
                <CardContent className="p-0">
                  {missingLoading ? (
                    <div className="p-6 space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex gap-4">
                          <Skeleton className="h-5 w-24" />
                          <Skeleton className="h-5 flex-1" />
                          <Skeleton className="h-5 w-20" />
                          <Skeleton className="h-5 w-24" />
                        </div>
                      ))}
                    </div>
                  ) : !missingReceiptsList || missingReceiptsList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                      <h3 className="text-lg font-medium">Alle Belege vorhanden! 🎉</h3>
                      <p className="text-muted-foreground mt-1">Zu allen Ausgaben sind Belege zugeordnet.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Datum</TableHead>
                          <TableHead>Beschreibung</TableHead>
                          <TableHead className="text-right">Betrag</TableHead>
                          <TableHead>Quelle</TableHead>
                          <TableHead className="text-right">Aktionen</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {missingReceiptsList.map((tx: any) => (
                          <TableRow key={tx.id}>
                            <TableCell className="font-medium whitespace-nowrap">
                              {tx.transaction_date ? format(new Date(tx.transaction_date), 'dd.MM.yyyy', { locale: de }) : '–'}
                            </TableCell>
                            <TableCell>
                              <span title={tx.description || ''}>{truncateText(tx.description)}</span>
                            </TableCell>
                            <TableCell className="text-right font-mono text-red-600 dark:text-red-400">
                              {formatAmount(tx.amount)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {tx.source === 'live' ? 'Live-Bank' : 'CSV-Import'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAssignClick({
                                  id: tx.id,
                                  transaction_date: tx.transaction_date,
                                  description: tx.description,
                                  amount: tx.amount,
                                  status: 'unmatched',
                                  receipt_id: null,
                                })}
                              >
                                <FileText className="mr-1 h-3 w-3" />
                                Beleg zuordnen
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
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
      </FeatureGate>
    </DashboardLayout>
  );
}
