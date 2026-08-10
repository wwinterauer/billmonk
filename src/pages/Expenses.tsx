import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RecurringExpensesTab } from '@/components/expenses/RecurringExpensesTab';
import { Repeat } from 'lucide-react';
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
  Tag,
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
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
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
import { useTags } from '@/hooks/useTags';
import { ReceiptDetailPanel } from '@/components/receipts/ReceiptDetailPanel';
import { ReceiptPreviewDialog } from '@/components/receipts/ReceiptPreviewDialog';
import { DuplicateComparisonModal } from '@/components/receipts/DuplicateComparisonModal';
import { ExportDialog } from '@/components/exports/ExportDialog';
import { ExportFormatDialog, type ExportFormat } from '@/components/exports/ExportFormatDialog';
import { ExportTemplateEditor } from '@/components/exports/ExportTemplateEditor';
import { TaxExportDialog } from '@/components/exports/TaxExportDialog';
import { usePlan } from '@/hooks/usePlan';
import { isPlanSufficient } from '@/lib/planConfig';
import { TagSelector } from '@/components/tags/TagSelector';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { NO_RECEIPT_CATEGORY } from '@/lib/constants';
import { Folder } from 'lucide-react';
import { Copy, Scissors, Layers, Zap } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { EditableTableHead } from '@/components/expenses/EditableTableHead';
import { checkForDuplicates, type DuplicateCheckResult } from '@/services/duplicateDetectionService';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useSplitLines } from '@/hooks/useSplitLines';
import { SplitSuggestionDialog } from '@/components/receipts/SplitSuggestionDialog';
import { SourceBadge, NoReceiptBadge } from '@/components/receipts/SourceBadge';
import { PageMeta } from '@/components/PageMeta';
import { ManualExpenseDialog } from '@/components/expenses/ManualExpenseDialog';
import { PenLine } from 'lucide-react';

type SortField =
  | 'receipt_date'
  | 'vendor'
  | 'invoice_number'
  | 'description'
  | 'category'
  | 'tax_type'
  | 'amount_gross'
  | 'ai_confidence'
  | 'status';
type SortDirection = 'asc' | 'desc';

type ColumnKey = 'date' | 'vendor' | 'invoice_number' | 'description' | 'category' | 'tax_type' | 'tags' | 'amount' | 'ai' | 'status';

const COLUMN_CONFIG: {
  key: ColumnKey;
  label: string;
  defaultVisible: boolean;
  defaultWidth: number;
  sortField?: SortField;
  align?: 'left' | 'right';
}[] = [
  { key: 'date', label: 'Datum', defaultVisible: true, defaultWidth: 110, sortField: 'receipt_date' },
  { key: 'vendor', label: 'Lieferant', defaultVisible: true, defaultWidth: 200, sortField: 'vendor' },
  { key: 'invoice_number', label: 'Rechnungsnr.', defaultVisible: true, defaultWidth: 140, sortField: 'invoice_number' },
  { key: 'description', label: 'Beschreibung', defaultVisible: true, defaultWidth: 220, sortField: 'description' },
  { key: 'category', label: 'Kategorie', defaultVisible: true, defaultWidth: 150, sortField: 'category' },
  { key: 'tax_type', label: 'Buchungsart', defaultVisible: true, defaultWidth: 150, sortField: 'tax_type' },
  { key: 'tags', label: 'Tags', defaultVisible: true, defaultWidth: 160 },
  { key: 'amount', label: 'Betrag', defaultVisible: true, defaultWidth: 120, sortField: 'amount_gross', align: 'right' },
  { key: 'ai', label: 'KI', defaultVisible: true, defaultWidth: 90, sortField: 'ai_confidence' },
  { key: 'status', label: 'Status', defaultVisible: true, defaultWidth: 200, sortField: 'status' },
];

const DEFAULT_COLUMN_ORDER: ColumnKey[] = COLUMN_CONFIG.map(c => c.key);
const DEFAULT_COLUMN_WIDTHS: Record<ColumnKey, number> = COLUMN_CONFIG.reduce(
  (acc, c) => { acc[c.key] = c.defaultWidth; return acc; },
  {} as Record<ColumnKey, number>,
);

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
  needs_splitting: { label: 'Aufteilen', color: 'bg-chart-4/10 text-chart-4 border-chart-4/20' },
  split: { label: 'Aufgeteilt', color: 'bg-chart-4/10 text-chart-4 border-chart-4/20' },
  completed: { label: 'Abgeschlossen', color: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
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
  const { categories, userCategories, taxCategories } = useCategories();
  const { tags, activeTags, getTagsForReceipt, getTagsForReceipts } = useTags();

  // Data state
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Receipt tags cache for table display
  const [receiptTagsCache, setReceiptTagsCache] = useState<Record<string, { id: string; name: string; color: string }[]>>({});

  // Date range filter state - persist to localStorage
  const STORAGE_KEY = 'expenses-date-filter';
  const currentDate = new Date();
  
  const getInitialDateState = () => {
    // First check URL params
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    
    if (fromParam || toParam) {
      return {
        from: fromParam ? new Date(fromParam) : undefined,
        to: toParam ? new Date(toParam) : undefined,
        preset: 'custom' as DateRangePreset
      };
    }
    
    // Then check localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // If preset is not 'custom', recalculate dates based on current date
        if (parsed.preset && parsed.preset !== 'custom' && parsed.preset !== 'all') {
          const presetDates = getPresetDates(parsed.preset);
          return {
            from: presetDates.from,
            to: presetDates.to,
            preset: parsed.preset as DateRangePreset
          };
        }
        return {
          from: parsed.from ? new Date(parsed.from) : undefined,
          to: parsed.to ? new Date(parsed.to) : undefined,
          preset: (parsed.preset || 'custom') as DateRangePreset
        };
      } catch {
        // Fall through to default
      }
    }
    
    // Default to current month only for first-time users
    return {
      from: startOfMonth(currentDate),
      to: endOfMonth(currentDate),
      preset: 'thisMonth' as DateRangePreset
    };
  };
  
  const initialState = getInitialDateState();
  const [dateFrom, setDateFrom] = useState<Date | undefined>(initialState.from);
  const [dateTo, setDateTo] = useState<Date | undefined>(initialState.to);
  const [datePreset, setDatePreset] = useState<DateRangePreset>(initialState.preset);
  
  // Save date filter to localStorage whenever it changes
  useEffect(() => {
    const filterState = {
      from: dateFrom?.toISOString(),
      to: dateTo?.toISOString(),
      preset: datePreset
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filterState));
  }, [dateFrom, dateTo, datePreset]);

  // Other filter state
  const [statusFilter, setStatusFilter] = useState<string>(() => 
    searchParams.get('status') || 'all'
  );
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [taxTypeFilter, setTaxTypeFilter] = useState<string>('all');
  const [invoiceFilter, setInvoiceFilter] = useState<string>('all');
  
  const [tagFilter, setTagFilter] = useState<string[]>(() => {
    const tagsParam = searchParams.get('tags');
    const noTagsParam = searchParams.get('noTags');
    if (noTagsParam === '1') return ['__none__'];
    if (tagsParam) return tagsParam.split(',').filter(Boolean);
    return [];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(() => {
    const saved = localStorage.getItem('expenses-visible-columns');
    if (saved) {
      try {
        const parsed = new Set(JSON.parse(saved) as ColumnKey[]);
        // Migration: neue Spalten automatisch einblenden
        if (!parsed.has('tax_type')) parsed.add('tax_type');
        return parsed;
      } catch {
        return new Set(COLUMN_CONFIG.filter(c => c.defaultVisible).map(c => c.key));
      }
    }
    return new Set(COLUMN_CONFIG.filter(c => c.defaultVisible).map(c => c.key));
  });

  // Sort state
  const [sortField, setSortField] = useState<SortField>('receipt_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Column order state
  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(() => {
    const saved = localStorage.getItem('expenses-column-order');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ColumnKey[];
        const valid = parsed.filter(k => DEFAULT_COLUMN_ORDER.includes(k));
        // append any new columns missing from saved
        for (const k of DEFAULT_COLUMN_ORDER) if (!valid.includes(k)) valid.push(k);
        return valid;
      } catch {
        return DEFAULT_COLUMN_ORDER;
      }
    }
    return DEFAULT_COLUMN_ORDER;
  });

  // Column widths state
  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>(() => {
    const saved = localStorage.getItem('expenses-column-widths');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Record<ColumnKey, number>;
        return { ...DEFAULT_COLUMN_WIDTHS, ...parsed };
      } catch {
        return DEFAULT_COLUMN_WIDTHS;
      }
    }
    return DEFAULT_COLUMN_WIDTHS;
  });

  useEffect(() => {
    localStorage.setItem('expenses-column-order', JSON.stringify(columnOrder));
  }, [columnOrder]);

  useEffect(() => {
    localStorage.setItem('expenses-column-widths', JSON.stringify(columnWidths));
  }, [columnWidths]);

  // Actions column width (resizable)
  const [actionsColWidth, setActionsColWidth] = useState<number>(() => {
    const saved = localStorage.getItem('expenses-actions-col-width-v2');
    const n = saved ? parseInt(saved, 10) : NaN;
    return Number.isFinite(n) ? Math.max(60, Math.min(400, n)) : 96;
  });
  useEffect(() => {
    localStorage.setItem('expenses-actions-col-width-v2', String(actionsColWidth));
  }, [actionsColWidth]);
  const handleActionsResizeDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = actionsColWidth;
    const onMove = (ev: PointerEvent) => {
      // Resize handle is on the LEFT side; dragging left increases width
      const delta = startX - ev.clientX;
      setActionsColWidth(Math.min(400, Math.max(60, startWidth + delta)));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setColumnOrder(prev => {
      const oldIndex = prev.indexOf(active.id as ColumnKey);
      const newIndex = prev.indexOf(over.id as ColumnKey);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleColumnResize = (key: ColumnKey, width: number) => {
    setColumnWidths(prev => ({ ...prev, [key]: width }));
  };

  const resetColumnLayout = () => {
    setColumnOrder(DEFAULT_COLUMN_ORDER);
    setColumnWidths(DEFAULT_COLUMN_WIDTHS);
    setVisibleColumns(new Set(COLUMN_CONFIG.filter(c => c.defaultVisible).map(c => c.key)));
  };

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
  const [taxExportOpen, setTaxExportOpen] = useState(false);
  const { effectivePlan, splitBookingEnabled } = usePlan();

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
  const [manualExpenseOpen, setManualExpenseOpen] = useState(false);

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
      // Get all receipts in the selected date range (also re-evaluate already marked duplicates)
      const { data: receiptsToCheck, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('user_id', user.id)
        .order('receipt_date', { ascending: false });

      if (error) throw error;

      const receiptsList = receiptsToCheck || [];
      setCheckProgress({ current: 0, total: receiptsList.length });

      const duplicatesFound: FoundDuplicate[] = [];

      // Check each receipt
      for (let i = 0; i < receiptsList.length; i++) {
        const receipt = receiptsList[i];
        setCheckProgress({ current: i + 1, total: receiptsList.length });

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
          // No match by current rules — unmark if previously flagged
          await supabase
            .from('receipts')
            .update({
              is_duplicate: false,
              duplicate_of: null,
              duplicate_score: null,
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
        excludeStatus: ['split'],
      });
      setReceipts(data);
      
      // Load tags for all receipts for display
      if (data.length > 0) {
        const tagsData = await getTagsForReceipts(data.map(r => r.id));
        // Build cache: group by receipt
        const cache: Record<string, { id: string; name: string; color: string }[]> = {};
        
        // For each receipt, get its tags from the receipt_tags table
        const { data: receiptTagsData } = await supabase
          .from('receipt_tags')
          .select('receipt_id, tag_id, tags(id, name, color)')
          .in('receipt_id', data.map(r => r.id));
        
        if (receiptTagsData) {
          for (const rt of receiptTagsData) {
            const tagInfo = rt.tags as unknown as { id: string; name: string; color: string };
            if (!cache[rt.receipt_id]) {
              cache[rt.receipt_id] = [];
            }
            if (tagInfo) {
              cache[rt.receipt_id].push(tagInfo);
            }
          }
        }
        setReceiptTagsCache(cache);
      }
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
    if (tagFilter.includes('__none__')) {
      params.set('noTags', '1');
    } else if (tagFilter.length > 0) {
      params.set('tags', tagFilter.join(','));
    }
    setSearchParams(params, { replace: true });
  }, [dateFrom, dateTo, statusFilter, tagFilter, setSearchParams]);

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

  // Handle URL-based receipt detail (from DuplicateComparisonModal fallback)
  useEffect(() => {
    const receiptId = searchParams.get('receipt');
    if (receiptId) {
      openReceiptDetail(receiptId);
      const params = new URLSearchParams(searchParams);
      params.delete('receipt');
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
    return receipts.filter(r => r.is_duplicate === true && r.duplicate_of).length;
  }, [receipts]);

  // Load split lines for ALL split-booking receipts so the search can match split-line content
  const allSplitReceiptIds = useMemo(
    () => receipts.filter(r => (r as any).is_split_booking).map(r => r.id),
    [receipts]
  );
  const { data: allSplitLinesForSearch = [] } = useSplitLines(
    splitBookingEnabled && allSplitReceiptIds.length > 0 && searchQuery.trim().length > 0,
    allSplitReceiptIds
  );
  const splitSearchTextByReceiptId = useMemo(() => {
    const map = new Map<string, string>();
    allSplitLinesForSearch.forEach(line => {
      const parts = [line.description, line.category, line.tax_type].filter(Boolean).join(' ').toLowerCase();
      const prev = map.get(line.receipt_id);
      map.set(line.receipt_id, prev ? `${prev} ${parts}` : parts);
    });
    return map;
  }, [allSplitLinesForSearch]);

  // Filter and sort receipts
  const filteredReceipts = useMemo(() => {
    let result = [...receipts];

    // Status filter - special handling for 'duplicate' and split-booking filters
    if (statusFilter === 'duplicate') {
      result = result.filter(r => r.is_duplicate === true && r.duplicate_of);
    } else if (statusFilter !== 'all' && statusFilter !== '__split__' && statusFilter !== '__no_split__') {
      result = result.filter(r => r.status === statusFilter);
    }

    // Category filter
    if (categoryFilter === '__unassigned__') {
      result = result.filter(r => !r.category);
    } else if (categoryFilter !== 'all') {
      result = result.filter(r => r.category === categoryFilter);
    }

    // Tax type filter
    if (taxTypeFilter === '__open__') {
      result = result.filter(r => !(r as any).tax_type);
    } else if (taxTypeFilter !== 'all') {
      result = result.filter(r => (r as any).tax_type === taxTypeFilter);
    }

    // Invoice number filter
    if (invoiceFilter === 'with') {
      result = result.filter(r => r.invoice_number && r.invoice_number.trim() !== '');
    } else if (invoiceFilter === 'without') {
      result = result.filter(r => !r.invoice_number || r.invoice_number.trim() === '');
    }

    // Split booking filter (via status dropdown)
    if (statusFilter === '__split__') {
      result = result.filter(r => (r as any).is_split_booking === true);
    } else if (statusFilter === '__no_split__') {
      result = result.filter(r => !(r as any).is_split_booking);
    }

    // Tag filter
    if (tagFilter.length > 0) {
      if (tagFilter.includes('__none__')) {
        // Show receipts without any tags
        result = result.filter(r => !receiptTagsCache[r.id] || receiptTagsCache[r.id].length === 0);
      } else {
        // Show receipts that have at least one of the selected tags (OR logic)
        result = result.filter(r => {
          const receiptTags = receiptTagsCache[r.id] || [];
          return receiptTags.some(t => tagFilter.includes(t.id));
        });
      }
    }

    // Search filter (extended to include invoice_number, vendor_brand and split-line content)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.vendor?.toLowerCase().includes(query) ||
        r.vendor_brand?.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query) ||
        r.invoice_number?.toLowerCase().includes(query) ||
        r.file_name?.toLowerCase().includes(query) ||
        splitSearchTextByReceiptId.get(r.id)?.includes(query)
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
        case 'description':
          aVal = a.description?.toLowerCase() || '';
          bVal = b.description?.toLowerCase() || '';
          break;
        case 'category':
          aVal = a.category?.toLowerCase() || '';
          bVal = b.category?.toLowerCase() || '';
          break;
        case 'tax_type':
          aVal = (a as any).tax_type?.toLowerCase() || '';
          bVal = (b as any).tax_type?.toLowerCase() || '';
          break;
        case 'ai_confidence':
          aVal = a.ai_confidence ?? -1;
          bVal = b.ai_confidence ?? -1;
          break;
        case 'status':
          aVal = a.status || '';
          bVal = b.status || '';
          break;
      }

      if (aVal === null || bVal === null) return 0;
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [receipts, statusFilter, categoryFilter, taxTypeFilter, invoiceFilter, tagFilter, receiptTagsCache, searchQuery, sortField, sortDirection, splitSearchTextByReceiptId]);

  // Pagination
  const totalPages = Math.ceil(filteredReceipts.length / ITEMS_PER_PAGE);
  const paginatedReceipts = filteredReceipts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Load split lines for visible split-booking receipts on this page
  const visibleSplitReceiptIds = useMemo(
    () => paginatedReceipts.filter(r => (r as any).is_split_booking).map(r => r.id),
    [paginatedReceipts]
  );
  const { data: visibleSplitLines = [] } = useSplitLines(
    splitBookingEnabled && visibleSplitReceiptIds.length > 0,
    visibleSplitReceiptIds
  );
  const splitLinesByReceiptId = useMemo(() => {
    const map = new Map<string, typeof visibleSplitLines>();
    visibleSplitLines.forEach(line => {
      const arr = map.get(line.receipt_id) || [];
      arr.push(line);
      map.set(line.receipt_id, arr);
    });
    return map;
  }, [visibleSplitLines]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, categoryFilter, taxTypeFilter, invoiceFilter, tagFilter, searchQuery]);

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

  // Statistics (exclude "Keine Rechnung" from monetary calculations)
  const stats = useMemo(() => {
    const billableReceipts = filteredReceipts.filter(r => r.category !== NO_RECEIPT_CATEGORY);
    const total = billableReceipts.reduce((sum, r) => sum + (r.amount_gross || 0), 0);
    const vatSum = billableReceipts.reduce((sum, r) => sum + (r.vat_amount || 0), 0);
    const count = filteredReceipts.length;
    const average = billableReceipts.length > 0 ? total / billableReceipts.length : 0;

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
  const [bulkActionLoading, setBulkActionLoading] = useState<'approve' | 'reject' | 'review' | 'ai' | 'duplicateCheck' | 'completed' | null>(null);
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

  const handleBulkComplete = async () => {
    setBulkActionLoading('completed');
    try {
      if (statusFilter === 'completed') {
        for (const id of selectedIds) {
          await updateReceipt(id, { status: 'approved' });
        }
        setReceipts(prev => prev.map(r => 
          selectedIds.has(r.id) ? { ...r, status: 'approved' as const } : r
        ));
        const count = selectedIds.size;
        setSelectedIds(new Set());
        toast({ title: `${count} Belege zurück zu Genehmigt` });
      } else {
        const selectedReceipts = receipts.filter(r => selectedIds.has(r.id));
        const approvedReceipts = selectedReceipts.filter(r => r.status === 'approved');
        const skippedCount = selectedReceipts.length - approvedReceipts.length;
        
        for (const r of approvedReceipts) {
          await updateReceipt(r.id, { status: 'completed' } as unknown as Partial<Receipt>);
        }
        
        setReceipts(prev => prev.map(r => 
          approvedReceipts.some(ar => ar.id === r.id) ? { ...r, status: 'completed' } as unknown as Receipt : r
        ));
        
        setSelectedIds(new Set());
        
        if (approvedReceipts.length > 0 && skippedCount > 0) {
          toast({ 
            title: `${approvedReceipts.length} von ${selectedReceipts.length} abgeschlossen`,
            description: `${skippedCount} übersprungen (nicht freigegeben)`
          });
        } else if (approvedReceipts.length > 0) {
          toast({ title: `${approvedReceipts.length} Belege abgeschlossen` });
        } else {
          toast({ 
            title: 'Keine Belege abgeschlossen',
            description: 'Nur freigegebene Belege können abgeschlossen werden',
            variant: 'destructive'
          });
        }
      }
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

        try {
          // Use receiptId path so edge function loads vendor settings (expenses_only, keywords, etc.)
          await supabase
            .from('receipts')
            .update({ status: 'processing', notes: null })
            .eq('id', receipt.id);

          const { data, error } = await supabase.functions.invoke('extract-receipt', {
            body: { receiptId: receipt.id, forceExtract: true, skipMultiCheck: true }
          });

          if (error || !data?.success) {
            failCount++;
          } else {
            successCount++;
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
      loadReceipts();
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

        // For full mode, use receiptId path to get vendor settings
        if (mode === 'full') {
          await supabase
            .from('receipts')
            .update({ status: 'processing', notes: null })
            .eq('id', receipt.id);

          const { data: extractData, error: extractError } = await supabase.functions.invoke('extract-receipt', {
            body: { receiptId: receipt.id, forceExtract: true, skipMultiCheck: true }
          });

          if (extractError || !extractData?.success) {
            results.failed++;
            continue;
          }

          // For full mode, the edge function handles the DB update
          results.success++;
          continue;
        }

        // For smart/empty modes: use receiptId path so vendor settings are loaded
        // The edge function will overwrite all fields in DB, so we need to restore
        // fields that should NOT be updated back to their original values
        const { data: extractData, error: extractError } = await supabase.functions.invoke('extract-receipt', {
          body: { receiptId: receipt.id, forceExtract: true, skipMultiCheck: true }
        });

        if (extractError || !extractData?.success || !extractData?.data) {
          results.failed++;
          continue;
        }

        const normalized = extractData.data;

        // The edge function already updated ALL fields in DB.
        // Now restore original values for fields NOT in fieldsToAnalyze
        const restoreFields: Record<string, unknown> = {};
        const allFields = ['vendor', 'vendor_brand', 'description', 'amount_gross', 'amount_net', 
          'vat_amount', 'vat_rate', 'receipt_date', 'category', 'tax_type', 'invoice_number',
          'is_mixed_tax_rate', 'tax_rate_details', 'vat_rate_source', 'vat_confidence', 
          'vat_detection_method', 'special_vat_case', 'vendor_country'];
        
        for (const field of allFields) {
          if (!fieldsToAnalyze.includes(field)) {
            restoreFields[field] = (receipt as any)[field] ?? null;
          }
        }
        // Restore status (edge function sets it to 'review')
        restoreFields.status = receipt.status;

        if (Object.keys(restoreFields).length > 0) {
          await supabase
            .from('receipts')
            .update({ ...restoreFields, updated_at: new Date().toISOString() })
            .eq('id', receipt.id);
        }

        // Build the actual updates for local state
        const updates: Record<string, unknown> = {};
        for (const fieldId of fieldsToAnalyze) {
          const newValue = normalized[fieldId as keyof typeof normalized];
          if (newValue !== undefined && newValue !== null) {
            updates[fieldId] = newValue;
          }
        }

        if (Object.keys(updates).length > 0) {
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

  // Ordered list of visible columns
  const orderedVisibleColumns = useMemo(
    () => columnOrder.filter(k => visibleColumns.has(k)),
    [columnOrder, visibleColumns],
  );

  // Render a single cell for a given column key
  const renderCell = (receipt: Receipt, key: ColumnKey) => {
    const width = columnWidths[key];
    const cellStyle = { width, minWidth: width, maxWidth: width } as const;
    switch (key) {
      case 'date':
        return (
          <TableCell key={key} style={cellStyle} className="font-medium truncate">
            {receipt.receipt_date
              ? format(new Date(receipt.receipt_date), 'dd.MM.yyyy')
              : format(new Date(receipt.created_at), 'dd.MM.yyyy')}
          </TableCell>
        );
      case 'vendor':
        return (
          <TableCell key={key} style={cellStyle}>
            {receipt.vendor_brand && receipt.vendor_brand !== receipt.vendor ? (
              <div className="min-w-0">
                <span className="font-medium block truncate">{receipt.vendor_brand}</span>
                <span className="block text-xs text-muted-foreground truncate" title={receipt.vendor || ''}>
                  {receipt.vendor}
                </span>
              </div>
            ) : (
              <span className="block truncate" title={receipt.vendor || ''}>{receipt.vendor || '—'}</span>
            )}
          </TableCell>
        );
      case 'invoice_number':
        return (
          <TableCell key={key} style={cellStyle}>
            {receipt.invoice_number ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-mono text-sm block truncate cursor-default">
                    {receipt.invoice_number}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{receipt.invoice_number}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className="text-muted-foreground">–</span>
            )}
          </TableCell>
        );
      case 'description':
        return (
          <TableCell key={key} style={cellStyle}>
            {receipt.description ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="truncate block cursor-default">
                    {truncateText(receipt.description)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-md whitespace-pre-wrap">{receipt.description}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className="text-muted-foreground">–</span>
            )}
          </TableCell>
        );
      case 'category':
        return (
          <TableCell key={key} style={cellStyle}>
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
        );
      case 'tax_type':
        return (
          <TableCell key={key} style={cellStyle}>
            {(receipt as any).tax_type ? (
              <Badge variant="outline" className="text-xs">{(receipt as any).tax_type}</Badge>
            ) : (
              <span className="text-xs text-muted-foreground">Offen</span>
            )}
          </TableCell>
        );
      case 'tags':
        return (
          <TableCell key={key} style={cellStyle}>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="flex items-center gap-1 hover:opacity-80 cursor-pointer min-h-[24px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {receiptTagsCache[receipt.id]?.length > 0 ? (
                    <>
                      {receiptTagsCache[receipt.id].slice(0, 2).map(tag => (
                        <Badge
                          key={tag.id}
                          variant="secondary"
                          className="text-xs py-0.5 px-1.5 text-white"
                          style={{ backgroundColor: tag.color }}
                          title={tag.name}
                        >
                          {tag.name}
                        </Badge>
                      ))}
                      {receiptTagsCache[receipt.id].length > 2 && (
                        <Badge variant="outline" className="text-xs py-0.5 px-1.5">
                          +{receiptTagsCache[receipt.id].length - 2}
                        </Badge>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="start">
                <div className="space-y-2">
                  <p className="text-sm font-medium mb-2">Tags zuweisen</p>
                  <TagSelector receiptId={receipt.id} size="sm" onChange={loadReceipts} />
                </div>
              </PopoverContent>
            </Popover>
          </TableCell>
        );
      case 'amount':
        return (
          <TableCell key={key} style={cellStyle} className="text-right font-medium">
            {formatCurrency(receipt.amount_gross)}
          </TableCell>
        );
      case 'ai':
        return (
          <TableCell key={key} style={cellStyle}>
            {receipt.ai_confidence !== null && receipt.ai_confidence !== undefined ? (
              <Badge
                variant={
                  receipt.ai_confidence >= 0.8 ? 'default'
                    : receipt.ai_confidence >= 0.5 ? 'secondary' : 'destructive'
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
        );
      case 'status':
        return (
          <TableCell key={key} style={cellStyle}>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className={STATUS_CONFIG[receipt.status]?.color || ''}>
                {receipt.status === 'split' && <Scissors className="w-3 h-3 mr-1" />}
                {receipt.status === 'needs_splitting' && <Scissors className="w-3 h-3 mr-1" />}
                {STATUS_CONFIG[receipt.status]?.label || receipt.status}
              </Badge>
              {(receipt as any).auto_approved && (receipt.status === 'approved' || receipt.status === 'split') && (
                <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs">
                  <Zap className="w-3 h-3 mr-1" />
                  Automatisch freigegeben
                </Badge>
              )}
              {receipt.split_from_receipt_id && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                  <Layers className="w-3 h-3 mr-1" />
                  Teil
                  {receipt.original_pages && receipt.original_pages.length > 0 && (
                    <span className="ml-1 opacity-75">(S. {receipt.original_pages.join(', ')})</span>
                  )}
                </Badge>
              )}
              {receipt.is_duplicate && (
                <Badge
                  variant="outline"
                  className="bg-warning/10 text-warning border-warning/30 cursor-pointer text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (receipt.duplicate_of) openDuplicateComparison(receipt.id, receipt.duplicate_of);
                  }}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  {receipt.duplicate_score || 0}%
                </Badge>
              )}
              {splitBookingEnabled && (receipt as any).is_split_booking && (
                <Layers className="w-3.5 h-3.5 text-violet-600" />
              )}
              {receipt.source?.startsWith('email_') && <SourceBadge receipt={receipt} compact />}
              {receipt.is_no_receipt_entry && <NoReceiptBadge compact />}
            </div>
          </TableCell>
        );
    }
  };

  return (
    <>
      <PageMeta title="Ausgaben — BillMonk" description="Alle Ausgaben verwalten, filtern und für die Buchhaltung exportieren." canonical="/expenses" noindex />
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
                {isPlanSufficient(effectivePlan, 'business') && (
                  <DropdownMenuItem onClick={() => setTaxExportOpen(true)}>
                    <FileDown className="h-4 w-4 mr-2" />
                    Steuerberater-Export (DATEV/BMD)
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings?tab=export')}>
                  <Settings2 className="h-4 w-4 mr-2" />
                  Vorlagen verwalten
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              onClick={() => setManualExpenseOpen(true)}
            >
              <PenLine className="h-4 w-4 mr-2" />
              Manuell erfassen
            </Button>
            <Button 
              className="gradient-primary hover:opacity-90"
              onClick={() => navigate('/upload')}
            >
              <Upload className="h-4 w-4 mr-2" />
              Beleg hochladen
            </Button>
          </div>
        </div>

        <ManualExpenseDialog
          open={manualExpenseOpen}
          onOpenChange={setManualExpenseOpen}
          onCreated={loadReceipts}
        />

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="all">Alle Ausgaben</TabsTrigger>
            <TabsTrigger value="recurring" className="flex items-center gap-1.5">
              <Repeat className="h-3.5 w-3.5" />
              Wiederkehrend
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recurring">
            <RecurringExpensesTab />
          </TabsContent>

          <TabsContent value="all">

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
              {splitBookingEnabled && (
                <>
                  <SelectSeparator />
                  <SelectItem value="__split__">
                    <div className="flex items-center">
                      <Layers className="w-4 h-4 mr-2 text-chart-4" />
                      Mit Splitbuchung
                    </div>
                  </SelectItem>
                  <SelectItem value="__no_split__">
                    <div className="flex items-center">
                      <Layers className="w-4 h-4 mr-2 text-muted-foreground" />
                      Ohne Splitbuchung
                    </div>
                  </SelectItem>
                </>
              )}
            </SelectContent>
          </Select>

          <SearchableSelect
            value={categoryFilter}
            onChange={(v) => setCategoryFilter(v || 'all')}
            options={[
              { value: 'all', label: 'Alle Kategorien' },
              { value: '__unassigned__', label: 'Nicht zugeordnet' },
              ...userCategories.map(c => ({ value: c.name, label: c.name })),
            ]}
            placeholder="Kategorie"
            searchPlaceholder="Kategorie suchen..."
            className="w-[180px]"
          />

          <SearchableSelect
            value={taxTypeFilter}
            onChange={(v) => setTaxTypeFilter(v || 'all')}
            options={[
              { value: 'all', label: 'Alle Buchungsarten' },
              { value: '__open__', label: 'Offen' },
              ...taxCategories.map(c => ({ value: c.name, label: c.name })),
            ]}
            placeholder="Buchungsart"
            searchPlaceholder="Buchungsart suchen..."
            className="w-[170px]"
          />

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

          {/* Tag Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "min-w-[150px] max-w-[220px] justify-start",
                  tagFilter.length > 0 && "border-primary text-primary"
                )}
              >
                <Tag className="h-4 w-4 mr-2 flex-shrink-0" />
                {tagFilter.length === 0
                  ? 'Tags'
                  : tagFilter.includes('__none__')
                    ? 'Ohne Tags'
                    : (() => {
                        const selected = tagFilter
                          .map(id => tags.find(t => t.id === id))
                          .filter((t): t is NonNullable<typeof t> => Boolean(t));
                        const visible = selected.slice(0, 2);
                        const rest = selected.length - visible.length;
                        return (
                          <span className="flex items-center gap-1 truncate">
                            {visible.map(t => (
                              <span
                                key={t.id}
                                className="inline-flex items-center rounded-full px-1.5 py-0.5 text-xs text-white"
                                style={{ backgroundColor: t.color }}
                              >
                                {t.name}
                              </span>
                            ))}
                            {rest > 0 && (
                              <span className="text-xs">+{rest}</span>
                            )}
                          </span>
                        );
                      })()
                }
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-xs">Nach Tags filtern</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="flex gap-1 px-2 py-1">
                <DropdownMenuItem
                  className="flex-1 justify-center text-xs cursor-pointer"
                  onSelect={(e) => {
                    e.preventDefault();
                    setTagFilter(tags.map(t => t.id));
                  }}
                >
                  Alle auswählen
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex-1 justify-center text-xs cursor-pointer"
                  onSelect={(e) => {
                    e.preventDefault();
                    setTagFilter([]);
                  }}
                >
                  Alle abwählen
                </DropdownMenuItem>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={tagFilter.includes('__none__')}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setTagFilter(['__none__']);
                  } else {
                    setTagFilter(prev => prev.filter(t => t !== '__none__'));
                  }
                }}
              >
                <span className="text-muted-foreground">Ohne Tags</span>
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {tags.map(tag => (
                <DropdownMenuCheckboxItem
                  key={tag.id}
                  checked={tagFilter.includes(tag.id)}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setTagFilter(prev => [...prev.filter(t => t !== '__none__'), tag.id]);
                    } else {
                      setTagFilter(prev => prev.filter(t => t !== tag.id));
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className={!tag.is_active ? 'text-muted-foreground' : ''}>
                      {tag.name}
                      {!tag.is_active && ' (inaktiv)'}
                    </span>
                  </div>
                </DropdownMenuCheckboxItem>
              ))}
              {tagFilter.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setTagFilter([])}>
                    <X className="h-4 w-4 mr-2" />
                    Filter zurücksetzen
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

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
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => { e.preventDefault(); resetColumnLayout(); }}
                className="flex items-center gap-2 text-muted-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Layout zurücksetzen</span>
              </DropdownMenuItem>
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
              <p className="text-2xl font-bold font-mono">{formatCurrency(stats.total)}</p>
              <p className="text-xs text-muted-foreground mt-1">{dateRangeLabel}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Anzahl</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-mono">{stats.count} Belege</p>
              <p className="text-xs text-muted-foreground mt-1">{dateRangeLabel}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Vorsteuer</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-mono">{formatCurrency(stats.vatSum)}</p>
              <p className="text-xs text-muted-foreground mt-1">{dateRangeLabel}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Durchschnitt</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-mono">{formatCurrency(stats.average)}</p>
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
                        {duplicateCount} Beleg{duplicateCount === 1 ? '' : 'e'} als Duplikat markiert
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Im Duplikat-Filter überprüfen und ggf. bereinigen
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
            
            {/* Complete / Revert to Approved */}
            {statusFilter === 'completed' ? (
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleBulkComplete}
                disabled={bulkActionLoading !== null}
                className="border-green-500/50 text-green-600 hover:bg-green-50 hover:text-green-700"
              >
                {bulkActionLoading === 'completed' ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-1" />
                )}
                Zurück zu Genehmigt
              </Button>
            ) : (
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleBulkComplete}
                disabled={bulkActionLoading !== null}
                className="border-slate-500/50 text-slate-600 hover:bg-slate-50 hover:text-slate-700"
              >
                {bulkActionLoading === 'completed' ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Archive className="h-4 w-4 mr-1" />
                )}
                Abschließen
              </Button>
            )}
            
            {/* Bulk Tags */}
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  size="sm" 
                  variant="outline"
                  disabled={bulkActionLoading !== null}
                  className="border-primary/50 text-primary hover:bg-primary/10"
                >
                  <Tag className="h-4 w-4 mr-1" />
                  Tags bearbeiten
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="start">
                <div className="space-y-2">
                  <p className="text-sm font-medium mb-2">Tags für {selectedIds.size} Belege</p>
                  <TagSelector
                    receiptIds={Array.from(selectedIds)}
                    size="sm"
                    onChange={() => {
                      toast({ title: `Tags für ${selectedIds.size} Belege aktualisiert` });
                      loadReceipts();
                    }}
                  />
                </div>
              </PopoverContent>
            </Popover>

            {/* Bulk Category */}
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  size="sm" 
                  variant="outline"
                  disabled={bulkActionLoading !== null}
                  className="border-primary/50 text-primary hover:bg-primary/10"
                >
                  <Folder className="h-4 w-4 mr-1" />
                  Kategorie
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3" align="start">
                <div className="space-y-2">
                  <p className="text-sm font-medium mb-2">Kategorie für {selectedIds.size} Belege</p>
                  <Select onValueChange={async (value) => {
                    try {
                      const ids = Array.from(selectedIds);
                      const categoryName = value === '__clear__' ? null : value;
                      for (const id of ids) {
                        await supabase
                          .from('receipts')
                          .update({ category: categoryName })
                          .eq('id', id);
                      }
                      toast({ title: `Kategorie für ${ids.length} Belege geändert` });
                      setSelectedIds(new Set());
                      loadReceipts();
                    } catch (error) {
                      toast({
                        variant: 'destructive',
                        title: 'Fehler',
                        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
                      });
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Kategorie wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__clear__">Nicht zugeordnet</SelectItem>
                      <SelectSeparator />
                      {userCategories.map(c => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </PopoverContent>
            </Popover>

            {/* Bulk Tax Type */}
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  size="sm" 
                  variant="outline"
                  disabled={bulkActionLoading !== null}
                  className="border-primary/50 text-primary hover:bg-primary/10"
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Buchungsart
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3" align="start">
                <div className="space-y-2">
                  <p className="text-sm font-medium mb-2">Buchungsart für {selectedIds.size} Belege</p>
                  <Select onValueChange={async (value) => {
                    try {
                      const ids = Array.from(selectedIds);
                      const taxType = value === '__clear__' ? null : value;
                      for (const id of ids) {
                        await supabase
                          .from('receipts')
                          .update({ tax_type: taxType })
                          .eq('id', id);
                      }
                      toast({ title: `Buchungsart für ${ids.length} Belege geändert` });
                      setSelectedIds(new Set());
                      loadReceipts();
                    } catch (error) {
                      toast({
                        variant: 'destructive',
                        title: 'Fehler',
                        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
                      });
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Buchungsart wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__clear__">Offen</SelectItem>
                      <SelectSeparator />
                      {taxCategories.map(c => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  size="sm" 
                  variant="outline"
                  disabled={bulkActionLoading !== null}
                  className="border-primary/50 text-primary hover:bg-primary/5 hover:text-primary"
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
            
            {/* Delete - nur anzeigen wenn NICHT im Duplikat-Filter (dort gibt es "Duplikate löschen") */}
            {statusFilter !== 'duplicate' && (
              <>
                <div className="h-4 w-px bg-border" />
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
              </>
            )}

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
                  <div className="overflow-x-auto">
                  <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleColumnDragEnd}>
                  <SortableContext items={orderedVisibleColumns} strategy={horizontalListSortingStrategy}>
                  <Table style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
                    <TableHeader>
                      <TableRow>
                        <TableHead style={{ width: 48, minWidth: 48, maxWidth: 48 }}>
                          <Checkbox
                            checked={isAllSelected}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead
                          className="text-right relative group px-2"
                          style={{ width: actionsColWidth, minWidth: actionsColWidth, maxWidth: actionsColWidth }}
                        >
                          <div
                            onPointerDown={handleActionsResizeDown}
                            className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40"
                            title="Spaltenbreite anpassen"
                          />
                          Aktionen
                        </TableHead>
                        {orderedVisibleColumns.map(key => {
                          const cfg = COLUMN_CONFIG.find(c => c.key === key)!;
                          const isSorted = cfg.sortField && sortField === cfg.sortField
                            ? sortDirection
                            : false as const;
                          return (
                            <EditableTableHead
                              key={key}
                              id={key}
                              label={cfg.label}
                              width={columnWidths[key]}
                              sortable={!!cfg.sortField}
                              isSorted={isSorted}
                              align={cfg.align}
                              onSort={cfg.sortField ? () => handleSort(cfg.sortField!) : undefined}
                              onResize={(w) => handleColumnResize(key, w)}
                            />
                          );
                        })}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedReceipts.map((receipt) => {
                        const isSplit = splitBookingEnabled && (receipt as any).is_split_booking === true;
                        const isExpanded = expandedIds.has(receipt.id);
                        const splitLines = splitLinesByReceiptId.get(receipt.id) || [];
                        const totalCols = 1 + orderedVisibleColumns.length + 1;
                        return (
                        <Fragment key={receipt.id}>
                        <TableRow key={receipt.id}>
                          <TableCell style={{ width: 48, minWidth: 48, maxWidth: 48 }}>
                            <div className="flex items-center gap-1">
                              {isSplit ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 -ml-1 text-muted-foreground hover:text-foreground"
                                  onClick={() => toggleExpand(receipt.id)}
                                  title={isExpanded ? 'Buchungssätze ausblenden' : 'Buchungssätze anzeigen'}
                                >
                                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                </Button>
                              ) : (
                                <span className="inline-block w-5" />
                              )}
                              <Checkbox
                                checked={selectedIds.has(receipt.id)}
                                onCheckedChange={(checked) =>
                                  handleSelectOne(receipt.id, checked as boolean)
                                }
                              />
                            </div>
                          </TableCell>
                          {orderedVisibleColumns.map(key => renderCell(receipt, key))}
                          <TableCell className="text-right px-2" style={{ width: actionsColWidth, minWidth: actionsColWidth, maxWidth: actionsColWidth }}>
                            <div className="flex items-center justify-end gap-0.5">
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
                              {receipt.status === 'needs_splitting' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-chart-4 hover:text-chart-4/80 hover:bg-chart-4/5"
                                  onClick={() => openSplitDialog(receipt)}
                                  title="PDF aufteilen"
                                >
                                  <Scissors className="h-4 w-4" />
                                </Button>
                              )}
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
                        {isSplit && isExpanded && (
                          <TableRow key={receipt.id + '-split'} className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={totalCols} className="p-0">
                              <div className="px-12 py-3">
                                <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                  <Layers className="h-3.5 w-3.5" />
                                  Buchungssätze ({splitLines.length})
                                </div>
                                {splitLines.length === 0 ? (
                                  <div className="text-xs text-muted-foreground italic py-2">
                                    Keine Buchungssätze gefunden
                                  </div>
                                ) : (
                                  <div className="rounded-md border bg-background overflow-hidden">
                                    <table className="w-full text-xs">
                                      <thead className="bg-muted/50">
                                        <tr className="text-left text-muted-foreground">
                                          <th className="px-3 py-2 font-medium">Beschreibung</th>
                                          <th className="px-3 py-2 font-medium">Kategorie</th>
                                          <th className="px-3 py-2 font-medium">Buchungsart</th>
                                          <th className="px-3 py-2 font-medium text-right">MwSt %</th>
                                          <th className="px-3 py-2 font-medium text-right">Netto</th>
                                          <th className="px-3 py-2 font-medium text-right">MwSt</th>
                                          <th className="px-3 py-2 font-medium text-right">Brutto</th>
                                          <th className="px-3 py-2 font-medium">Privat</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {splitLines.map(line => (
                                          <tr key={line.id} className="border-t">
                                            <td className="px-3 py-2">{line.description || <span className="text-muted-foreground">—</span>}</td>
                                            <td className="px-3 py-2">{line.category || <span className="text-muted-foreground">—</span>}</td>
                                            <td className="px-3 py-2">{line.tax_type || <span className="text-muted-foreground">—</span>}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{(line.vat_rate ?? 0).toFixed(2)}%</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{(line.amount_net ?? 0).toFixed(2)}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{(line.vat_amount ?? 0).toFixed(2)}</td>
                                            <td className="px-3 py-2 text-right tabular-nums font-medium">{(line.amount_gross ?? 0).toFixed(2)}</td>
                                            <td className="px-3 py-2">
                                              {line.is_private ? (
                                                <Badge variant="outline" className="text-[10px] h-5">Privat</Badge>
                                              ) : (
                                                <span className="text-muted-foreground">—</span>
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                        </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </SortableContext>
                  </DndContext>
                  </div>

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

          </TabsContent>
        </Tabs>

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
              Die ausgewählten Belege werden unwiderruflich gelöscht.
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
      </div>

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
        onViewReceipt={(id) => {
          setDuplicateComparisonOpen(false);
          openReceiptDetail(id);
        }}
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

      {/* Tax Export Dialog */}
      <TaxExportDialog
        open={taxExportOpen}
        onOpenChange={setTaxExportOpen}
        defaultBookingType="expenses"
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
  
    </>
  );
};

export default Expenses;
