import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Upload, 
  Eye, 
  Pencil, 
  Trash2, 
  ChevronUp, 
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Check,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import { useReceipts, type Receipt } from '@/hooks/useReceipts';
import { useCategories } from '@/hooks/useCategories';
import { ReceiptDetailPanel } from '@/components/receipts/ReceiptDetailPanel';
import { motion } from 'framer-motion';

type SortField = 'receipt_date' | 'vendor' | 'amount_gross';
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE = 20;

const STATUS_CONFIG = {
  pending: { label: 'Wird verarbeitet', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  processing: { label: 'In Bearbeitung', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  review: { label: 'Überprüfen', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  approved: { label: 'Freigegeben', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  rejected: { label: 'Abgelehnt', color: 'bg-red-500/10 text-red-600 border-red-500/20' },
};

const Expenses = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getReceipts, updateReceipt, deleteReceipt } = useReceipts();
  const { categories } = useCategories();

  // Data state
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Sort state
  const [sortField, setSortField] = useState<SortField>('receipt_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Detail panel state
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);

  const openReceiptDetail = (id: string) => {
    setSelectedReceiptId(id);
    setDetailPanelOpen(true);
  };

  const closeReceiptDetail = () => {
    setDetailPanelOpen(false);
    setSelectedReceiptId(null);
  };

  // Load receipts
  const loadReceipts = async () => {
    setLoading(true);
    try {
      const data = await getReceipts({ 
        year: selectedYear, 
        month: selectedMonth 
      });
      setReceipts(data);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler beim Laden',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReceipts();
  }, [selectedMonth, selectedYear]);

  // Filter and sort receipts
  const filteredReceipts = useMemo(() => {
    let result = [...receipts];

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(r => r.status === statusFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter(r => r.category === categoryFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.vendor?.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query) ||
        r.file_name?.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal: string | number | null = null;
      let bVal: string | number | null = null;

      switch (sortField) {
        case 'receipt_date':
          aVal = a.receipt_date || a.created_at;
          bVal = b.receipt_date || b.created_at;
          break;
        case 'vendor':
          aVal = a.vendor?.toLowerCase() || '';
          bVal = b.vendor?.toLowerCase() || '';
          break;
        case 'amount_gross':
          aVal = a.amount_gross || 0;
          bVal = b.amount_gross || 0;
          break;
      }

      if (aVal === null || bVal === null) return 0;
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [receipts, statusFilter, categoryFilter, searchQuery, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredReceipts.length / ITEMS_PER_PAGE);
  const paginatedReceipts = filteredReceipts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, categoryFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = filteredReceipts.reduce((sum, r) => sum + (r.amount_gross || 0), 0);
    const vatSum = filteredReceipts.reduce((sum, r) => sum + (r.vat_amount || 0), 0);
    const count = filteredReceipts.length;
    const average = count > 0 ? total / count : 0;

    return { total, vatSum, count, average };
  }, [filteredReceipts]);

  // Handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUp className="h-4 w-4 inline ml-1" /> : 
      <ChevronDown className="h-4 w-4 inline ml-1" />;
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(paginatedReceipts.map(r => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleDeleteClick = (id: string) => {
    setReceiptToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!receiptToDelete) return;
    
    try {
      await deleteReceipt(receiptToDelete);
      setReceipts(prev => prev.filter(r => r.id !== receiptToDelete));
      toast({ title: 'Beleg gelöscht' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler beim Löschen',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    } finally {
      setDeleteDialogOpen(false);
      setReceiptToDelete(null);
    }
  };

  const handleBulkApprove = async () => {
    try {
      for (const id of selectedIds) {
        await updateReceipt(id, { status: 'approved' });
      }
      setReceipts(prev => prev.map(r => 
        selectedIds.has(r.id) ? { ...r, status: 'approved' as const } : r
      ));
      setSelectedIds(new Set());
      toast({ title: `${selectedIds.size} Belege freigegeben` });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    }
  };

  const handleBulkDelete = async () => {
    try {
      for (const id of selectedIds) {
        await deleteReceipt(id);
      }
      setReceipts(prev => prev.filter(r => !selectedIds.has(r.id)));
      const count = selectedIds.size;
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      toast({ title: `${count} Belege gelöscht` });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return '—';
    return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(value);
  };

  const truncateText = (text: string | null, maxLength = 40) => {
    if (!text) return '—';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  };

  const getCategoryColor = (categoryName: string | null) => {
    if (!categoryName) return null;
    const category = categories.find(c => c.name === categoryName);
    return category?.color || null;
  };

  // Generate month options
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: format(new Date(2024, i, 1), 'MMMM', { locale: de }),
  }));

  // Generate year options (last 5 years)
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);

  const isAllSelected = paginatedReceipts.length > 0 && 
    paginatedReceipts.every(r => selectedIds.has(r.id));

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-foreground">Alle Ausgaben</h1>
          <Button 
            className="gradient-primary hover:opacity-90"
            onClick={() => navigate('/upload')}
          >
            <Upload className="h-4 w-4 mr-2" />
            Beleg hochladen
          </Button>
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-3 mb-6"
        >
          <div className="flex gap-2">
            <Select 
              value={selectedMonth.toString()} 
              onValueChange={(v) => setSelectedMonth(parseInt(v))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(m => (
                  <SelectItem key={m.value} value={m.value.toString()}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select 
              value={selectedYear.toString()} 
              onValueChange={(v) => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Kategorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Kategorien</SelectItem>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Lieferant, Beschreibung..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Gesamt</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(stats.total)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Anzahl</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.count} Belege</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Vorsteuer</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(stats.vatSum)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Durchschnitt</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(stats.average)}</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex items-center gap-3 mb-4 p-3 bg-muted/50 rounded-lg"
          >
            <Badge variant="secondary">{selectedIds.size} ausgewählt</Badge>
            <Button size="sm" variant="outline" onClick={handleBulkApprove}>
              <Check className="h-4 w-4 mr-1" />
              Alle freigeben
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="text-destructive hover:text-destructive"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Löschen
            </Button>
          </motion.div>
        )}

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredReceipts.length === 0 ? (
                // Empty State
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    Noch keine Belege vorhanden
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Lade deinen ersten Beleg hoch
                  </p>
                  <Button 
                    className="gradient-primary hover:opacity-90"
                    onClick={() => navigate('/upload')}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Beleg hochladen
                  </Button>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={isAllSelected}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:text-foreground"
                          onClick={() => handleSort('receipt_date')}
                        >
                          Datum {getSortIcon('receipt_date')}
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:text-foreground"
                          onClick={() => handleSort('vendor')}
                        >
                          Lieferant {getSortIcon('vendor')}
                        </TableHead>
                        <TableHead>Beschreibung</TableHead>
                        <TableHead>Kategorie</TableHead>
                        <TableHead 
                          className="text-right cursor-pointer hover:text-foreground"
                          onClick={() => handleSort('amount_gross')}
                        >
                          Betrag {getSortIcon('amount_gross')}
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedReceipts.map((receipt) => (
                        <TableRow key={receipt.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(receipt.id)}
                              onCheckedChange={(checked) => 
                                handleSelectOne(receipt.id, checked as boolean)
                              }
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {receipt.receipt_date 
                              ? format(new Date(receipt.receipt_date), 'dd.MM.yyyy')
                              : format(new Date(receipt.created_at), 'dd.MM.yyyy')
                            }
                          </TableCell>
                          <TableCell>{receipt.vendor || '—'}</TableCell>
                          <TableCell className="max-w-[200px]">
                            {truncateText(receipt.description)}
                          </TableCell>
                          <TableCell>
                            {receipt.category ? (
                              <Badge 
                                variant="outline"
                                style={{ 
                                  borderColor: getCategoryColor(receipt.category) || undefined,
                                  color: getCategoryColor(receipt.category) || undefined,
                                }}
                              >
                                {receipt.category}
                              </Badge>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(receipt.amount_gross)}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={STATUS_CONFIG[receipt.status]?.color || ''}
                            >
                              {STATUS_CONFIG[receipt.status]?.label || receipt.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openReceiptDetail(receipt.id)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openReceiptDetail(receipt.id)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteClick(receipt.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Zeige {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
                        {Math.min(currentPage * ITEMS_PER_PAGE, filteredReceipts.length)} von {filteredReceipts.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum: number;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? 'default' : 'outline'}
                              size="icon"
                              onClick={() => setCurrentPage(pageNum)}
                              className={currentPage === pageNum ? 'gradient-primary' : ''}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Beleg löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser Beleg wird unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{selectedIds.size} Belege löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Belege werden unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              {selectedIds.size} Belege löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Receipt Detail Panel */}
      <ReceiptDetailPanel
        receiptId={selectedReceiptId}
        open={detailPanelOpen}
        onClose={closeReceiptDetail}
        onUpdate={loadReceipts}
      />
    </DashboardLayout>
  );
};

export default Expenses;
