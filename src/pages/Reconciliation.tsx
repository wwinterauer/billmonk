import { useState, useEffect, useMemo } from 'react';
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
import { SkontoReconcileDialog, type SkontoCandidate } from '@/components/reconciliation/SkontoReconcileDialog';
import { Sparkles } from 'lucide-react';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { EditableTableHead } from '@/components/expenses/EditableTableHead';
import { useEditableColumns, type ColumnDef } from '@/hooks/useEditableColumns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePlan } from '@/hooks/usePlan';
import { PageMeta } from '@/components/PageMeta';
import { detectRecurringGroups, type RecurringGroup } from '@/lib/recurring-detection';
import { RecurringSuggestionsPanel } from '@/components/reconciliation/RecurringSuggestionsPanel';

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

  // Auto-reconcile (skonto) state
  const [reconcileRunning, setReconcileRunning] = useState(false);
  const [reconcileApplying, setReconcileApplying] = useState(false);
  const [reconcileDialogOpen, setReconcileDialogOpen] = useState(false);
  const [skontoCandidates, setSkontoCandidates] = useState<SkontoCandidate[]>([]);
  const [reconcileSummary, setReconcileSummary] = useState<{ exact: number; scanned: number }>({ exact: 0, scanned: 0 });

  const runAutoReconcile = async () => {
    setReconcileRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('reconcile-with-skonto', {
        body: { mode: 'preview' },
      });
      if (error) throw error;
      const exact = data?.exact_applied ?? 0;
      const scanned = data?.scanned_transactions ?? 0;
      const candidates: SkontoCandidate[] = data?.skonto_candidates ?? [];
      setSkontoCandidates(candidates);
      setReconcileSummary({ exact, scanned });

      // Always refresh after exact matches
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['bank-transactions-unmatched-count'] });
      queryClient.invalidateQueries({ queryKey: ['kpi-unmatched-payments'] });
      queryClient.invalidateQueries({ queryKey: ['kpi-receipts-without-payment'] });
      queryClient.invalidateQueries({ queryKey: ['missing-receipts-list'] });

      if (candidates.length > 0) {
        setReconcileDialogOpen(true);
      } else {
        toast({
          title: 'Abgleich abgeschlossen',
          description: exact > 0
            ? `${exact} Buchung${exact === 1 ? '' : 'en'} exakt zugeordnet. Keine Skonto-Vorschläge.`
            : 'Keine passenden Belege gefunden.',
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
      toast({ title: 'Fehler beim Abgleich', description: msg, variant: 'destructive' });
    } finally {
      setReconcileRunning(false);
    }
  };

  const applySkontoMatches = async (accepted: { transaction_id: string; receipt_id: string }[]) => {
    setReconcileApplying(true);
    try {
      const { data, error } = await supabase.functions.invoke('reconcile-with-skonto', {
        body: { mode: 'apply', accepted_pairs: accepted },
      });
      if (error) throw error;
      const applied = data?.applied ?? 0;
      toast({
        title: 'Skonto-Zuordnungen übernommen',
        description: `${applied} Buchung${applied === 1 ? '' : 'en'} verknüpft.`,
      });
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['bank-transactions-unmatched-count'] });
      queryClient.invalidateQueries({ queryKey: ['kpi-unmatched-payments'] });
      queryClient.invalidateQueries({ queryKey: ['kpi-receipts-without-payment'] });
      queryClient.invalidateQueries({ queryKey: ['missing-receipts-list'] });
      setReconcileDialogOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
      toast({ title: 'Fehler beim Übernehmen', description: msg, variant: 'destructive' });
    } finally {
      setReconcileApplying(false);
    }
  };

  // ===== Editable column configs =====
  type TxCol = 'date' | 'description' | 'amount' | 'source' | 'status' | 'matched' | 'actions';
  const txColumns: ColumnDef<TxCol>[] = useMemo(() => [
    { key: 'date', label: 'Datum', defaultWidth: 120, sortable: true },
    { key: 'description', label: 'Beschreibung', defaultWidth: 360 },
    { key: 'amount', label: 'Betrag', defaultWidth: 130, sortable: true, align: 'right' },
    { key: 'source', label: 'Quelle', defaultWidth: 110 },
    { key: 'status', label: 'Status', defaultWidth: 110 },
    { key: 'matched', label: 'Zugeordneter Beleg', defaultWidth: 240 },
    { key: 'actions', label: 'Aktionen', defaultWidth: 220, align: 'right' },
  ], []);
  const txCols = useEditableColumns<TxCol>('reconcile-tx', txColumns);

  type InvCol = 'number' | 'customer' | 'amount' | 'due' | 'status' | 'actions';
  const invColumns: ColumnDef<InvCol>[] = useMemo(() => [
    { key: 'number', label: 'Rechnungsnr.', defaultWidth: 140 },
    { key: 'customer', label: 'Kunde', defaultWidth: 240 },
    { key: 'amount', label: 'Betrag', defaultWidth: 130, align: 'right' },
    { key: 'due', label: 'Fälligkeitsdatum', defaultWidth: 200 },
    { key: 'status', label: 'Status', defaultWidth: 130 },
    { key: 'actions', label: 'Aktionen', defaultWidth: 140, align: 'right' },
  ], []);
  const invCols = useEditableColumns<InvCol>('reconcile-inv', invColumns);

  type MissCol = 'date' | 'description' | 'amount' | 'source' | 'actions';
  const missColumns: ColumnDef<MissCol>[] = useMemo(() => [
    { key: 'date', label: 'Datum', defaultWidth: 120 },
    { key: 'description', label: 'Beschreibung', defaultWidth: 420 },
    { key: 'amount', label: 'Betrag', defaultWidth: 130, align: 'right' },
    { key: 'source', label: 'Quelle', defaultWidth: 110 },
    { key: 'actions', label: 'Aktionen', defaultWidth: 160, align: 'right' },
  ], []);
  const missCols = useEditableColumns<MissCol>('reconcile-miss', missColumns);

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

  // ===== Recurring (Akonto) detection =====
  const [dismissedRecurring, setDismissedRecurring] = useState<Set<string>>(new Set());
  const [bulkIgnoreBusy, setBulkIgnoreBusy] = useState(false);

  const { data: allUnmatchedTxs } = useQuery({
    queryKey: ['bank-transactions-all-unmatched', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('bank_transactions')
        .select('id, transaction_date, description, amount')
        .eq('user_id', user.id)
        .eq('status', 'unmatched')
        .eq('is_expense', true)
        .order('transaction_date', { ascending: true })
        .limit(2000);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const recurringGroups: RecurringGroup[] = useMemo(
    () => (allUnmatchedTxs ? detectRecurringGroups(allUnmatchedTxs) : []),
    [allUnmatchedTxs]
  );

  const recurringTxIds = useMemo(() => {
    const set = new Set<string>();
    for (const g of recurringGroups) {
      if (dismissedRecurring.has(g.key)) continue;
      for (const t of g.transactions) set.add(t.id);
    }
    return set;
  }, [recurringGroups, dismissedRecurring]);

  const handleBulkIgnoreRecurring = async (group: RecurringGroup) => {
    setBulkIgnoreBusy(true);
    try {
      const ids = group.transactions.map(t => t.id);
      const { error } = await supabase
        .from('bank_transactions')
        .update({ status: 'ignored' })
        .in('id', ids);
      if (error) throw error;
      toast({
        title: 'Akontobuchungen ignoriert',
        description: `${ids.length} Buchungen von „${group.vendorLabel}" wurden als ignoriert markiert.`,
      });
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['bank-transactions-unmatched-count'] });
      queryClient.invalidateQueries({ queryKey: ['bank-transactions-all-unmatched', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['kpi-unmatched-payments'] });
      queryClient.invalidateQueries({ queryKey: ['missing-receipts-list'] });
    } catch (e) {
      toast({
        title: 'Fehler',
        description: 'Buchungen konnten nicht ignoriert werden.',
        variant: 'destructive',
      });
    } finally {
      setBulkIgnoreBusy(false);
    }
  };
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

  const handleAssign = async (
    transactionId: string,
    receiptId: string,
    splitLineId?: string | null,
  ) => {
    try {
      const { error: txError } = await supabase
        .from('bank_transactions')
        .update({
          status: 'matched',
          receipt_id: receiptId,
          receipt_split_line_id: splitLineId ?? null,
        })
        .eq('id', transactionId);
      if (txError) throw txError;

      // Only attach to receipt itself for whole-receipt matches
      if (!splitLineId) {
        const { error: rcptError } = await supabase
          .from('receipts')
          .update({ bank_transaction_id: transactionId })
          .eq('id', receiptId);
        if (rcptError) throw rcptError;
      }

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
      // Only unlink the receipt's bank_transaction_id if it was actually pointing at this tx
      // (split-line matches don't set receipts.bank_transaction_id at all).
      if (receiptId) {
        await supabase
          .from('receipts')
          .update({ bank_transaction_id: null })
          .eq('id', receiptId)
          .eq('bank_transaction_id', transactionId);
      }
      await supabase
        .from('bank_transactions')
        .update({ status: 'unmatched', receipt_id: null, receipt_split_line_id: null })
        .eq('id', transactionId);
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['bank-transactions-unmatched-count'] });
      queryClient.invalidateQueries({ queryKey: ['kpi-unmatched-payments'] });
      queryClient.invalidateQueries({ queryKey: ['kpi-receipts-without-payment'] });
      queryClient.invalidateQueries({ queryKey: ['missing-receipts-list'] });
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
    <>
      <PageMeta title="Abgleich — BillMonk" description="Bankumsätze und Belege automatisch und manuell abgleichen." canonical="/reconciliation" noindex />
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

              {/* Auto-Reconcile Banner */}
              {unmatchedCount !== undefined && unmatchedCount > 0 && (
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
                        onClick={runAutoReconcile}
                        disabled={reconcileRunning}
                      >
                        {reconcileRunning ? (
                          <>
                            <Clock className="mr-2 h-4 w-4 animate-spin" />
                            Wird abgeglichen…
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Automatisch matchen
                          </>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Exakte Treffer werden direkt zugeordnet. Bei 1–5 % Abweichung mit Lieferant/Rechnungsnummer in der Beschreibung wird ein Skonto-Vorschlag zur Bestätigung angezeigt.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}

              {/* Recurring (Akonto) suggestions */}
              <RecurringSuggestionsPanel
                groups={recurringGroups}
                dismissedKeys={dismissedRecurring}
                onDismiss={(key) =>
                  setDismissedRecurring(prev => {
                    const next = new Set(prev);
                    next.add(key);
                    return next;
                  })
                }
                onIgnoreAll={handleBulkIgnoreRecurring}
                isBusy={bulkIgnoreBusy}
              />

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
                      <txCols.DndContext sensors={txCols.sensors} collisionDetection={txCols.closestCenter} onDragEnd={txCols.handleDragEnd}>
                      <Table style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
                        <TableHeader>
                          <TableRow>
                            <SortableContext items={txCols.order} strategy={horizontalListSortingStrategy}>
                              {txCols.order.map((key) => {
                                const def = txCols.defByKey[key];
                                const sortFieldMap: Partial<Record<TxCol, SortField>> = { date: 'transaction_date', amount: 'amount' };
                                const sf = sortFieldMap[key];
                                return (
                                  <EditableTableHead
                                    key={key}
                                    id={key}
                                    label={def.label}
                                    width={txCols.widths[key]}
                                    sortable={!!def.sortable}
                                    isSorted={sf && sortField === sf ? sortOrder : false}
                                    align={def.align}
                                    onSort={sf ? () => handleSort(sf) : undefined}
                                    onResize={(w) => txCols.setWidth(key, w)}
                                  />
                                );
                              })}
                            </SortableContext>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transactions.map((transaction) => {
                            const cells: Record<TxCol, React.ReactNode> = {
                              date: (
                                <span className="font-medium whitespace-nowrap">
                                  {transaction.transaction_date ? format(new Date(transaction.transaction_date), 'dd.MM.yyyy', { locale: de }) : '–'}
                                </span>
                              ),
                              description: (
                                <Tooltip delayDuration={300}>
                                  <TooltipTrigger asChild>
                                    <span className="flex items-center gap-2 min-w-0 cursor-default">
                                      <span className="block truncate">{truncateText(transaction.description)}</span>
                                      {recurringTxIds.has(transaction.id) && (
                                        <Badge variant="outline" className="shrink-0 text-[10px] gap-1 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300">
                                          wiederkehrend
                                        </Badge>
                                      )}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" align="start" className="max-w-md whitespace-pre-wrap break-words">
                                    <p>{transaction.description || '–'}</p>
                                    {recurringTxIds.has(transaction.id) && (
                                      <p className="mt-1 text-xs text-blue-300">Teil einer erkannten wiederkehrenden Buchungsserie (Akonto).</p>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              ),
                              amount: (
                                <span className={cn('font-mono whitespace-nowrap', transaction.amount && transaction.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400')}>
                                  {formatAmount(transaction.amount)}
                                </span>
                              ),
                              source: (
                                <Badge variant="secondary" className="text-xs">
                                  {(transaction as any).source === 'live' ? 'Live-Bank' : 'CSV-Import'}
                                </Badge>
                              ),
                              status: getStatusBadge(transaction.status),
                              matched: transaction.status === 'matched' && transaction.receipt ? (
                                <div className="flex items-center gap-2 text-sm min-w-0">
                                  <LinkIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="truncate">{transaction.receipt.vendor || 'Beleg'}</span>
                                  <span className="text-muted-foreground shrink-0">({formatAmount(transaction.receipt.amount_gross)})</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">–</span>
                              ),
                              actions: (
                                <>
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
                                    <div className="flex justify-end">
                                      <Button variant="ghost" size="sm" onClick={() => handleRestore(transaction.id)} className="text-muted-foreground">
                                        <RotateCcw className="mr-1 h-3 w-3" />
                                        Wiederherstellen
                                      </Button>
                                    </div>
                                  )}
                                </>
                              ),
                            };
                            return (
                              <TableRow key={transaction.id}>
                                {txCols.order.map((key) => {
                                  const def = txCols.defByKey[key];
                                  return (
                                    <TableCell
                                      key={key}
                                      style={{ width: txCols.widths[key], minWidth: txCols.widths[key], maxWidth: txCols.widths[key] }}
                                      className={cn('overflow-hidden', def.align === 'right' && 'text-right')}
                                    >
                                      {cells[key]}
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      </txCols.DndContext>
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
                      <div className="overflow-x-auto">
                      <invCols.DndContext sensors={invCols.sensors} collisionDetection={invCols.closestCenter} onDragEnd={invCols.handleDragEnd}>
                      <Table style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
                        <TableHeader>
                          <TableRow>
                            <SortableContext items={invCols.order} strategy={horizontalListSortingStrategy}>
                              {invCols.order.map((key) => {
                                const def = invCols.defByKey[key];
                                return (
                                  <EditableTableHead
                                    key={key}
                                    id={key}
                                    label={def.label}
                                    width={invCols.widths[key]}
                                    sortable={false}
                                    isSorted={false}
                                    align={def.align}
                                    onResize={(w) => invCols.setWidth(key, w)}
                                  />
                                );
                              })}
                            </SortableContext>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {openInvoicesList.map((invoice: any) => {
                            const overdueDays = getOverdueDays(invoice.due_date);
                            const isOverdue = overdueDays > 0;
                            const cells: Record<InvCol, React.ReactNode> = {
                              number: <span className="font-medium">{invoice.invoice_number}</span>,
                              customer: <span className="truncate block">{(invoice.customers as any)?.display_name || '–'}</span>,
                              amount: <span className="font-mono">{formatAmount(invoice.total)}</span>,
                              due: (
                                <div className="flex items-center gap-2">
                                  <span className="whitespace-nowrap">{invoice.due_date ? format(new Date(invoice.due_date), 'dd.MM.yyyy', { locale: de }) : '–'}</span>
                                  {isOverdue && (
                                    <Badge className="bg-destructive/10 text-destructive border-0 text-xs">
                                      <Clock className="h-3 w-3 mr-1" />
                                      {overdueDays} Tage
                                    </Badge>
                                  )}
                                </div>
                              ),
                              status: invoice.status === 'overdue' ? (
                                <Badge className="bg-destructive/10 text-destructive border-0">Überfällig</Badge>
                              ) : (
                                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">Gesendet</Badge>
                              ),
                              actions: (
                                <div className="flex justify-end">
                                  <Button variant="outline" size="sm" onClick={() => navigate(`/invoices/${invoice.id}/edit`)}>
                                    <Eye className="mr-1 h-3 w-3" />
                                    Anzeigen
                                  </Button>
                                </div>
                              ),
                            };
                            return (
                              <TableRow key={invoice.id}>
                                {invCols.order.map((key) => {
                                  const def = invCols.defByKey[key];
                                  return (
                                    <TableCell
                                      key={key}
                                      style={{ width: invCols.widths[key], minWidth: invCols.widths[key], maxWidth: invCols.widths[key] }}
                                      className={cn('overflow-hidden', def.align === 'right' && 'text-right')}
                                    >
                                      {cells[key]}
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      </invCols.DndContext>
                      </div>
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
                    <div className="overflow-x-auto">
                    <missCols.DndContext sensors={missCols.sensors} collisionDetection={missCols.closestCenter} onDragEnd={missCols.handleDragEnd}>
                    <Table style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
                      <TableHeader>
                        <TableRow>
                          <SortableContext items={missCols.order} strategy={horizontalListSortingStrategy}>
                            {missCols.order.map((key) => {
                              const def = missCols.defByKey[key];
                              return (
                                <EditableTableHead
                                  key={key}
                                  id={key}
                                  label={def.label}
                                  width={missCols.widths[key]}
                                  sortable={false}
                                  isSorted={false}
                                  align={def.align}
                                  onResize={(w) => missCols.setWidth(key, w)}
                                />
                              );
                            })}
                          </SortableContext>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {missingReceiptsList.map((tx: any) => {
                          const cells: Record<MissCol, React.ReactNode> = {
                            date: <span className="font-medium whitespace-nowrap">{tx.transaction_date ? format(new Date(tx.transaction_date), 'dd.MM.yyyy', { locale: de }) : '–'}</span>,
                            description: (
                              <Tooltip delayDuration={300}>
                                <TooltipTrigger asChild>
                                  <span className="block truncate cursor-default">{truncateText(tx.description)}</span>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" align="start" className="max-w-md whitespace-pre-wrap break-words">
                                  <p>{tx.description || '–'}</p>
                                </TooltipContent>
                              </Tooltip>
                            ),
                            amount: <span className="font-mono text-red-600 dark:text-red-400">{formatAmount(tx.amount)}</span>,
                            source: (
                              <Badge variant="secondary" className="text-xs">
                                {tx.source === 'live' ? 'Live-Bank' : 'CSV-Import'}
                              </Badge>
                            ),
                            actions: (
                              <div className="flex justify-end">
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
                              </div>
                            ),
                          };
                          return (
                            <TableRow key={tx.id}>
                              {missCols.order.map((key) => {
                                const def = missCols.defByKey[key];
                                return (
                                  <TableCell
                                    key={key}
                                    style={{ width: missCols.widths[key], minWidth: missCols.widths[key], maxWidth: missCols.widths[key] }}
                                    className={cn('overflow-hidden', def.align === 'right' && 'text-right')}
                                  >
                                    {cells[key]}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    </missCols.DndContext>
                    </div>
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

      <SkontoReconcileDialog
        open={reconcileDialogOpen}
        onOpenChange={setReconcileDialogOpen}
        candidates={skontoCandidates}
        exactApplied={reconcileSummary.exact}
        scanned={reconcileSummary.scanned}
        onApply={applySkontoMatches}
        isApplying={reconcileApplying}
      />
      </FeatureGate>
    </DashboardLayout>
  
    </>
  );
}
