import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  X,
  Filter,
  Sparkles,
  CalendarIcon,
  Download,
  FileSpreadsheet,
  FileDown,
  Archive,
  Columns3,
  Hash,
  Loader2,
  RotateCcw,
  Settings2,
  ScanSearch,
  AlertTriangle,
  CheckCircle,
  GitCompare,
  Square,
  RefreshCw,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, startOfQuarter, endOfQuarter } from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Separator } from '@/components/ui/separator';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import { useReceipts, type Receipt } from '@/hooks/useReceipts';
import { useCategories } from '@/hooks/useCategories';
import { ReceiptDetailPanel } from '@/components/receipts/ReceiptDetailPanel';
import { ReceiptPreviewDialog } from '@/components/receipts/ReceiptPreviewDialog';
import { DuplicateComparisonModal } from '@/components/receipts/DuplicateComparisonModal';
import { ExportDialog } from '@/components/exports/ExportDialog';
import { ExportFormatDialog, type ExportFormat } from '@/components/exports/ExportFormatDialog';
import { ExportTemplateEditor } from '@/components/exports/ExportTemplateEditor';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Copy, Scissors, Layers } from 'lucide-react';
import { checkForDuplicates, type DuplicateCheckResult } from '@/services/duplicateDetectionService';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { extractReceiptData, normalizeExtractionResult } from '@/services/aiService';
import { useAuth } from '@/contexts/AuthContext';
import { SplitSuggestionDialog } from '@/components/receipts/SplitSuggestionDialog';
import { SourceBadge, NoReceiptBadge } from '@/components/receipts/SourceBadge';

type SortField = 'receipt_date' | 'vendor' | 'invoice_number' | 'amount_gross';
type SortDirection = 'asc' | 'desc';

type ColumnKey = 'date' | 'vendor' | 'invoice_number' | 'description' | 'category' | 'amount' | 'ai' | 'status';

const COLUMN_CONFIG: { key: ColumnKey; label: string; defaultVisible: boolean }[] = [
  { key: 'date', label: 'Datum', defaultVisible: true },
  { key: 'vendor', label: 'Lieferant', defaultVisible: true },
  { key: 'invoice_number', label: 'Rechnungsnr.', defaultVisible: true },
  { key: 'description', label: 'Beschreibung', defaultVisible: true },
  { key: 'category', label: 'Kategorie', defaultVisible: true },
  { key: 'amount', label: 'Betrag', defaultVisible: true },
  { key: 'ai', label: 'KI', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
];

const INVOICE_FILTER_OPTIONS = [
  { value: 'all', label: 'Alle' },
  { value: 'with', label: 'Mit Rechnungsnr.' },
  { value: 'without', label: 'Ohne Rechnungsnr.' },
];

const ITEMS_PER_PAGE = 20;

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Wird verarbeitet', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  processing: { label: 'In Bearbeitung', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  review: { label: 'Überprüfen', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  approved: { label: 'Freigegeben', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  rejected: { label: 'Abgelehnt', color: 'bg-red-500/10 text-red-600 border-red-500/20' },
  duplicate: { label: 'Duplikat', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  not_a_receipt: { label: 'Kein Beleg', color: 'bg-gray-500/10 text-gray-600 border-gray-500/20' },
  error: { label: 'Fehler', color: 'bg-red-500/10 text-red-600 border-red-500/20' },
  needs_splitting: { label: 'Aufteilen', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  split: { label: 'Aufgeteilt', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
};

type DateRangePreset = 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear' | 'lastYear' | 'all' | 'custom';

const DATE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'thisMonth', label: 'Dieser Monat' },
  { value: 'lastMonth', label: 'Letzter Monat' },
  { value: 'thisQuarter', label: 'Dieses Quartal' },
  { value: 'thisYear', label: 'Dieses Jahr' },
  { value: 'lastYear', label: 'Letztes Jahr' },
  { value: 'all', label: 'Alle' },
];

const getPresetDates = (preset: DateRangePreset): { from: Date | undefined; to: Date | undefined } => {
  const now = new Date();
  switch (preset) {
    case 'thisMonth':
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'lastMonth':
      const lastMonth = subMonths(now, 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    case 'thisQuarter':
      return { from: startOfQuarter(now), to: endOfQuarter(now) };
    case 'thisYear':
      return { from: startOfYear(now), to: endOfYear(now) };
    case 'lastYear':
      const lastYear = new Date(now.getFullYear() - 1, 0, 1);
      return { from: startOfYear(lastYear), to: endOfYear(lastYear) };
    case 'all':
      return { from: undefined, to: undefined };
    case 'custom':
    default:
      return { from: undefined, to: undefined };
  }
};

const Expenses = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const { getReceipts, updateReceipt, rejectReceipt, deleteReceipt, processReceiptWithAI } = useReceipts();
  const { categories } = useCategories();

  // Data state
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  // Date range filter state
  const currentDate = new Date();
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => {
    const fromParam = searchParams.get('from');
    return fromParam ? new Date(fromParam) : startOfMonth(currentDate);
  });
  const [dateTo, setDateTo] = useState<Date | undefined>(() => {
    const toParam = searchParams.get('to');
    return toParam ? new Date(toParam) : endOfMonth(currentDate);
  });
  const [datePreset, setDatePreset] = useState<DateRangePreset>(() => {
    if (searchParams.get('from') || searchParams.get('to')) return 'custom';
    return 'thisMonth';
  });

  // Other filter state
  const [statusFilter, setStatusFilter] = useState<string>(() => 
    searchParams.get('status') || 'all'
  );
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [invoiceFilter, setInvoiceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(() => {
    const saved = localStorage.getItem('expenses-visible-columns');
    if (saved) {
      try {
        return new Set(JSON.parse(saved) as ColumnKey[]);
      } catch {
        return new Set(COLUMN_CONFIG.filter(c => c.defaultVisible).map(c => c.key));
      }
    }
    return new Set(COLUMN_CONFIG.filter(c => c.defaultVisible).map(c => c.key));
  });

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

  // Export dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportEditorOpen, setExportEditorOpen] = useState(false);
  const [exportFormatDialogOpen, setExportFormatDialogOpen] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState<ExportFormat>('csv');

  // Detail panel state (edit mode)
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);

  // Preview dialog state (view only)
  const [previewReceiptId, setPreviewReceiptId] = useState<string | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  // Duplicate comparison state
  const [duplicateComparisonOpen, setDuplicateComparisonOpen] = useState(false);
  const [duplicateComparisonIds, setDuplicateComparisonIds] = useState<{ duplicateId: string | null; originalId: string | null }>({
    duplicateId: null,
    originalId: null
  });

  // Manual duplicate check state
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [checkProgress, setCheckProgress] = useState({ current: 0, total: 0 });
  interface FoundDuplicate {
    duplicate: Receipt;
    originalId: string;
    score: number;
    matchType: DuplicateCheckResult['matchType'];
    matchReasons: string[];
  }
  const [foundDuplicates, setFoundDuplicates] = useState<FoundDuplicate[]>([]);
  const [showDuplicateResults, setShowDuplicateResults] = useState(false);

  // Split suggestion dialog state
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [splitDialogReceipt, setSplitDialogReceipt] = useState<Receipt | null>(null);

  const openSplitDialog = (receipt: Receipt) => {
    setSplitDialogReceipt(receipt);
    setSplitDialogOpen(true);
  };

  const closeSplitDialog = () => {
    setSplitDialogOpen(false);
    setSplitDialogReceipt(null);
    loadReceipts();
  };

  const openReceiptDetail = (id: string) => {
    setSelectedReceiptId(id);
    setDetailPanelOpen(true);
  };

  const closeReceiptDetail = () => {
    setDetailPanelOpen(false);
    setSelectedReceiptId(null);
  };

  const openReceiptPreview = (id: string) => {
    setPreviewReceiptId(id);
    setPreviewDialogOpen(true);
  };

  const closeReceiptPreview = () => {
    setPreviewDialogOpen(false);
    setPreviewReceiptId(null);
  };

  const openDuplicateComparison = (duplicateId: string, originalId: string) => {
    setDuplicateComparisonIds({ duplicateId, originalId });
    setDuplicateComparisonOpen(true);
  };

  const markAsNotDuplicate = async (receiptId: string) => {
    try {
      await updateReceipt(receiptId, {
        is_duplicate: false,
        duplicate_of: null,
        duplicate_score: null,
        status: 'review'
      } as Partial<Receipt>);
      toast({
        title: 'Aktualisiert',
        description: 'Beleg ist kein Duplikat mehr',
      });
      loadReceipts();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Konnte Status nicht aktualisieren',
      });
    }
  };

  // Mark as actual receipt and re-analyze
  const handleMarkAsReceipt = async (receiptId: string) => {
    try {
      // Set status to processing
      await supabase
        .from('receipts')
        .update({ status: 'processing', notes: null })
        .eq('id', receiptId);

      toast({
        title: 'Wird erneut geprüft',
        description: 'Das Dokument wird nochmal analysiert.',
      });

      // Trigger re-extraction with forceExtract flag
      const { error } = await supabase.functions.invoke('extract-receipt', {
        body: { receiptId, forceExtract: true }
      });

      if (error) {
        console.error('Re-extraction error:', error);
        toast({
          variant: 'destructive',
          title: 'Fehler bei der Analyse',
          description: error.message,
        });
      }

      loadReceipts();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    }
  };

  // Manual duplicate check function
  const startDuplicateCheck = async () => {
    if (!user?.id) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Benutzer nicht angemeldet',
      });
      return;
    }

    setIsCheckingDuplicates(true);
    setFoundDuplicates([]);

    try {
      // Get all receipts in the selected date range that are not already marked as duplicates
      const { data: receiptsToCheck, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_duplicate', false)
        .order('receipt_date', { ascending: false });

      if (error) throw error;

      const receiptsList = receiptsToCheck || [];
      setCheckProgress({ current: 0, total: receiptsList.length });

      const duplicatesFound: FoundDuplicate[] = [];

      // Check each receipt
      for (let i = 0; i < receiptsList.length; i++) {
        const receipt = receiptsList[i];
        setCheckProgress({ current: i + 1, total: receiptsList.length });

        // Check for duplicates (only against older receipts)
        const result = await checkForDuplicates(
          user.id,
          receipt.file_hash,
          {
            vendor: receipt.vendor,
            amount_gross: receipt.amount_gross,
            receipt_date: receipt.receipt_date,
            invoice_number: receipt.invoice_number
          },
          receipt.id
        );

        if (result.isDuplicate && result.score >= 70 && result.duplicateOf) {
          duplicatesFound.push({
            duplicate: receipt as Receipt,
            originalId: result.duplicateOf,
            score: result.score,
            matchType: result.matchType,
            matchReasons: result.matchReasons
          });

          // Mark as duplicate in DB
          await supabase
            .from('receipts')
            .update({
              is_duplicate: true,
              duplicate_of: result.duplicateOf,
              duplicate_score: result.score,
              duplicate_checked_at: new Date().toISOString()
            })
            .eq('id', receipt.id);
        } else {
          // Mark as checked
          await supabase
            .from('receipts')
            .update({
              duplicate_checked_at: new Date().toISOString()
            })
            .eq('id', receipt.id);
        }
      }

      setFoundDuplicates(duplicatesFound);

      if (duplicatesFound.length > 0) {
        setShowDuplicateResults(true);
      } else {
        toast({
          title: 'Keine Duplikate gefunden',
          description: 'Alle Belege im Zeitraum sind einzigartig',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler bei der Duplikat-Prüfung',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
      console.error(error);
    } finally {
      setIsCheckingDuplicates(false);
      loadReceipts();
    }
  };

  // Bulk mark as not duplicate
  const bulkMarkAsNotDuplicate = async () => {
    try {
      for (const id of selectedIds) {
        await updateReceipt(id, {
          is_duplicate: false,
          duplicate_of: null,
          duplicate_score: null,
          status: 'review'
        } as Partial<Receipt>);
      }
      const count = selectedIds.size;
      setSelectedIds(new Set());
      toast({ title: `${count} Belege als "Kein Duplikat" markiert` });
      loadReceipts();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    }
  };

  // Bulk delete duplicates
  const bulkDeleteDuplicates = async () => {
    try {
      for (const id of selectedIds) {
        const receipt = receipts.find(r => r.id === id);
        if (receipt?.file_url) {
          await supabase.storage.from('receipts').remove([receipt.file_url.replace(/^.*\/receipts\//, '')]);
        }
        await deleteReceipt(id);
      }
      const count = selectedIds.size;
      setSelectedIds(new Set());
      toast({ title: `${count} Duplikate gelöscht` });
      loadReceipts();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    }
  };

  // Load receipts
  const loadReceipts = async () => {
    setLoading(true);
    try {
      const data = await getReceipts({ 
        dateFrom: dateFrom ? format(dateFrom, 'yyyy-MM-dd') : undefined,
        dateTo: dateTo ? format(dateTo, 'yyyy-MM-dd') : undefined,
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

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('from', format(dateFrom, 'yyyy-MM-dd'));
    if (dateTo) params.set('to', format(dateTo, 'yyyy-MM-dd'));
    if (statusFilter !== 'all') params.set('status', statusFilter);
    setSearchParams(params, { replace: true });
  }, [dateFrom, dateTo, statusFilter, setSearchParams]);

  useEffect(() => {
    loadReceipts();
  }, [dateFrom, dateTo]);

  // Handle URL-based duplicate comparison (from ReceiptDetailPanel link)
  useEffect(() => {
    const duplicateId = searchParams.get('duplicateCompare');
    const originalId = searchParams.get('original');
    
    if (duplicateId && originalId) {
      openDuplicateComparison(duplicateId, originalId);
      // Clear URL params after opening
      const params = new URLSearchParams(searchParams);
      params.delete('duplicateCompare');
      params.delete('original');
      setSearchParams(params, { replace: true });
    }
  }, [searchParams]);

  // Handle preset selection
  const handlePresetChange = (preset: DateRangePreset) => {
    setDatePreset(preset);
    const { from, to } = getPresetDates(preset);
    setDateFrom(from);
    setDateTo(to);
  };

  // Handle manual date changes
  const handleDateFromChange = (date: Date | undefined) => {
    setDateFrom(date);
    setDatePreset('custom');
  };

  const handleDateToChange = (date: Date | undefined) => {
    setDateTo(date);
    setDatePreset('custom');
  };

  // Validate date range
  const isValidDateRange = !dateFrom || !dateTo || dateFrom <= dateTo;

  // Duplicate count
  const duplicateCount = useMemo(() => {
    return receipts.filter(r => r.is_duplicate === true).length;
  }, [receipts]);

  // Filter and sort receipts
  const filteredReceipts = useMemo(() => {
    let result = [...receipts];

    // Status filter - special handling for 'duplicate'
    if (statusFilter === 'duplicate') {
      result = result.filter(r => r.is_duplicate === true);
    } else if (statusFilter !== 'all') {
      result = result.filter(r => r.status === statusFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter(r => r.category === categoryFilter);
    }

    // Invoice number filter
    if (invoiceFilter === 'with') {
      result = result.filter(r => r.invoice_number && r.invoice_number.trim() !== '');
    } else if (invoiceFilter === 'without') {
      result = result.filter(r => !r.invoice_number || r.invoice_number.trim() === '');
    }

    // Search filter (extended to include invoice_number and vendor_brand)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.vendor?.toLowerCase().includes(query) ||
        r.vendor_brand?.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query) ||
        r.invoice_number?.toLowerCase().includes(query) ||
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
        case 'invoice_number':
          aVal = a.invoice_number?.toLowerCase() || '';
          bVal = b.invoice_number?.toLowerCase() || '';
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
  }, [statusFilter, categoryFilter, invoiceFilter, searchQuery]);

  // Save column visibility to localStorage
  useEffect(() => {
    localStorage.setItem('expenses-visible-columns', JSON.stringify(Array.from(visibleColumns)));
  }, [visibleColumns]);

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

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

  // Bulk action states
  const [bulkActionLoading, setBulkActionLoading] = useState<'approve' | 'reject' | 'review' | 'ai' | 'duplicateCheck' | null>(null);
  const [aiProgress, setAiProgress] = useState<{ current: number; total: number } | null>(null);
  const [showBulkReanalyzeConfirm, setShowBulkReanalyzeConfirm] = useState(false);

  // Fields that can be reanalyzed
  const REANALYZABLE_FIELDS = [
    'vendor', 'invoice_number', 'receipt_date', 
    'amount_gross', 'amount_net', 'vat_rate', 'vat_amount', 
    'description'
  ] as const;

  // Check selected receipts for duplicates
  const startSelectedDuplicateCheck = async () => {
    if (!user?.id || selectedIds.size === 0) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: selectedIds.size === 0 ? 'Keine Belege ausgewählt' : 'Benutzer nicht angemeldet',
      });
      return;
    }

    setBulkActionLoading('duplicateCheck');
    setFoundDuplicates([]);

    try {
      // Get selected receipts that are not already marked as duplicates
      const selectedReceipts = receipts.filter(r => 
        selectedIds.has(r.id) && r.is_duplicate !== true
      );

      if (selectedReceipts.length === 0) {
        toast({
          title: 'Keine prüfbaren Belege',
          description: 'Alle ausgewählten Belege sind bereits als Duplikate markiert',
        });
        setBulkActionLoading(null);
        return;
      }

      setCheckProgress({ current: 0, total: selectedReceipts.length });

      const duplicatesFound: FoundDuplicate[] = [];

      // Check each selected receipt
      for (let i = 0; i < selectedReceipts.length; i++) {
        const receipt = selectedReceipts[i];
        setCheckProgress({ current: i + 1, total: selectedReceipts.length });

        // Check for duplicates
        const result = await checkForDuplicates(
          user.id,
          receipt.file_hash,
          {
            vendor: receipt.vendor,
            amount_gross: receipt.amount_gross,
            receipt_date: receipt.receipt_date,
            invoice_number: receipt.invoice_number
          },
          receipt.id
        );

        if (result.isDuplicate && result.score >= 70 && result.duplicateOf) {
          duplicatesFound.push({
            duplicate: receipt,
            originalId: result.duplicateOf,
            score: result.score,
            matchType: result.matchType,
            matchReasons: result.matchReasons
          });

          // Mark as duplicate in DB
          await supabase
            .from('receipts')
            .update({
              is_duplicate: true,
              duplicate_of: result.duplicateOf,
              duplicate_score: result.score,
              duplicate_checked_at: new Date().toISOString()
            })
            .eq('id', receipt.id);
        } else {
          // Mark as checked
          await supabase
            .from('receipts')
            .update({
              duplicate_checked_at: new Date().toISOString()
            })
            .eq('id', receipt.id);
        }
      }

      setFoundDuplicates(duplicatesFound);
      setSelectedIds(new Set());

      if (duplicatesFound.length > 0) {
        setShowDuplicateResults(true);
      } else {
        toast({
          title: 'Keine Duplikate gefunden',
          description: `${selectedReceipts.length} ausgewählte Belege sind einzigartig`,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler bei der Duplikat-Prüfung',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
      console.error(error);
    } finally {
      setBulkActionLoading(null);
      loadReceipts();
    }
  };

  const handleBulkApprove = async () => {
    setBulkActionLoading('approve');
    try {
      for (const id of selectedIds) {
        await updateReceipt(id, { status: 'approved' });
      }
      setReceipts(prev => prev.map(r => 
        selectedIds.has(r.id) ? { ...r, status: 'approved' as const } : r
      ));
      const count = selectedIds.size;
      setSelectedIds(new Set());
      toast({ title: `${count} Belege freigegeben` });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    } finally {
      setBulkActionLoading(null);
    }
  };

  const handleBulkReview = async () => {
    setBulkActionLoading('review');
    try {
      for (const id of selectedIds) {
        await updateReceipt(id, { status: 'review' });
      }
      setReceipts(prev => prev.map(r => 
        selectedIds.has(r.id) ? { ...r, status: 'review' as const } : r
      ));
      const count = selectedIds.size;
      setSelectedIds(new Set());
      toast({ title: `${count} Belege zur Überprüfung` });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    } finally {
      setBulkActionLoading(null);
    }
  };

  const handleBulkReject = async () => {
    setBulkActionLoading('reject');
    try {
      for (const id of selectedIds) {
        // Use rejectReceipt to clear file_hash for re-upload capability
        await rejectReceipt(id, { deleteFile: true, reason: 'Manuell abgelehnt (Massenverarbeitung)' });
      }
      setReceipts(prev => prev.map(r => 
        selectedIds.has(r.id) ? { ...r, status: 'rejected' as const, file_hash: null } : r
      ));
      const count = selectedIds.size;
      setSelectedIds(new Set());
      toast({ 
        title: `${count} Belege abgelehnt`,
        description: 'Dateien können erneut hochgeladen werden'
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    } finally {
      setBulkActionLoading(null);
    }
  };

  const handleBulkRerunAI = async () => {
    setBulkActionLoading('ai');
    const selectedReceipts = receipts.filter(r => selectedIds.has(r.id));
    const total = selectedReceipts.length;
    let current = 0;
    let successCount = 0;
    let failCount = 0;

    setAiProgress({ current: 0, total });

    try {
      for (const receipt of selectedReceipts) {
        current++;
        setAiProgress({ current, total });

        if (!receipt.file_url) {
          failCount++;
          continue;
        }

        try {
          // Fetch the file from storage
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('receipts')
            .download(receipt.file_url.replace(/^.*\/receipts\//, ''));

          if (downloadError || !fileData) {
            failCount++;
            continue;
          }

          // Create a File object from the blob
          const file = new File([fileData], receipt.file_name || 'receipt', {
            type: receipt.file_type || 'application/pdf',
          });

          // Process with AI (file first, then receiptId)
          const result = await processReceiptWithAI(file, receipt.id);
          
          if (result.aiSuccess) {
            // Update local state with new data
            setReceipts(prev => prev.map(r => 
              r.id === receipt.id ? result.receipt : r
            ));
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          console.error('AI re-run failed for receipt:', receipt.id, err);
          failCount++;
        }
      }

      setSelectedIds(new Set());
      
      if (successCount > 0 && failCount === 0) {
        toast({ title: `${successCount} Belege neu analysiert` });
      } else if (successCount > 0 && failCount > 0) {
        toast({ 
          title: `${successCount} erfolgreich, ${failCount} fehlgeschlagen`,
          variant: 'default'
        });
      } else {
        toast({ 
          title: 'KI-Analyse fehlgeschlagen',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler bei KI-Analyse',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    } finally {
      setBulkActionLoading(null);
      setAiProgress(null);
    }
  };

  // Bulk AI reanalyze with modes
  const bulkReanalyze = async (mode: 'smart' | 'empty' | 'full') => {
    setBulkActionLoading('ai');
    const selectedReceiptsList = receipts.filter(r => selectedIds.has(r.id));
    const total = selectedReceiptsList.length;
    
    setAiProgress({ current: 0, total });

    const results = { success: 0, skipped: 0, failed: 0 };

    for (let i = 0; i < selectedReceiptsList.length; i++) {
      const receipt = selectedReceiptsList[i];
      setAiProgress({ current: i + 1, total });

      try {
        if (!receipt.file_url) {
          results.skipped++;
          continue;
        }

        // Determine which fields to analyze based on mode
        let fieldsToAnalyze: string[];

        switch (mode) {
          case 'smart':
            // Only fields the user has NOT manually modified
            fieldsToAnalyze = REANALYZABLE_FIELDS
              .filter(id => !receipt.user_modified_fields?.includes(id));
            break;
          
          case 'empty':
            // Only empty fields
            fieldsToAnalyze = REANALYZABLE_FIELDS
              .filter(id => {
                const value = receipt[id as keyof Receipt];
                return !value || value === '';
              });
            break;
          
          case 'full':
            // All fields
            fieldsToAnalyze = [...REANALYZABLE_FIELDS];
            break;
        }

        if (fieldsToAnalyze.length === 0) {
          results.skipped++;
          continue;
        }

        // Fetch the file from storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('receipts')
          .download(receipt.file_url.replace(/^.*\/receipts\//, ''));

        if (downloadError || !fileData) {
          results.failed++;
          continue;
        }

        // Create a File object from the blob
        const file = new File([fileData], receipt.file_name || 'receipt', {
          type: receipt.file_type || 'application/pdf',
        });

        // Run AI extraction
        const extracted = await extractReceiptData(file);
        const normalized = normalizeExtractionResult(extracted);

        // Build updates only for selected fields
        const updates: Record<string, unknown> = {};
        for (const fieldId of fieldsToAnalyze) {
          const newValue = normalized[fieldId as keyof typeof normalized];
          if (newValue !== undefined && newValue !== null) {
            updates[fieldId] = newValue;
          }
        }

        if (Object.keys(updates).length > 0) {
          // Update database
          await supabase
            .from('receipts')
            .update({
              ...updates,
              ai_confidence: normalized.confidence,
              ai_processed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', receipt.id);

          // Update local state
          setReceipts(prev => prev.map(r =>
            r.id === receipt.id 
              ? { ...r, ...updates, ai_confidence: normalized.confidence } as Receipt
              : r
          ));

          results.success++;
        } else {
          results.skipped++;
        }
      } catch (error) {
        console.error(`Fehler bei Beleg ${receipt.id}:`, error);
        results.failed++;
      }
    }

    // Feedback
    const modeLabels = {
      smart: 'Intelligente Analyse',
      empty: 'Leere Felder gefüllt',
      full: 'Komplett-Analyse'
    };

    if (results.success > 0) {
      toast({
        title: `${modeLabels[mode]} abgeschlossen`,
        description: `✓ ${results.success} aktualisiert${results.skipped > 0 ? ` · ${results.skipped} übersprungen` : ''}${results.failed > 0 ? ` · ${results.failed} fehlgeschlagen` : ''}`,
      });
    } else if (results.skipped === total) {
      toast({
        title: 'Keine Änderungen',
        description: mode === 'smart' 
          ? 'Alle Felder wurden bereits manuell bearbeitet'
          : mode === 'empty' 
            ? 'Alle Felder haben bereits Werte'
            : 'Keine Daten zu aktualisieren',
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Analyse fehlgeschlagen',
        description: `${results.failed} Belege konnten nicht analysiert werden`,
      });
    }

    setBulkActionLoading(null);
    setAiProgress(null);
    setSelectedIds(new Set());
    loadReceipts();
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

  const isAllSelected = paginatedReceipts.length > 0 && 
    paginatedReceipts.every(r => selectedIds.has(r.id));

  // Format date range for display
  const dateRangeLabel = useMemo(() => {
    if (!dateFrom && !dateTo) return 'Alle Zeiträume';
    if (dateFrom && dateTo) {
      return `${format(dateFrom, 'dd.MM.yyyy', { locale: de })} - ${format(dateTo, 'dd.MM.yyyy', { locale: de })}`;
    }
    if (dateFrom) return `Ab ${format(dateFrom, 'dd.MM.yyyy', { locale: de })}`;
    if (dateTo) return `Bis ${format(dateTo, 'dd.MM.yyyy', { locale: de })}`;
    return '';
  }, [dateFrom, dateTo]);

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-foreground">Alle Ausgaben</h1>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Exportieren
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => {
                  setSelectedExportFormat('csv');
                  setExportFormatDialogOpen(true);
                }}>
                  <FileText className="h-4 w-4 mr-2" />
                  Als CSV exportieren
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  setSelectedExportFormat('excel');
                  setExportFormatDialogOpen(true);
                }}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Als Excel exportieren
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  setSelectedExportFormat('pdf');
                  setExportFormatDialogOpen(true);
                }}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Als PDF exportieren
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setExportDialogOpen(true)}>
                  <Archive className="h-4 w-4 mr-2" />
                  Belege als ZIP
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings?tab=export')}>
                  <Settings2 className="h-4 w-4 mr-2" />
                  Vorlagen verwalten
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button 
              className="gradient-primary hover:opacity-90"
              onClick={() => navigate('/upload')}
            >
              <Upload className="h-4 w-4 mr-2" />
              Beleg hochladen
            </Button>
          </div>
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-end gap-3 mb-6"
        >
          {/* Date Range Filters */}
          <div className="flex flex-wrap gap-2 items-end">
            {/* Von Datepicker */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Von</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[130px] justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground",
                      !isValidDateRange && "border-destructive"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, 'dd.MM.yyyy') : 'Anfang'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={handleDateFromChange}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Bis Datepicker */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Bis</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[130px] justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground",
                      !isValidDateRange && "border-destructive"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, 'dd.MM.yyyy') : 'Heute'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={handleDateToChange}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Quick Select */}
            <Select value={datePreset} onValueChange={(v) => handlePresetChange(v as DateRangePreset)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Zeitraum" />
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map(preset => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
                {datePreset === 'custom' && (
                  <SelectItem value="custom">Benutzerdefiniert</SelectItem>
                )}
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
              {Object.entries(STATUS_CONFIG).filter(([key]) => key !== 'duplicate').map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
              <SelectSeparator />
              <SelectItem value="duplicate">
                <div className="flex items-center">
                  <Copy className="w-4 h-4 mr-2 text-warning" />
                  Duplikate {duplicateCount > 0 && `(${duplicateCount})`}
                </div>
              </SelectItem>
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

          <Select value={invoiceFilter} onValueChange={setInvoiceFilter}>
            <SelectTrigger className="w-[160px]">
              <Hash className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Rechnungsnr." />
            </SelectTrigger>
            <SelectContent>
              {INVOICE_FILTER_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Lieferant, Beschreibung, Rechnungsnr..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Column Visibility Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" title="Spalten ein-/ausblenden">
                <Columns3 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {COLUMN_CONFIG.map(col => (
                <DropdownMenuItem
                  key={col.key}
                  onClick={(e) => {
                    e.preventDefault();
                    toggleColumn(col.key);
                  }}
                  className="flex items-center gap-2"
                >
                  <Checkbox 
                    checked={visibleColumns.has(col.key)} 
                    className="pointer-events-none"
                  />
                  <span>{col.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Duplicate Check Button */}
          <Button 
            variant="outline"
            onClick={startDuplicateCheck}
            disabled={isCheckingDuplicates || loading}
            title="Duplikate im gesamten Belegbestand suchen"
          >
            {isCheckingDuplicates ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ScanSearch className="w-4 h-4 mr-2" />
            )}
            Duplikate prüfen
          </Button>
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
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Gesamt im Zeitraum
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(stats.total)}</p>
              <p className="text-xs text-muted-foreground mt-1">{dateRangeLabel}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Anzahl</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.count} Belege</p>
              <p className="text-xs text-muted-foreground mt-1">{dateRangeLabel}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Vorsteuer</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(stats.vatSum)}</p>
              <p className="text-xs text-muted-foreground mt-1">{dateRangeLabel}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Durchschnitt</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(stats.average)}</p>
              <p className="text-xs text-muted-foreground mt-1">pro Beleg</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Duplicate Warning Card */}
        {duplicateCount > 0 && statusFilter !== 'duplicate' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="mb-4 border-warning/30 bg-warning/5">
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-warning/10 rounded-full">
                      <Copy className="w-5 h-5 text-warning" />
                    </div>
                    <div>
                      <p className="font-medium text-warning">
                        {duplicateCount} mögliche{duplicateCount === 1 ? 's' : ''} Duplikat{duplicateCount === 1 ? '' : 'e'} gefunden
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Überprüfe diese Belege und lösche Duplikate
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setStatusFilter('duplicate')}
                    className="border-warning/30 text-warning hover:bg-warning/10"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Alle anzeigen
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-muted/50 rounded-lg"
          >
            <Badge variant="secondary">{selectedIds.size} ausgewählt</Badge>
            
            {/* Approve */}
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleBulkApprove}
              disabled={bulkActionLoading !== null}
              className="border-green-500/50 text-green-600 hover:bg-green-50 hover:text-green-700"
            >
              {bulkActionLoading === 'approve' ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-1" />
              )}
              Freigeben
            </Button>
            
            {/* Review */}
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleBulkReview}
              disabled={bulkActionLoading !== null}
              className="border-blue-500/50 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
            >
              {bulkActionLoading === 'review' ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Eye className="h-4 w-4 mr-1" />
              )}
              Überprüfen
            </Button>
            
            {/* Reject */}
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleBulkReject}
              disabled={bulkActionLoading !== null}
              className="border-orange-500/50 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
            >
              {bulkActionLoading === 'reject' ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <X className="h-4 w-4 mr-1" />
              )}
              Ablehnen
            </Button>
            
            {/* Re-run AI with modes */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  size="sm" 
                  variant="outline"
                  disabled={bulkActionLoading !== null}
                  className="border-violet-500/50 text-violet-600 hover:bg-violet-50 hover:text-violet-700"
                >
                  {bulkActionLoading === 'ai' ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      {aiProgress && `${aiProgress.current}/${aiProgress.total}`}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-1" />
                      KI-Analyse
                      <ChevronDown className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                  Analyse-Modus
                </DropdownMenuLabel>
                
                <DropdownMenuItem onClick={() => bulkReanalyze('smart')}>
                  <Sparkles className="w-4 h-4 mr-2 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium">Intelligent</p>
                    <p className="text-xs text-muted-foreground">Schützt manuell bearbeitete Felder</p>
                  </div>
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={() => bulkReanalyze('empty')}>
                  <Square className="w-4 h-4 mr-2 text-blue-500" />
                  <div className="flex-1">
                    <p className="font-medium">Nur leere Felder</p>
                    <p className="text-xs text-muted-foreground">Füllt nur fehlende Werte</p>
                  </div>
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem 
                  onClick={() => setShowBulkReanalyzeConfirm(true)}
                  className="text-orange-600 focus:text-orange-600"
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  <div className="flex-1">
                    <p className="font-medium">Komplett neu</p>
                    <p className="text-xs text-orange-400">Überschreibt alle Felder</p>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Compare 2 selected receipts */}
            {selectedIds.size === 2 && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  const ids = Array.from(selectedIds);
                  openDuplicateComparison(ids[0], ids[1]);
                }}
                disabled={bulkActionLoading !== null}
                className="border-primary/50 text-primary hover:bg-primary/10"
              >
                <GitCompare className="h-4 w-4 mr-1" />
                Vergleichen
              </Button>
            )}
            
            {/* Duplicate Check for selected */}
            <Button 
              size="sm" 
              variant="outline"
              onClick={startSelectedDuplicateCheck}
              disabled={bulkActionLoading !== null}
              className="border-amber-500/50 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
            >
              {bulkActionLoading === 'duplicateCheck' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  {checkProgress.current}/{checkProgress.total}
                </>
              ) : (
                <>
                  <ScanSearch className="h-4 w-4 mr-1" />
                  Duplikate prüfen
                </>
              )}
            </Button>
            
            <div className="h-4 w-px bg-border" />
            {/* Delete */}
            <Button 
              size="sm" 
              variant="outline" 
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={bulkActionLoading !== null}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Löschen
            </Button>

            {/* Duplicate-specific bulk actions */}
            {statusFilter === 'duplicate' && (
              <>
                <div className="h-4 w-px bg-border" />
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={bulkMarkAsNotDuplicate}
                  disabled={bulkActionLoading !== null}
                  className="border-warning/50 text-warning hover:bg-warning/10"
                >
                  <X className="h-4 w-4 mr-1" />
                  Kein Duplikat
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={bulkDeleteDuplicates}
                  disabled={bulkActionLoading !== null}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Duplikate löschen
                </Button>
              </>
            )}
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
                        {visibleColumns.has('date') && (
                          <TableHead 
                            className="cursor-pointer hover:text-foreground"
                            onClick={() => handleSort('receipt_date')}
                          >
                            Datum {getSortIcon('receipt_date')}
                          </TableHead>
                        )}
                        {visibleColumns.has('vendor') && (
                          <TableHead 
                            className="cursor-pointer hover:text-foreground"
                            onClick={() => handleSort('vendor')}
                          >
                            Lieferant {getSortIcon('vendor')}
                          </TableHead>
                        )}
                        {visibleColumns.has('invoice_number') && (
                          <TableHead 
                            className="cursor-pointer hover:text-foreground w-[120px]"
                            onClick={() => handleSort('invoice_number')}
                          >
                            Rechnungsnr. {getSortIcon('invoice_number')}
                          </TableHead>
                        )}
                        {visibleColumns.has('description') && (
                          <TableHead>Beschreibung</TableHead>
                        )}
                        {visibleColumns.has('category') && (
                          <TableHead>Kategorie</TableHead>
                        )}
                        {visibleColumns.has('amount') && (
                          <TableHead 
                            className="text-right cursor-pointer hover:text-foreground"
                            onClick={() => handleSort('amount_gross')}
                          >
                            Betrag {getSortIcon('amount_gross')}
                          </TableHead>
                        )}
                        {visibleColumns.has('ai') && (
                          <TableHead>KI</TableHead>
                        )}
                        {visibleColumns.has('status') && (
                          <TableHead>Status</TableHead>
                        )}
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
                          {visibleColumns.has('date') && (
                            <TableCell className="font-medium">
                              {receipt.receipt_date 
                                ? format(new Date(receipt.receipt_date), 'dd.MM.yyyy')
                                : format(new Date(receipt.created_at), 'dd.MM.yyyy')
                              }
                            </TableCell>
                          )}
                          {visibleColumns.has('vendor') && (
                            <TableCell>
                              {receipt.vendor_brand && receipt.vendor_brand !== receipt.vendor ? (
                                <div>
                                  <span className="font-medium">{receipt.vendor_brand}</span>
                                  <span 
                                    className="block text-xs text-muted-foreground truncate max-w-[180px]"
                                    title={receipt.vendor || ''}
                                  >
                                    {receipt.vendor}
                                  </span>
                                </div>
                              ) : (
                                receipt.vendor || '—'
                              )}
                            </TableCell>
                          )}
                          {visibleColumns.has('invoice_number') && (
                            <TableCell className="w-[120px]">
                              {receipt.invoice_number ? (
                                receipt.invoice_number.length > 15 ? (
                                  <span 
                                    className="font-mono text-sm truncate block max-w-[100px]" 
                                    title={receipt.invoice_number}
                                  >
                                    {receipt.invoice_number.slice(0, 12)}...
                                  </span>
                                ) : (
                                  <span className="font-mono text-sm">{receipt.invoice_number}</span>
                                )
                              ) : (
                                <span className="text-muted-foreground">–</span>
                              )}
                            </TableCell>
                          )}
                          {visibleColumns.has('description') && (
                            <TableCell className="max-w-[200px]">
                              <span 
                                className="truncate block" 
                                title={receipt.description || undefined}
                              >
                                {truncateText(receipt.description)}
                              </span>
                            </TableCell>
                          )}
                          {visibleColumns.has('category') && (
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
                          )}
                          {visibleColumns.has('amount') && (
                            <TableCell className="text-right font-medium">
                              {formatCurrency(receipt.amount_gross)}
                            </TableCell>
                          )}
                          {visibleColumns.has('ai') && (
                            <TableCell>
                              {receipt.ai_confidence !== null && receipt.ai_confidence !== undefined ? (
                                <Badge 
                                  variant={
                                    receipt.ai_confidence >= 0.8 ? 'default' :
                                    receipt.ai_confidence >= 0.5 ? 'secondary' : 'destructive'
                                  }
                                  className="text-xs"
                                >
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  {Math.round(receipt.ai_confidence * 100)}%
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          )}
                          {visibleColumns.has('status') && (
                            <TableCell>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge 
                                  variant="outline" 
                                  className={STATUS_CONFIG[receipt.status]?.color || ''}
                                >
                                  {receipt.status === 'split' && <Scissors className="w-3 h-3 mr-1" />}
                                  {receipt.status === 'needs_splitting' && <Scissors className="w-3 h-3 mr-1" />}
                                  {STATUS_CONFIG[receipt.status]?.label || receipt.status}
                                </Badge>
                                {/* Split-from indicator for child receipts */}
                                {receipt.split_from_receipt_id && (
                                  <Badge 
                                    variant="outline" 
                                    className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
                                  >
                                    <Layers className="w-3 h-3 mr-1" />
                                    Teil
                                    {receipt.original_pages && receipt.original_pages.length > 0 && (
                                      <span className="ml-1 opacity-75">
                                        (S. {receipt.original_pages.join(', ')})
                                      </span>
                                    )}
                                  </Badge>
                                )}
                                {receipt.is_duplicate && (
                                  <Badge 
                                    variant="outline" 
                                    className="bg-warning/10 text-warning border-warning/30 cursor-pointer text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (receipt.duplicate_of) {
                                        openDuplicateComparison(receipt.id, receipt.duplicate_of);
                                      }
                                    }}
                                  >
                                    <Copy className="w-3 h-3 mr-1" />
                                    {receipt.duplicate_score || 0}%
                                  </Badge>
                                )}
                                {/* Source Badge for email imports */}
                                {receipt.source?.startsWith('email_') && (
                                  <SourceBadge receipt={receipt} compact />
                                )}
                                {/* No Receipt Badge */}
                                {receipt.is_no_receipt_entry && (
                                  <NoReceiptBadge compact />
                                )}
                              </div>
                            </TableCell>
                          )}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* Duplicate comparison button */}
                              {receipt.is_duplicate && receipt.duplicate_of && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-warning hover:text-warning hover:bg-warning/10"
                                      title={`Duplikat (${receipt.duplicate_score || 0}%)`}
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openDuplicateComparison(receipt.id, receipt.duplicate_of!)}>
                                      <Eye className="h-4 w-4 mr-2" />
                                      Mit Original vergleichen
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => markAsNotDuplicate(receipt.id)}>
                                      <X className="h-4 w-4 mr-2" />
                                      Kein Duplikat
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      className="text-destructive"
                                      onClick={() => handleDeleteClick(receipt.id)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Duplikat löschen
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                              {/* Split button for needs_splitting status */}
                              {receipt.status === 'needs_splitting' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                  onClick={() => openSplitDialog(receipt)}
                                  title="PDF aufteilen"
                                >
                                  <Scissors className="h-4 w-4" />
                                </Button>
                              )}
                              {/* "Doch ein Beleg" button for not_a_receipt status */}
                              {receipt.status === 'not_a_receipt' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                                  onClick={() => handleMarkAsReceipt(receipt.id)}
                                  title="Doch ein Beleg - Neu analysieren"
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openReceiptPreview(receipt.id)}
                                title="Vorschau anzeigen"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openReceiptDetail(receipt.id)}
                                title="Bearbeiten"
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

      {/* Receipt Preview Dialog (View Only) */}
      <ReceiptPreviewDialog
        receiptId={previewReceiptId}
        open={previewDialogOpen}
        onClose={closeReceiptPreview}
      />

      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        receipts={filteredReceipts}
      />

      {/* Export Template Editor */}
      <ExportTemplateEditor
        open={exportEditorOpen}
        onClose={() => setExportEditorOpen(false)}
      />

      {/* Duplicate Comparison Modal */}
      <DuplicateComparisonModal
        open={duplicateComparisonOpen}
        onOpenChange={setDuplicateComparisonOpen}
        duplicateId={duplicateComparisonIds.duplicateId}
        originalId={duplicateComparisonIds.originalId}
        onRefresh={loadReceipts}
      />

      {/* Bulk AI Reanalyze Confirmation Dialog */}
      <AlertDialog open={showBulkReanalyzeConfirm} onOpenChange={setShowBulkReanalyzeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-5 h-5" />
              {selectedIds.size} Belege komplett neu analysieren?
            </AlertDialogTitle>
            <AlertDialogDescription>
              ALLE Felder werden überschrieben, auch manuelle Korrekturen wie 
              Lieferanten-Namen oder Rechnungsnummern. Dies kann einige Minuten dauern.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                bulkReanalyze('full');
                setShowBulkReanalyzeConfirm(false);
              }}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Ja, alles überschreiben
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk AI Progress Overlay */}
      {bulkActionLoading === 'ai' && aiProgress && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-[400px]">
            <CardContent className="pt-6">
              <div className="text-center mb-4">
                <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-primary" />
                <p className="font-medium">Analysiere Belege...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {aiProgress.current} von {aiProgress.total}
                </p>
              </div>
              
              <Progress 
                value={(aiProgress.current / aiProgress.total) * 100} 
                className="h-2"
              />
              
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Dies kann einige Minuten dauern
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Duplicate Check Progress Overlay */}
      {isCheckingDuplicates && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-[400px]">
            <CardContent className="pt-6">
              <div className="text-center mb-4">
                <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-primary" />
                <p className="font-medium">Prüfe Belege auf Duplikate...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {checkProgress.current} von {checkProgress.total} Belegen
                </p>
              </div>
              
              <Progress 
                value={checkProgress.total > 0 ? (checkProgress.current / checkProgress.total) * 100 : 0} 
                className="h-2"
              />
              
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Dies kann bei vielen Belegen etwas dauern
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Duplicate Results Dialog */}
      <Dialog open={showDuplicateResults} onOpenChange={setShowDuplicateResults}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="w-5 h-5 text-warning" />
              Duplikat-Prüfung abgeschlossen
            </DialogTitle>
            <DialogDescription>
              {foundDuplicates.length === 0 
                ? 'Alle Belege wurden geprüft' 
                : `${foundDuplicates.length} mögliche Duplikate wurden gefunden`
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {foundDuplicates.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <p className="font-medium">Keine Duplikate gefunden</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Alle Belege im gewählten Zeitraum sind einzigartig
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-4 p-3 bg-warning/10 rounded-lg border border-warning/20">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                  <p className="text-warning">
                    <strong>{foundDuplicates.length} mögliche Duplikate</strong> gefunden
                  </p>
                </div>
                
                <div className="max-h-[400px] overflow-y-auto space-y-2">
                  {foundDuplicates.map((item, i) => (
                    <div 
                      key={i}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.duplicate.vendor || 'Unbekannt'}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.duplicate.receipt_date || '–'} • € {item.duplicate.amount_gross?.toFixed(2) || '0.00'}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.matchReasons.map((reason, j) => (
                            <Badge key={j} variant="outline" className="text-xs">
                              {reason}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <Badge className="bg-warning/10 text-warning border-warning/20">
                          {item.score}%
                        </Badge>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setShowDuplicateResults(false);
                            openDuplicateComparison(item.duplicate.id, item.originalId);
                          }}
                        >
                          <GitCompare className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicateResults(false)}>
              Schließen
            </Button>
            {foundDuplicates.length > 0 && (
              <Button onClick={() => {
                setShowDuplicateResults(false);
                setStatusFilter('duplicate');
              }}>
                Duplikate anzeigen
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Format Dialog */}
      <ExportFormatDialog
        open={exportFormatDialogOpen}
        onOpenChange={setExportFormatDialogOpen}
        receipts={filteredReceipts}
        format={selectedExportFormat}
        dateRange={{ from: dateFrom, to: dateTo }}
      />

      {/* Split Suggestion Dialog */}
      {splitDialogReceipt && (
        <SplitSuggestionDialog
          open={splitDialogOpen}
          onClose={closeSplitDialog}
          receipt={{
            id: splitDialogReceipt.id,
            file_name: splitDialogReceipt.file_name || '',
            file_url: splitDialogReceipt.file_url || '',
            page_count: splitDialogReceipt.page_count || 1,
            split_suggestion: splitDialogReceipt.split_suggestion as any,
          }}
        />
      )}
    </DashboardLayout>
  );
};

export default Expenses;
