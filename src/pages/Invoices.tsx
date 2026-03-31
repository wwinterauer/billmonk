import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FeatureGate } from '@/components/FeatureGate';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileText, Plus, MoreHorizontal, CheckCircle, Send, XCircle, Trash2, Euro, Clock, AlertTriangle, Download, Copy, GitBranch, ArrowRight, Receipt, Landmark, Eye, Search, CalendarIcon, Columns3, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Percent, RefreshCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useInvoices, type Invoice } from '@/hooks/useInvoices';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TaxExportDialog } from '@/components/exports/TaxExportDialog';
import { PdfPreviewDialog } from '@/components/invoices/PdfPreviewDialog';
import { format, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, subQuarters, startOfYear, endOfYear, subYears } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Entwurf', variant: 'secondary' },
  approved: { label: 'Freigegeben', variant: 'outline' },
  sent: { label: 'Versendet', variant: 'default' },
  paid: { label: 'Bezahlt', variant: 'outline' },
  paid_with_skonto: { label: 'Bezahlt (Skonto)', variant: 'outline' },
  overdue: { label: 'Überfällig', variant: 'destructive' },
  reminder_1: { label: '1. Mahnung', variant: 'destructive' },
  reminder_2: { label: '2. Mahnung', variant: 'destructive' },
  cancelled: { label: 'Storniert', variant: 'secondary' },
  credited: { label: 'Gutgeschrieben', variant: 'secondary' },
  corrected: { label: 'Korrigiert', variant: 'secondary' },
};

const ITEMS_PER_PAGE = 25;

type ColumnKey = 'number' | 'customer' | 'date' | 'due' | 'category' | 'amount' | 'status';

const DEFAULT_COLUMNS: Record<ColumnKey, boolean> = {
  number: true,
  customer: true,
  date: true,
  due: true,
  category: true,
  amount: true,
  status: true,
};

const COLUMN_LABELS: Record<ColumnKey, string> = {
  number: 'Nr.',
  customer: 'Kunde',
  date: 'Datum',
  due: 'Fällig',
  category: 'Kategorie',
  amount: 'Betrag',
  status: 'Status',
};

const DATE_PRESETS = [
  { label: 'Aktueller Monat', getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: 'Letzter Monat', getValue: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: 'Aktuelles Quartal', getValue: () => ({ from: startOfQuarter(new Date()), to: endOfQuarter(new Date()) }) },
  { label: 'Letztes Quartal', getValue: () => ({ from: startOfQuarter(subQuarters(new Date(), 1)), to: endOfQuarter(subQuarters(new Date(), 1)) }) },
  { label: 'Aktuelles Jahr', getValue: () => ({ from: startOfYear(new Date()), to: endOfYear(new Date()) }) },
  { label: 'Letztes Jahr', getValue: () => ({ from: startOfYear(subYears(new Date(), 1)), to: endOfYear(subYears(new Date(), 1)) }) },
];

const Invoices = () => {
  const { invoices, loading, updateInvoiceStatus, deleteInvoice, copyInvoice, createCorrectionVersion, convertDocument, createPartialInvoice } = useInvoices();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [columns, setColumns] = useState<Record<ColumnKey, boolean>>(() => {
    try {
      const saved = localStorage.getItem('invoice-columns');
      return saved ? JSON.parse(saved) : DEFAULT_COLUMNS;
    } catch { return DEFAULT_COLUMNS; }
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [taxExportOpen, setTaxExportOpen] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{ open: boolean; path: string | null; number: string }>({ open: false, path: null, number: '' });
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const navigate = useNavigate();

  const toggleColumn = (key: ColumnKey) => {
    const next = { ...columns, [key]: !columns[key] };
    setColumns(next);
    localStorage.setItem('invoice-columns', JSON.stringify(next));
  };

  // Filter only invoices (not quotes/order_confirmations)
  const invoiceOnly = useMemo(() => {
    return invoices.filter(inv => !(inv as any).document_type || (inv as any).document_type === 'invoice');
  }, [invoices]);

  const filtered = useMemo(() => {
    let result = invoiceOnly;

    if (statusFilter !== 'all') {
      result = result.filter(inv => inv.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(inv => {
        const cn = ((inv.customers as any)?.display_name || (inv.customers as any)?.company_name || '').toLowerCase();
        return inv.invoice_number.toLowerCase().includes(q) || cn.includes(q);
      });
    }

    if (dateFrom) {
      result = result.filter(inv => inv.invoice_date && new Date(inv.invoice_date) >= dateFrom);
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      result = result.filter(inv => inv.invoice_date && new Date(inv.invoice_date) <= end);
    }

    return result;
  }, [invoiceOnly, statusFilter, searchQuery, dateFrom, dateTo]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginatedPage = Math.min(currentPage, totalPages);
  const paginated = useMemo(() => {
    const start = (paginatedPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, paginatedPage]);

  const stats = useMemo(() => {
    const open = invoiceOnly.filter(i => i.status === 'sent').reduce((s, i) => s + (i.total || 0), 0);
    const overdue = invoiceOnly.filter(i => i.status === 'overdue').reduce((s, i) => s + (i.total || 0), 0);
    const paidThisMonth = invoiceOnly
      .filter(i => {
        if ((i.status !== 'paid' && i.status !== 'paid_with_skonto') || !i.paid_at) return false;
        const d = new Date(i.paid_at);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, i) => s + (i.total || 0), 0);
    return { open, overdue, paidThisMonth };
  }, [invoiceOnly]);

  const fmt = (n: number) =>
    new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(n);

  const fmtDate = (d: string | null) => {
    if (!d) return '–';
    return new Date(d).toLocaleDateString('de-AT');
  };

  const customerName = (inv: Invoice) => {
    const c = inv.customers as any;
    return c?.display_name || c?.company_name || '–';
  };

  // Selection helpers
  const allOnPageSelected = paginated.length > 0 && paginated.every(inv => selectedIds.has(inv.id));
  const someSelected = selectedIds.size > 0;

  const toggleAll = () => {
    if (allOnPageSelected) {
      const next = new Set(selectedIds);
      paginated.forEach(inv => next.delete(inv.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      paginated.forEach(inv => next.add(inv.id));
      setSelectedIds(next);
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Bulk actions
  const selectedInvoices = invoiceOnly.filter(inv => selectedIds.has(inv.id));
  const hasSkontoCandidates = selectedInvoices.some(inv => (inv.discount_percent || 0) > 0 && (inv.status === 'sent' || inv.status === 'overdue'));

  const handleBulk = async (action: string) => {
    const ids = Array.from(selectedIds);
    let count = 0;
    for (const id of ids) {
      const inv = invoiceOnly.find(i => i.id === id);
      if (!inv) continue;

      if (action === 'paid' && (inv.status === 'sent' || inv.status === 'overdue')) {
        await updateInvoiceStatus(id, 'paid');
        count++;
      } else if (action === 'paid_with_skonto' && (inv.status === 'sent' || inv.status === 'overdue')) {
        await updateInvoiceStatus(id, 'paid_with_skonto');
        count++;
      } else if (action === 'sent' && inv.status === 'draft') {
        await updateInvoiceStatus(id, 'sent');
        count++;
      } else if (action === 'cancelled' && inv.status !== 'cancelled' && inv.status !== 'paid' && inv.status !== 'paid_with_skonto') {
        await updateInvoiceStatus(id, 'cancelled');
        count++;
      }
    }
    if (count > 0) {
      toast({ title: `${count} Rechnung(en) aktualisiert` });
    }
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    let count = 0;
    for (const id of ids) {
      await deleteInvoice(id);
      count++;
    }
    toast({ title: `${count} Rechnung(en) gelöscht` });
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
  };

  return (
    <DashboardLayout>
      <FeatureGate feature="invoiceModule">
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Rechnungen</h1>
            <p className="text-muted-foreground">Ausgangsrechnungen erstellen und verwalten</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setTaxExportOpen(true)}>
              <Landmark className="h-4 w-4 mr-2" />
              Steuerberater-Export
            </Button>
            <Button asChild>
              <Link to="/invoices/new">
                <Plus className="h-4 w-4 mr-2" />
                Neue Rechnung
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Offen</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{fmt(stats.open)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Überfällig</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive">{fmt(stats.overdue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Bezahlt (Monat)</CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{fmt(stats.paidThisMonth)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter + Table */}
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <CardTitle>Alle Rechnungen</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Suche Nr. / Kunde…"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="pl-8 w-[200px]"
                  />
                </div>

                {/* Date filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("gap-1", (dateFrom || dateTo) && "text-primary")}>
                      <CalendarIcon className="h-4 w-4" />
                      {dateFrom && dateTo
                        ? `${format(dateFrom, 'dd.MM.yy')} – ${format(dateTo, 'dd.MM.yy')}`
                        : dateFrom
                          ? `Ab ${format(dateFrom, 'dd.MM.yy')}`
                          : dateTo
                            ? `Bis ${format(dateTo, 'dd.MM.yy')}`
                            : 'Zeitraum'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3" align="end">
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-1">
                        {DATE_PRESETS.map(preset => (
                          <Button key={preset.label} variant="outline" size="sm" className="text-xs" onClick={() => {
                            const { from, to } = preset.getValue();
                            setDateFrom(from);
                            setDateTo(to);
                            setCurrentPage(1);
                          }}>
                            {preset.label}
                          </Button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Von</p>
                          <Calendar mode="single" selected={dateFrom} onSelect={d => { setDateFrom(d); setCurrentPage(1); }} className="p-2 pointer-events-auto" locale={de} />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Bis</p>
                          <Calendar mode="single" selected={dateTo} onSelect={d => { setDateTo(d); setCurrentPage(1); }} className="p-2 pointer-events-auto" locale={de} />
                        </div>
                      </div>
                      {(dateFrom || dateTo) && (
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => { setDateFrom(undefined); setDateTo(undefined); setCurrentPage(1); }}>
                          Zurücksetzen
                        </Button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Status filter */}
                <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Status filtern" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Status</SelectItem>
                    <SelectItem value="draft">Entwurf</SelectItem>
                    <SelectItem value="approved">Freigegeben</SelectItem>
                    <SelectItem value="sent">Versendet</SelectItem>
                    <SelectItem value="paid">Bezahlt</SelectItem>
                    <SelectItem value="paid_with_skonto">Bezahlt (Skonto)</SelectItem>
                    <SelectItem value="overdue">Überfällig</SelectItem>
                    <SelectItem value="cancelled">Storniert</SelectItem>
                  </SelectContent>
                </Select>

                {/* Column toggle */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9">
                      <Columns3 className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Spalten</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map(key => (
                      <DropdownMenuCheckboxItem key={key} checked={columns[key]} onCheckedChange={() => toggleColumn(key)}>
                        {COLUMN_LABELS[key]}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <AnimatePresence>
              {someSelected && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-muted/50 rounded-lg"
                >
                  <Badge variant="secondary">{selectedIds.size} ausgewählt</Badge>
                  <Button size="sm" variant="outline" className="border-green-600 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950" onClick={() => handleBulk('paid')}>
                    <CheckCircle className="h-4 w-4 mr-1" /> Als bezahlt
                  </Button>
                  {hasSkontoCandidates && (
                    <Button size="sm" variant="outline" className="border-green-600 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950" onClick={() => handleBulk('paid_with_skonto')}>
                      <Percent className="h-4 w-4 mr-1" /> Bezahlt (Skonto)
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => handleBulk('sent')}>
                    <Send className="h-4 w-4 mr-1" /> Als versendet
                  </Button>
                  <Button size="sm" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => handleBulk('cancelled')}>
                    <XCircle className="h-4 w-4 mr-1" /> Stornieren
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Löschen
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                    Auswahl aufheben
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
            {loading ? (
              <p className="text-muted-foreground text-center py-8">Laden…</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">Keine Rechnungen vorhanden</p>
                <Button asChild variant="outline">
                  <Link to="/invoices/new">Erste Rechnung erstellen</Link>
                </Button>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked={allOnPageSelected} onCheckedChange={toggleAll} />
                      </TableHead>
                      {columns.number && <TableHead>Nr.</TableHead>}
                      {columns.customer && <TableHead>Kunde</TableHead>}
                      {columns.date && <TableHead>Datum</TableHead>}
                      {columns.due && <TableHead>Fällig</TableHead>}
                      {columns.category && <TableHead>Kategorie</TableHead>}
                      {columns.amount && <TableHead className="text-right">Betrag</TableHead>}
                      {columns.status && <TableHead>Status</TableHead>}
                      <TableHead className="w-10" />
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map(inv => {
                      const sc = STATUS_CONFIG[inv.status || 'draft'] || STATUS_CONFIG.draft;
                      const hasVersion = !!(inv as any).version;
                      const isSelected = selectedIds.has(inv.id);
                      return (
                        <TableRow key={inv.id} className={cn("cursor-pointer", isSelected && "bg-muted/50")} onClick={() => navigate(`/invoices/${inv.id}/edit`)}>
                          <TableCell onClick={e => e.stopPropagation()}>
                            <Checkbox checked={isSelected} onCheckedChange={() => toggleOne(inv.id)} />
                          </TableCell>
                          {columns.number && (
                            <TableCell className="font-medium">
                              {inv.invoice_number}
                              {hasVersion && <Badge variant="outline" className="ml-1 text-[10px]">{(inv as any).version}</Badge>}
                              {(inv as any).invoice_subtype && (inv as any).invoice_subtype !== 'normal' && (
                                <Badge variant="secondary" className="ml-1 text-[10px]">
                                  {{ deposit: 'Anzahlung', partial: 'Teilzahlung', final: 'Schlussrechnung' }[(inv as any).invoice_subtype] || ''}
                                </Badge>
                              )}
                            </TableCell>
                          )}
                          {columns.customer && <TableCell>{customerName(inv)}</TableCell>}
                          {columns.date && <TableCell>{fmtDate(inv.invoice_date)}</TableCell>}
                          {columns.due && <TableCell>{fmtDate(inv.due_date)}</TableCell>}
                          {columns.category && (
                            <TableCell>
                              {(inv as any).category ? (
                                <Badge variant="outline" className="text-xs">{(inv as any).category}</Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">–</span>
                              )}
                            </TableCell>
                          )}
                          {columns.amount && (
                            <TableCell className="text-right font-medium">
                              <div>{fmt(inv.total || 0)}</div>
                              {(inv.discount_percent ?? 0) > 0 && inv.total && (
                                <div className="text-xs text-muted-foreground font-normal">
                                  Skonto: {fmt(inv.total * (1 - (inv.discount_percent || 0) / 100))}
                                </div>
                              )}
                            </TableCell>
                          )}
                          {columns.status && (
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <Badge variant={sc.variant} className={inv.status === 'paid_with_skonto' ? 'border-green-500 text-green-700 dark:text-green-400' : ''}>
                                  {sc.label}
                                </Badge>
                                {inv.status === 'draft' && (inv as any).recurring_invoice_id && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <RefreshCw className="h-3.5 w-3.5 text-amber-500" />
                                    </TooltipTrigger>
                                    <TooltipContent>Wiederkehrend — wartet auf Freigabe</TooltipContent>
                                  </Tooltip>
                                )}
                                {inv.paid_at && (inv.status === 'paid' || inv.status === 'paid_with_skonto') && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Bezahlt am {new Date(inv.paid_at).toLocaleDateString('de-AT')}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>
                          )}
                          <TableCell>
                            {inv.pdf_storage_path && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); setPdfPreview({ open: true, path: inv.pdf_storage_path, number: inv.invoice_number }); }}>
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                                <DropdownMenuItem onClick={async () => {
                                  toast({ title: 'PDF wird erstellt…' });
                                  const { error } = await supabase.functions.invoke('generate-invoice-pdf', {
                                    body: { invoice_id: inv.id },
                                  });
                                  if (error) {
                                    toast({ title: 'Fehler', description: 'PDF konnte nicht erstellt werden', variant: 'destructive' });
                                  } else {
                                    toast({ title: 'PDF erstellt', description: 'Das PDF wurde generiert.' });
                                  }
                                }}>
                                  <Download className="h-4 w-4 mr-2" /> PDF generieren
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => copyInvoice(inv.id)}>
                                  <Copy className="h-4 w-4 mr-2" /> Kopieren
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => createCorrectionVersion(inv.id)}>
                                  <GitBranch className="h-4 w-4 mr-2" /> Korrektur erstellen
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => convertDocument(inv.id, 'delivery_note')}>
                                  <ArrowRight className="h-4 w-4 mr-2" /> In Lieferschein
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => createPartialInvoice(inv.id, 'deposit')}>
                                  <Receipt className="h-4 w-4 mr-2" /> Anzahlungsrechnung
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => createPartialInvoice(inv.id, 'partial')}>
                                  <Receipt className="h-4 w-4 mr-2" /> Teilrechnung
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => createPartialInvoice(inv.id, 'final')}>
                                  <Receipt className="h-4 w-4 mr-2" /> Schlussrechnung
                                </DropdownMenuItem>
                                {inv.status === 'draft' && (
                                  <DropdownMenuItem onClick={() => updateInvoiceStatus(inv.id, 'sent')}>
                                    <Send className="h-4 w-4 mr-2" /> Als versendet markieren
                                  </DropdownMenuItem>
                                )}
                                {(inv.status === 'sent' || inv.status === 'overdue') && (
                                  <>
                                    <DropdownMenuItem onClick={() => updateInvoiceStatus(inv.id, 'paid')}>
                                      <CheckCircle className="h-4 w-4 mr-2" /> Als bezahlt markieren
                                    </DropdownMenuItem>
                                    {(inv.discount_percent || 0) > 0 && (
                                      <DropdownMenuItem onClick={() => updateInvoiceStatus(inv.id, 'paid_with_skonto')}>
                                        <Percent className="h-4 w-4 mr-2" /> Bezahlt mit Skonto
                                      </DropdownMenuItem>
                                    )}
                                  </>
                                )}
                                {inv.status !== 'cancelled' && inv.status !== 'paid' && inv.status !== 'paid_with_skonto' && (
                                  <DropdownMenuItem onClick={() => updateInvoiceStatus(inv.id, 'cancelled')}>
                                    <XCircle className="h-4 w-4 mr-2" /> Stornieren
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={async () => {
                                    if (confirm(`Rechnung ${inv.invoice_number} wirklich löschen?`)) {
                                      await deleteInvoice(inv.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Löschen
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      {filtered.length} Rechnung(en) · Seite {paginatedPage} von {totalPages}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-8 w-8" disabled={paginatedPage <= 1} onClick={() => setCurrentPage(1)}>
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" disabled={paginatedPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" disabled={paginatedPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" disabled={paginatedPage >= totalPages} onClick={() => setCurrentPage(totalPages)}>
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

      </div>
      </FeatureGate>

      {/* Tax Export Dialog */}
      <TaxExportDialog
        open={taxExportOpen}
        onOpenChange={setTaxExportOpen}
        defaultBookingType="income"
      />
      <PdfPreviewDialog
        open={pdfPreview.open}
        onOpenChange={(open) => setPdfPreview(p => ({ ...p, open }))}
        pdfStoragePath={pdfPreview.path}
        invoiceNumber={pdfPreview.number}
      />

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{selectedIds.size} Rechnung(en) löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die ausgewählten Rechnungen werden unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Invoices;
