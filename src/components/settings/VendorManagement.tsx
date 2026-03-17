import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building, Plus, Trash2, Edit2, ExternalLink, X, Check, Search, RotateCcw, ChevronLeft, ChevronRight, Tag, Merge, Download, Loader2, ArrowLeftRight, Users, ScanSearch, CheckCircle, Sparkles, AlertTriangle, Zap, Euro } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { importVendorsFromReceipts } from '@/services/vendorMatchingService';
import { findVendorDuplicates, type VendorDuplicateCandidate } from '@/services/vendorDuplicateService';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
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
import { useVendors, Vendor } from '@/hooks/useVendors';
import { useCategories, Category } from '@/hooks/useCategories';
import { useTags } from '@/hooks/useTags';
import { toast } from 'sonner';

const VAT_RATES = [
  { value: '20', label: '20%' },
  { value: '19', label: '19%' },
  { value: '13', label: '13%' },
  { value: '10', label: '10%' },
  { value: '7', label: '7%' },
  { value: '0', label: '0% (steuerfrei)' },
];

const ITEMS_PER_PAGE = 20;

type SortOption = 'receipt_count_desc' | 'receipt_count_asc' | 'total_amount_desc' | 'total_amount_asc' | 'name_asc' | 'name_desc' | 'created_desc';
type AdditionalFilter = 'all' | 'with_category' | 'without_category' | 'with_vat' | 'multiple_variants';

export function VendorManagement() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { vendors, loading, addVendor, updateVendor, deleteVendor, fetchVendors } = useVendors();
  const { categories } = useCategories();
  const { activeTags } = useTags();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [deleteConfirmVendor, setDeleteConfirmVendor] = useState<Vendor | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('receipt_count_desc');
  const [additionalFilter, setAdditionalFilter] = useState<AdditionalFilter>('all');

  // Selection state
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Bulk action dialogs
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkCategoryOpen, setIsBulkCategoryOpen] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState('');

  // Delete dialog state
  const [deleteOption, setDeleteOption] = useState<'keep' | 'move'>('keep');
  const [moveToVendorId, setMoveToVendorId] = useState('');

  // Merge dialog state
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [isMerging, setIsMerging] = useState(false);

  // Detailed merge dialog state
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [mergeSource, setMergeSource] = useState<Vendor | null>(null);
  const [mergeTarget, setMergeTarget] = useState<Vendor | null>(null);

  interface MergePreview {
    display_name: string;
    legal_names: string[];
    detected_names: string[];
    default_category_id: string | null;
    default_vat_rate: number | null;
    total_receipts: number;
    total_amount: number;
  }
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null);

  // Import state
  const [isImporting, setIsImporting] = useState(false);

  // Duplicate check state
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [vendorDuplicates, setVendorDuplicates] = useState<VendorDuplicateCandidate[]>([]);
  const [showDuplicateResults, setShowDuplicateResults] = useState(false);
  const [duplicateSensitivity, setDuplicateSensitivity] = useState(70);

  // Form state
  const [formData, setFormData] = useState({
    display_name: '',
    legal_names: [] as string[],
    detected_names: [] as string[],
    default_category_id: '',
    default_tag_id: '',
    default_vat_rate: '',
    default_payment_method: '',
    website: '',
    notes: '',
    auto_approve: false,
    auto_approve_min_confidence: 0.8,
    expenses_only_extraction: false,
    extraction_keywords: [] as string[],
    extraction_hint: '',
  });
  const [newVariant, setNewVariant] = useState('');
  const [newKeyword, setNewKeyword] = useState('');

  const resetForm = () => {
    setFormData({
      display_name: '',
      legal_names: [],
      detected_names: [],
      default_category_id: '',
      default_tag_id: '',
      default_vat_rate: '',
      default_payment_method: '',
      website: '',
      notes: '',
      auto_approve: false,
      auto_approve_min_confidence: 0.8,
      expenses_only_extraction: false,
      extraction_keywords: [],
      extraction_hint: '',
    });
    setNewVariant('');
    setNewKeyword('');
  };

  const openEditDialog = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      display_name: vendor.display_name,
      legal_names: vendor.legal_names || [],
      detected_names: vendor.detected_names || [],
      default_category_id: vendor.default_category_id || '',
      default_tag_id: vendor.default_tag_id || '',
      default_vat_rate: vendor.default_vat_rate?.toString() || '',
      default_payment_method: vendor.default_payment_method || '',
      website: vendor.website || '',
      notes: vendor.notes || '',
      auto_approve: vendor.auto_approve ?? false,
      auto_approve_min_confidence: vendor.auto_approve_min_confidence ?? 0.8,
      expenses_only_extraction: vendor.expenses_only_extraction ?? false,
      extraction_keywords: vendor.extraction_keywords || [],
      extraction_hint: vendor.extraction_hint || '',
    });
    setNewVariant('');
    setNewKeyword('');
  };

  // Deep-link: auto-open vendor edit dialog when vendorId is in URL
  useEffect(() => {
    const vendorId = searchParams.get('vendorId');
    if (!vendorId || loading || vendors.length === 0) return;

    const vendor = vendors.find(v => v.id === vendorId);
    if (vendor) {
      setSearchQuery(vendor.display_name);
      openEditDialog(vendor);
    }
    // Remove vendorId from URL to prevent re-triggering
    searchParams.delete('vendorId');
    setSearchParams(searchParams, { replace: true });
  }, [vendors, loading, searchParams]);

  const closeDialogs = () => {
    setIsAddDialogOpen(false);
    setEditingVendor(null);
    resetForm();
  };

  const addVariant = () => {
    if (newVariant.trim() && !formData.detected_names.includes(newVariant.trim())) {
      setFormData(prev => ({
        ...prev,
        detected_names: [...prev.detected_names, newVariant.trim()]
      }));
      setNewVariant('');
    }
  };

  const removeVariant = (index: number) => {
    setFormData(prev => ({
      ...prev,
      detected_names: prev.detected_names.filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    if (!formData.display_name.trim()) {
      toast.error('Bitte gib einen Namen ein');
      return;
    }

    setIsSaving(true);
    try {
      if (editingVendor) {
        const result = await updateVendor(editingVendor.id, {
          display_name: formData.display_name.trim(),
          legal_names: formData.legal_names.filter(n => n.trim()),
          detected_names: formData.detected_names,
          default_category_id: formData.default_category_id || null,
          default_tag_id: formData.default_tag_id || null,
          default_vat_rate: formData.default_vat_rate ? parseFloat(formData.default_vat_rate) : null,
          default_payment_method: formData.default_payment_method || null,
          website: formData.website.trim() || null,
          notes: formData.notes.trim() || null,
          auto_approve: formData.auto_approve,
          auto_approve_min_confidence: formData.auto_approve_min_confidence,
          expenses_only_extraction: formData.expenses_only_extraction,
          extraction_keywords: formData.extraction_keywords,
          extraction_hint: formData.extraction_hint,
        });
        const messages: string[] = [];
        if (result.syncedReceipts > 0) {
          messages.push(`${result.syncedReceipts} Beleg(e) synchronisiert`);
        }
        if (result.autoApprovedReceipts > 0) {
          messages.push(`${result.autoApprovedReceipts} Beleg(e) automatisch freigegeben`);
        }
        if (messages.length > 0) {
          toast.success(`Lieferant aktualisiert`, {
            description: messages.join(' · ')
          });
        } else {
          toast.success('Lieferant aktualisiert');
        }
      } else {
        await addVendor(formData.display_name.trim(), {
          legalName: formData.legal_names[0]?.trim() || undefined,
          detectedNames: formData.detected_names,
          defaultCategoryId: formData.default_category_id || undefined,
          defaultTagId: formData.default_tag_id || undefined,
          defaultVatRate: formData.default_vat_rate ? parseFloat(formData.default_vat_rate) : undefined,
          defaultPaymentMethod: formData.default_payment_method || undefined,
          website: formData.website.trim() || undefined,
          notes: formData.notes.trim() || undefined,
        });
        toast.success('Lieferant hinzugefügt');
      }
      closeDialogs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler beim Speichern');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmVendor) return;

    try {
      // Handle receipts based on user choice
      if (deleteConfirmVendor.receipt_count > 0) {
        if (deleteOption === 'move' && moveToVendorId) {
          // Move receipts to another vendor
          await supabase
            .from('receipts')
            .update({ vendor_id: moveToVendorId })
            .eq('vendor_id', deleteConfirmVendor.id);
        } else {
          // Keep receipts, just remove vendor link
          await supabase
            .from('receipts')
            .update({ vendor_id: null })
            .eq('vendor_id', deleteConfirmVendor.id);
        }
      }

      await deleteVendor(deleteConfirmVendor.id);
      toast.success('Lieferant gelöscht');
      setDeleteConfirmVendor(null);
      setDeleteOption('keep');
      setMoveToVendorId('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler beim Löschen');
    }
  };

  const handleMerge = async () => {
    if (!mergeTargetId || selectedVendors.length < 2) return;

    setIsMerging(true);
    try {
      const targetVendor = vendors.find(v => v.id === mergeTargetId);
      const sourceVendors = vendors.filter(v => selectedVendors.includes(v.id) && v.id !== mergeTargetId);

      if (!targetVendor) {
        throw new Error('Ziel-Lieferant nicht gefunden');
      }

      // Collect all detected_names
      const allDetectedNames = [
        ...targetVendor.detected_names,
        ...sourceVendors.flatMap(v => v.detected_names),
        ...sourceVendors.map(v => v.display_name) // Add display names as detected names
      ];
      const uniqueNames = [...new Set(allDetectedNames)];

      // Update target vendor with combined detected_names
      await supabase
        .from('vendors')
        .update({ detected_names: uniqueNames })
        .eq('id', mergeTargetId);

      // Move all receipts from source vendors to target
      for (const source of sourceVendors) {
        await supabase
          .from('receipts')
          .update({ vendor_id: mergeTargetId })
          .eq('vendor_id', source.id);
      }

      // Delete source vendors
      await supabase
        .from('vendors')
        .delete()
        .in('id', sourceVendors.map(v => v.id));

      toast.success(`${sourceVendors.length + 1} Lieferanten zusammengeführt`);
      setIsMergeOpen(false);
      setMergeTargetId('');
      setSelectedVendors([]);
      fetchVendors(); // Refresh data
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler beim Zusammenführen');
    } finally {
      setIsMerging(false);
    }
  };

  const openMergeDialog = () => {
    if (selectedVendors.length < 2) {
      toast.error('Bitte wähle mindestens 2 Lieferanten zum Zusammenführen');
      return;
    }
    setMergeTargetId('');
    setIsMergeOpen(true);
  };

  // Import vendors from receipts
  const handleImportFromReceipts = async () => {
    if (!user) return;
    
    setIsImporting(true);
    try {
      const result = await importVendorsFromReceipts(user.id);
      
      if (result.imported > 0) {
        toast.success(`${result.imported} Lieferanten importiert`);
        fetchVendors();
      } else {
        toast.info('Keine neuen Lieferanten in Belegen gefunden');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler beim Import');
    } finally {
      setIsImporting(false);
    }
  };

  // Vendor duplicate check
  const startVendorDuplicateCheck = async () => {
    setIsCheckingDuplicates(true);

    try {
      const duplicates = findVendorDuplicates(filteredVendors, duplicateSensitivity);
      setVendorDuplicates(duplicates);
      setShowDuplicateResults(true);

      if (duplicates.length === 0) {
        toast.success('Keine ähnlichen Lieferanten gefunden');
      }
    } catch (error) {
      toast.error('Fehler bei der Duplikat-Prüfung');
      console.error(error);
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  // Dismiss a single duplicate from the list
  const dismissDuplicate = (index: number) => {
    setVendorDuplicates(prev => prev.filter((_, i) => i !== index));
  };

  // Open detailed merge dialog for a specific duplicate pair
  const openMergePairDialog = (duplicate: Vendor, original: Vendor) => {
    setMergeSource(duplicate);
    setMergeTarget(original);

    // Calculate merge preview
    const allDetectedNames = [
      ...new Set([
        ...(original.detected_names || []),
        ...(duplicate.detected_names || []),
        duplicate.display_name // Add source name as variant
      ])
    ];

    setMergePreview({
      display_name: original.display_name,
      legal_names: [...new Set([...(original.legal_names || []), ...(duplicate.legal_names || [])])],
      detected_names: allDetectedNames,
      default_category_id: original.default_category_id || duplicate.default_category_id,
      default_vat_rate: original.default_vat_rate || duplicate.default_vat_rate,
      total_receipts: (original.receipt_count || 0) + (duplicate.receipt_count || 0),
      total_amount: (original.total_amount || 0) + (duplicate.total_amount || 0)
    });

    setShowMergeDialog(true);
  };

  // Execute detailed merge
  const executeMerge = async () => {
    if (!mergeSource || !mergeTarget || !mergePreview) return;

    setIsMerging(true);
    try {
      // 1. Update target vendor
      await supabase
        .from('vendors')
        .update({
          display_name: mergePreview.display_name,
          legal_names: mergePreview.legal_names,
          detected_names: mergePreview.detected_names,
          default_category_id: mergePreview.default_category_id,
          default_vat_rate: mergePreview.default_vat_rate,
          receipt_count: mergePreview.total_receipts,
          total_amount: mergePreview.total_amount
        })
        .eq('id', mergeTarget.id);

      // 2. Move receipts
      await supabase
        .from('receipts')
        .update({
          vendor_id: mergeTarget.id,
          vendor: mergePreview.display_name
        })
        .eq('vendor_id', mergeSource.id);

      // 3. Delete source vendor
      await supabase
        .from('vendors')
        .delete()
        .eq('id', mergeSource.id);

      toast.success('Lieferanten zusammengeführt');
      setShowMergeDialog(false);

      // Remove from duplicate list
      setVendorDuplicates(prev => prev.filter(d =>
        d.vendor.id !== mergeSource.id && d.matchingVendor.id !== mergeSource.id
      ));

      // Refresh vendor list
      fetchVendors();

    } catch (error) {
      toast.error('Fehler beim Zusammenführen');
      console.error(error);
    } finally {
      setIsMerging(false);
    }
  };

  // Merge all suggested duplicates
  const mergeAllSuggested = async () => {
    if (vendorDuplicates.length === 0) return;

    setIsMerging(true);
    let merged = 0;

    try {
      for (const item of vendorDuplicates) {
        const targetVendor = item.matchingVendor;
        const sourceVendor = item.vendor;

        // Collect all detected_names
        const allDetectedNames = [
          ...new Set([
            ...(targetVendor.detected_names || []),
            ...(sourceVendor.detected_names || []),
            sourceVendor.display_name
          ])
        ];

        // Update target vendor
        await supabase
          .from('vendors')
          .update({
            detected_names: allDetectedNames,
            receipt_count: (targetVendor.receipt_count || 0) + (sourceVendor.receipt_count || 0),
            total_amount: (targetVendor.total_amount || 0) + (sourceVendor.total_amount || 0)
          })
          .eq('id', targetVendor.id);

        // Move all receipts from source vendor to target
        await supabase
          .from('receipts')
          .update({
            vendor_id: targetVendor.id,
            vendor: targetVendor.display_name
          })
          .eq('vendor_id', sourceVendor.id);

        // Delete source vendor
        await supabase
          .from('vendors')
          .delete()
          .eq('id', sourceVendor.id);

        merged++;
      }

      toast.success(`${merged} Duplikate zusammengeführt`);
      setShowDuplicateResults(false);
      setVendorDuplicates([]);
      fetchVendors();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler beim Zusammenführen');
    } finally {
      setIsMerging(false);
    }
  };

  const getCategory = (categoryId: string | null): Category | null => {
    if (!categoryId) return null;
    return categories.find(c => c.id === categoryId) || null;
  };


  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setSortBy('receipt_count_desc');
    setAdditionalFilter('all');
    setCurrentPage(1);
  };

  // Selection helpers
  const toggleSelect = (vendorId: string) => {
    setSelectedVendors(prev =>
      prev.includes(vendorId)
        ? prev.filter(id => id !== vendorId)
        : [...prev, vendorId]
    );
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedVendors([]);
    } else {
      setSelectedVendors(paginatedVendors.map(v => v.id));
    }
  };

  // Bulk actions
  const handleBulkDelete = async () => {
    try {
      for (const id of selectedVendors) {
        await deleteVendor(id);
      }
      toast.success(`${selectedVendors.length} Lieferanten gelöscht`);
      setSelectedVendors([]);
      setIsBulkDeleteOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler beim Löschen');
    }
  };

  const handleBulkSetCategory = async () => {
    if (!bulkCategoryId) {
      toast.error('Bitte wähle eine Kategorie');
      return;
    }
    try {
      for (const id of selectedVendors) {
        await updateVendor(id, { default_category_id: bulkCategoryId });
      }
      toast.success(`Kategorie für ${selectedVendors.length} Lieferanten gesetzt`);
      setSelectedVendors([]);
      setIsBulkCategoryOpen(false);
      setBulkCategoryId('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler beim Aktualisieren');
    }
  };

  // Filter and sort vendors
  const filteredVendors = useMemo(() => {
    let result = [...vendors];

    // Text search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(v =>
        v.display_name.toLowerCase().includes(query) ||
        v.legal_name?.toLowerCase().includes(query) ||
        v.detected_names.some(n => n.toLowerCase().includes(query)) ||
        v.notes?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (categoryFilter === 'none') {
      result = result.filter(v => !v.default_category_id);
    } else if (categoryFilter !== 'all') {
      result = result.filter(v => v.default_category_id === categoryFilter);
    }

    // Additional filters
    switch (additionalFilter) {
      case 'with_category':
        result = result.filter(v => v.default_category_id);
        break;
      case 'without_category':
        result = result.filter(v => !v.default_category_id);
        break;
      case 'with_vat':
        result = result.filter(v => v.default_vat_rate !== null);
        break;
      case 'multiple_variants':
        result = result.filter(v => v.detected_names.length > 1);
        break;
    }

    // Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'receipt_count_desc':
          return b.receipt_count - a.receipt_count;
        case 'receipt_count_asc':
          return a.receipt_count - b.receipt_count;
        case 'total_amount_desc':
          return b.total_amount - a.total_amount;
        case 'total_amount_asc':
          return a.total_amount - b.total_amount;
        case 'name_asc':
          return a.display_name.localeCompare(b.display_name);
        case 'name_desc':
          return b.display_name.localeCompare(a.display_name);
        case 'created_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [vendors, searchQuery, categoryFilter, additionalFilter, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredVendors.length / ITEMS_PER_PAGE);
  const paginatedVendors = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredVendors.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredVendors, currentPage]);

  // Reset page when filters change
  useMemo(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [filteredVendors.length]);

  const allSelected = paginatedVendors.length > 0 && paginatedVendors.every(v => selectedVendors.includes(v.id));
  const hasActiveFilters = searchQuery || categoryFilter !== 'all' || additionalFilter !== 'all';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Lieferanten-Verwaltung</h3>
          <p className="text-sm text-muted-foreground">
            Verwalte erkannte Lieferanten und weise ihnen Standardwerte zu
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={startVendorDuplicateCheck} 
            disabled={isCheckingDuplicates || filteredVendors.length < 2}
          >
            {isCheckingDuplicates ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ScanSearch className="h-4 w-4 mr-2" />
            )}
            Duplikate prüfen
          </Button>
          <Button variant="outline" onClick={handleImportFromReceipts} disabled={isImporting}>
            {isImporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Aus Belegen importieren
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Neuer Lieferant
          </Button>
        </div>
      </div>

      {vendors.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/30">
          <Building className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Keine Lieferanten vorhanden</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Lieferanten werden automatisch beim Hochladen von Belegen erkannt oder können manuell hinzugefügt werden.
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={handleImportFromReceipts} disabled={isImporting}>
              {isImporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Aus Belegen importieren
            </Button>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Manuell erstellen
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/30 rounded-lg">
            {/* Search Field */}
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Suche nach Name, Varianten, Notizen..."
                  className="pl-10 pr-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
            </div>

            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Alle Kategorien" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kategorien</SelectItem>
                <SelectItem value="none">Ohne Kategorie</SelectItem>
                <Separator className="my-1" />
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <span className="flex items-center">
                      {cat.color && (
                        <span
                          className="w-2 h-2 rounded-full mr-2 flex-shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                      )}
                      {cat.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sortieren nach..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="receipt_count_desc">Meiste Belege</SelectItem>
                <SelectItem value="receipt_count_asc">Wenigste Belege</SelectItem>
                <SelectItem value="total_amount_desc">Höchster Umsatz</SelectItem>
                <SelectItem value="total_amount_asc">Niedrigster Umsatz</SelectItem>
                <SelectItem value="name_asc">Name A-Z</SelectItem>
                <SelectItem value="name_desc">Name Z-A</SelectItem>
                <SelectItem value="created_desc">Neueste zuerst</SelectItem>
              </SelectContent>
            </Select>

            {/* Additional Filters */}
            <Select value={additionalFilter} onValueChange={(v) => setAdditionalFilter(v as AdditionalFilter)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Weitere Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle anzeigen</SelectItem>
                <SelectItem value="with_category">Mit Standard-Kategorie</SelectItem>
                <SelectItem value="without_category">Ohne Standard-Kategorie</SelectItem>
                <SelectItem value="with_vat">Mit Standard-MwSt</SelectItem>
                <SelectItem value="multiple_variants">Mehrere Varianten</SelectItem>
              </SelectContent>
            </Select>

            {/* Reset Filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <RotateCcw className="w-4 h-4 mr-1" />
                Zurücksetzen
              </Button>
            )}
          </div>

          {/* Results Info */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {filteredVendors.length} von {vendors.length} Lieferanten
              {searchQuery && <span> für "{searchQuery}"</span>}
            </p>
          </div>

          {/* Bulk Actions */}
          {selectedVendors.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg">
              <span className="text-sm text-primary font-medium">
                {selectedVendors.length} ausgewählt
              </span>
              <div className="flex-1" />
              {selectedVendors.length >= 2 && (
                <Button variant="outline" size="sm" onClick={openMergeDialog}>
                  <Merge className="w-4 h-4 mr-1" />
                  Zusammenführen
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setIsBulkCategoryOpen(true)}>
                <Tag className="w-4 h-4 mr-1" />
                Kategorie setzen
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-destructive hover:text-destructive" 
                onClick={() => setIsBulkDeleteOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Löschen
              </Button>
            </div>
          )}

          {/* Table */}
          {filteredVendors.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-muted/30">
              <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Keine Ergebnisse</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Keine Lieferanten gefunden, die deinen Filterkriterien entsprechen.
              </p>
              <Button variant="outline" onClick={resetFilters}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Filter zurücksetzen
              </Button>
            </div>
          ) : (
            <>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Markenname</TableHead>
                      <TableHead>Rechtlicher Name</TableHead>
                      <TableHead>Erkannte Varianten</TableHead>
                      <TableHead>Standard-Kategorie</TableHead>
                      <TableHead className="text-right">Belege</TableHead>
                      <TableHead className="text-right">Umsatz</TableHead>
                      <TableHead className="w-[100px]">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedVendors.map((vendor) => {
                      const category = getCategory(vendor.default_category_id);
                      return (
                        <TableRow key={vendor.id} className="hover:bg-muted/50">
                          <TableCell>
                            <Checkbox
                              checked={selectedVendors.includes(vendor.id)}
                              onCheckedChange={() => toggleSelect(vendor.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {vendor.display_name}
                              {vendor.auto_approve && (
                                <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs">
                                  <Zap className="h-3 w-3 mr-0.5" />
                                  Auto
                                </Badge>
                              )}
                              {vendor.website && (
                                <a
                                  href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {vendor.legal_name || '–'}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {vendor.detected_names.slice(0, 3).map((name, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {name}
                                </Badge>
                              ))}
                              {vendor.detected_names.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{vendor.detected_names.length - 3}
                                </Badge>
                              )}
                              {vendor.detected_names.length === 0 && (
                                <span className="text-muted-foreground">–</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {category ? (
                              <Badge
                                style={{
                                  backgroundColor: category.color ? `${category.color}20` : undefined,
                                  color: category.color || undefined,
                                  borderColor: category.color || undefined,
                                }}
                                variant="outline"
                              >
                                {category.name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">–</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{vendor.receipt_count}</TableCell>
                          <TableCell className="text-right">{formatCurrency(vendor.total_amount)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(vendor)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteConfirmVendor(vendor)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Zeige {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredVendors.length)} von {filteredVendors.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => p - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm">Seite {currentPage} von {totalPages}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => p + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Bulk Delete Dialog */}
      <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lieferanten löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchtest du {selectedVendors.length} Lieferanten wirklich löschen?
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {selectedVendors.length} Lieferanten löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Category Dialog */}
      <Dialog open={isBulkCategoryOpen} onOpenChange={setIsBulkCategoryOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Kategorie setzen</DialogTitle>
            <DialogDescription>
              Wähle eine Standardkategorie für {selectedVendors.length} Lieferanten.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={bulkCategoryId} onValueChange={setBulkCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Kategorie auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <span className="flex items-center">
                      {cat.color && (
                        <span
                          className="w-2 h-2 rounded-full mr-2 flex-shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                      )}
                      {cat.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkCategoryOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleBulkSetCategory} disabled={!bulkCategoryId}>
              <Check className="h-4 w-4 mr-2" />
              Kategorie setzen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen || !!editingVendor} onOpenChange={closeDialogs}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingVendor ? 'Lieferant bearbeiten' : 'Neuer Lieferant'}
            </DialogTitle>
            <DialogDescription>
              {editingVendor
                ? 'Bearbeite die Lieferantendaten und Standardwerte.'
                : 'Füge einen neuen Lieferanten hinzu und lege Standardwerte fest.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Markenname (display_name) */}
            <div className="space-y-2">
              <Label htmlFor="display_name">Markenname *</Label>
              <Input
                id="display_name"
                value={formData.display_name}
                onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                placeholder="z.B. Amazon, spusu, MediaMarkt"
              />
              <p className="text-xs text-muted-foreground">
                Bekannter Name/Marke – wird in Listen und zur Identifikation verwendet
              </p>
            </div>

            {/* Rechtlicher Name */}
            <div className="space-y-2">
              <Label htmlFor="legal_name">Rechtlicher Firmenname</Label>
              <Input
                id="legal_name"
                value={formData.legal_name}
                onChange={(e) => setFormData(prev => ({ ...prev, legal_name: e.target.value }))}
                placeholder="z.B. Amazon EU S.à r.l., Mass Response Service GmbH"
              />
              <p className="text-xs text-muted-foreground">
                Offizieller Firmenname für Buchhaltung und Belege (falls abweichend)
              </p>
            </div>

            {/* Erkannte Varianten */}
            <div className="space-y-2">
              <Label>Erkannte Namen (KI)</Label>
              <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg min-h-[60px]">
                {formData.detected_names.map((name, i) => (
                  <Badge key={i} variant="secondary" className="flex items-center gap-1 pr-1">
                    {name}
                    <button
                      type="button"
                      onClick={() => removeVariant(i)}
                      className="ml-1 rounded-full hover:bg-muted p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                {formData.detected_names.length === 0 && (
                  <span className="text-muted-foreground text-sm">Keine Varianten erkannt</span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newVariant}
                  onChange={(e) => setNewVariant(e.target.value)}
                  placeholder="Neue Variante hinzufügen..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addVariant();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={addVariant}
                  disabled={!newVariant.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Standard-Kategorie */}
            <div className="space-y-2">
              <Label htmlFor="default_category">Standard-Kategorie</Label>
              <Select
                value={formData.default_category_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, default_category_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Keine (manuell wählen)" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <span className="flex items-center">
                        {category.color && (
                          <span
                            className="w-2 h-2 rounded-full mr-2 flex-shrink-0"
                            style={{ backgroundColor: category.color }}
                          />
                        )}
                        {category.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Wird automatisch bei neuen Belegen gesetzt
              </p>
            </div>

            {/* Standard-Tag */}
            <div className="space-y-2">
              <Label htmlFor="default_tag">Standard-Tag</Label>
              <Select
                value={formData.default_tag_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, default_tag_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kein Standard-Tag" />
                </SelectTrigger>
                <SelectContent>
                  {activeTags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      <span className="flex items-center">
                        <span
                          className="w-2 h-2 rounded-full mr-2 flex-shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Tag wird automatisch bei Lieferantenauswahl zugewiesen
              </p>
            </div>

            {/* Standard MwSt-Satz */}
            <div className="space-y-2">
              <Label htmlFor="default_vat_rate">Standard MwSt-Satz</Label>
              <Select
                value={formData.default_vat_rate}
                onValueChange={(value) => setFormData(prev => ({ ...prev, default_vat_rate: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Keine Vorgabe" />
                </SelectTrigger>
                <SelectContent>
                  {VAT_RATES.map((rate) => (
                    <SelectItem key={rate.value} value={rate.value}>
                      {rate.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Standard-Zahlungsart */}
            <div className="space-y-2">
              <Label htmlFor="default_payment_method">Standard-Zahlungsart</Label>
              <Select
                value={formData.default_payment_method}
                onValueChange={(value) => setFormData(prev => ({ ...prev, default_payment_method: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Keine Vorgabe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Überweisung">Überweisung</SelectItem>
                  <SelectItem value="Kreditkarte">Kreditkarte</SelectItem>
                  <SelectItem value="Debitkarte">Karte Debitzahlung</SelectItem>
                  <SelectItem value="Bar">Barzahlung</SelectItem>
                  <SelectItem value="PayPal">PayPal</SelectItem>
                  <SelectItem value="Apple Pay">Apple Pay</SelectItem>
                  <SelectItem value="Google Pay">Google Pay</SelectItem>
                  <SelectItem value="Lastschrift">Lastschrift</SelectItem>
                  <SelectItem value="Sonstige">Sonstige</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Zahlungsart wird automatisch bei Lieferantenauswahl zugewiesen
              </p>
            </div>

            {/* Website */}
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={formData.website}
                onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                placeholder="z.B. amazon.de"
              />
            </div>

            {/* Notizen */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notizen</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Optionale Anmerkungen..."
                rows={2}
              />
            </div>

            {/* Automatische Freigabe */}
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto_approve" className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-success" />
                    Automatische Freigabe
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Belege automatisch freigeben, wenn die KI-Erkennung sicher genug ist
                  </p>
                </div>
                <Switch
                  id="auto_approve"
                  checked={formData.auto_approve}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, auto_approve: checked }))}
                />
              </div>

              {formData.auto_approve && (
                <div className="space-y-3 pl-6 border-l-2 border-success/30">
                  <div className="space-y-2">
                    <Label className="text-sm">
                      Mindest-Konfidenz: {Math.round(formData.auto_approve_min_confidence * 100)}%
                    </Label>
                    <Slider
                      value={[formData.auto_approve_min_confidence * 100]}
                      onValueChange={([value]) => setFormData(prev => ({ ...prev, auto_approve_min_confidence: value / 100 }))}
                      min={60}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Nur Belege mit mindestens dieser KI-Sicherheit werden automatisch freigegeben
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-warning flex-shrink-0" />
                      Duplikate und PDFs mit mehreren Rechnungen werden nie automatisch freigegeben.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Nur Ausgaben extrahieren */}
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="expenses_only" className="flex items-center gap-2">
                    <Euro className="h-4 w-4 text-primary" />
                    Nur Ausgaben extrahieren
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Einnahmen/Gutschriften ignorieren (z.B. Monta, Marketplace-Anbieter)
                  </p>
                </div>
                <Switch
                  id="expenses_only"
                  checked={formData.expenses_only_extraction}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, expenses_only_extraction: checked }))}
                />
              </div>

              {/* Extraction Keywords - only visible when expenses_only is active */}
              {formData.expenses_only_extraction && (
                <div className="space-y-3 pl-6 border-l-2 border-primary/20 ml-2">
                  <Label className="text-sm">Schlagwörter für Kosten-Positionen</Label>
                  
                  {/* Keyword chips */}
                  {formData.extraction_keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {formData.extraction_keywords.map((keyword, index) => (
                        <Badge key={index} variant="secondary" className="gap-1 pr-1">
                          {keyword}
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              extraction_keywords: prev.extraction_keywords.filter((_, i) => i !== index)
                            }))}
                            className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  {/* Add keyword input */}
                  <div className="flex gap-2">
                    <Input
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      placeholder="z.B. Transaktionsgebühr"
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newKeyword.trim() && !formData.extraction_keywords.includes(newKeyword.trim())) {
                            setFormData(prev => ({
                              ...prev,
                              extraction_keywords: [...prev.extraction_keywords, newKeyword.trim()]
                            }));
                            setNewKeyword('');
                          }
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (newKeyword.trim() && !formData.extraction_keywords.includes(newKeyword.trim())) {
                          setFormData(prev => ({
                            ...prev,
                            extraction_keywords: [...prev.extraction_keywords, newKeyword.trim()]
                          }));
                          setNewKeyword('');
                        }
                      }}
                      disabled={!newKeyword.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    {formData.extraction_keywords.length === 0
                      ? 'Ohne Schlagwörter werden allgemein alle Kosten erfasst.'
                      : 'Die KI extrahiert nur Zeilen die diese Begriffe enthalten.'}
                  </p>

                  {/* Extraction Hint Textarea */}
                  <div className="space-y-1.5 pt-1">
                    <Label className="text-sm">Extraktions-Hinweis für die KI (optional)</Label>
                    <Textarea
                      value={formData.extraction_hint}
                      onChange={(e) => setFormData(prev => ({ ...prev, extraction_hint: e.target.value.slice(0, 500) }))}
                      placeholder="z.B. Beträge in Klammern sind Kosten und sollen als positive Werte behandelt werden"
                      rows={3}
                      maxLength={500}
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      {formData.extraction_hint.length}/500 Zeichen — Dieser Hinweis wird der KI bei jeder Analyse mitgegeben.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Statistik (nur bei Bearbeitung) */}
            {editingVendor && (
              <div className="bg-muted/50 rounded-lg p-4">
                <Label className="text-sm text-muted-foreground">Statistik</Label>
                <div className="flex gap-6 mt-2">
                  <div>
                    <span className="text-2xl font-semibold">{editingVendor.receipt_count}</span>
                    <span className="text-sm text-muted-foreground ml-1">Belege</span>
                  </div>
                  <div>
                    <span className="text-2xl font-semibold">{formatCurrency(editingVendor.total_amount)}</span>
                    <span className="text-sm text-muted-foreground ml-1">Gesamt</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeDialogs}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !formData.display_name.trim()}>
              {isSaving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              ) : editingVendor ? (
                <Check className="h-4 w-4 mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {editingVendor ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmVendor} onOpenChange={(open) => {
        if (!open) {
          setDeleteConfirmVendor(null);
          setDeleteOption('keep');
          setMoveToVendorId('');
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lieferant löschen</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {deleteConfirmVendor?.receipt_count && deleteConfirmVendor.receipt_count > 0 ? (
                  <div className="space-y-4">
                    <p>
                      Dieser Lieferant hat <strong>{deleteConfirmVendor.receipt_count} Belege</strong>. 
                      Was soll mit diesen passieren?
                    </p>

                    <RadioGroup value={deleteOption} onValueChange={(v) => setDeleteOption(v as 'keep' | 'move')}>
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="keep" id="keep" className="mt-1" />
                        <Label htmlFor="keep" className="font-normal cursor-pointer">
                          Belege behalten (Lieferant-Text bleibt, Verknüpfung wird entfernt)
                        </Label>
                      </div>
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="move" id="move" className="mt-1" />
                        <Label htmlFor="move" className="font-normal cursor-pointer">
                          Belege anderem Lieferanten zuordnen
                        </Label>
                      </div>
                    </RadioGroup>

                    {deleteOption === 'move' && (
                      <Select value={moveToVendorId} onValueChange={setMoveToVendorId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Ziel-Lieferant wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          {vendors
                            .filter(v => v.id !== deleteConfirmVendor.id)
                            .map(v => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.display_name} ({v.receipt_count} Belege)
                              </SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ) : (
                  <p>Möchtest du "{deleteConfirmVendor?.display_name}" wirklich löschen?</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteOption === 'move' && !moveToVendorId}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Merge Dialog */}
      <Dialog open={isMergeOpen} onOpenChange={(open) => {
        if (!open) {
          setIsMergeOpen(false);
          setMergeTargetId('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lieferanten zusammenführen</DialogTitle>
            <DialogDescription>
              {selectedVendors.length} Lieferanten werden zusammengeführt. 
              Wähle den Namen der beibehalten werden soll.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Ziel-Lieferant (wird beibehalten)</Label>
              <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Lieferant wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {vendors
                    .filter(v => selectedVendors.includes(v.id))
                    .map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.display_name} ({v.receipt_count} Belege)
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground font-medium">Nach dem Zusammenführen:</p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• Alle erkannten Varianten werden kombiniert</li>
                <li>• Alle Belege werden dem Ziel zugeordnet</li>
                <li>• Die anderen Lieferanten werden gelöscht</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsMergeOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleMerge} disabled={!mergeTargetId || isMerging}>
              {isMerging ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              ) : (
                <Merge className="h-4 w-4 mr-2" />
              )}
              Zusammenführen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vendor Duplicate Results Dialog */}
      <Dialog open={showDuplicateResults} onOpenChange={setShowDuplicateResults}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-warning" />
              Ähnliche Lieferanten gefunden
            </DialogTitle>
            <DialogDescription>
              Prüfe diese Lieferanten und führe sie bei Bedarf zusammen
            </DialogDescription>
          </DialogHeader>

          {/* Sensitivity Slider */}
          <div className="flex items-center gap-4 py-2 px-1">
            <Label className="text-sm whitespace-nowrap">Mindest-Ähnlichkeit:</Label>
            <Slider
              value={[duplicateSensitivity]}
              onValueChange={([v]) => setDuplicateSensitivity(v)}
              min={50}
              max={95}
              step={5}
              className="flex-1"
            />
            <span className="text-sm font-medium w-12">{duplicateSensitivity}%</span>
            <Button
              variant="outline"
              size="sm"
              onClick={startVendorDuplicateCheck}
              disabled={isCheckingDuplicates}
            >
              {isCheckingDuplicates ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Neu prüfen'
              )}
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {vendorDuplicates.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
                <p className="font-medium">Keine ähnlichen Lieferanten gefunden</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Alle Lieferanten sind ausreichend unterschiedlich
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {vendorDuplicates.map((item, i) => (
                  <Card key={i} className="border-warning/30">
                    <CardContent className="py-4">
                      <div className="flex items-start gap-4">
                        {/* Left Side: Possible Duplicate */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                              Mögliches Duplikat
                            </Badge>
                          </div>
                          <p className="font-medium">{item.vendor.display_name}</p>
                          {item.vendor.legal_name && (
                            <p className="text-sm text-muted-foreground">{item.vendor.legal_name}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.vendor.receipt_count} Belege • {formatCurrency(item.vendor.total_amount || 0)}
                          </p>
                        </div>

                        {/* Center: Similarity */}
                        <div className="flex flex-col items-center px-4">
                          <div className={`
                            w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold
                            ${item.score >= 90 ? 'bg-destructive/10 text-destructive' :
                              item.score >= 80 ? 'bg-warning/10 text-warning' :
                              'bg-yellow-100 text-yellow-700'}
                          `}>
                            {item.score}%
                          </div>
                          <ArrowLeftRight className="w-4 h-4 text-muted-foreground my-2" />
                          <div className="flex flex-wrap gap-1 justify-center max-w-[120px]">
                            {item.matchReasons.slice(0, 2).map((reason, j) => (
                              <Badge key={j} variant="outline" className="text-xs">
                                {reason}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Right Side: Original */}
                        <div className="flex-1 text-right">
                          <div className="flex items-center justify-end gap-2 mb-1">
                            <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                              Vorgeschlagenes Ziel
                            </Badge>
                          </div>
                          <p className="font-medium">{item.matchingVendor.display_name}</p>
                          {item.matchingVendor.legal_name && (
                            <p className="text-sm text-muted-foreground">{item.matchingVendor.legal_name}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.matchingVendor.receipt_count} Belege • {formatCurrency(item.matchingVendor.total_amount || 0)}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 ml-4">
                          <Button
                            size="sm"
                            onClick={() => openMergePairDialog(item.vendor, item.matchingVendor)}
                          >
                            <Merge className="w-4 h-4 mr-1" />
                            Zusammenführen
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => dismissDuplicate(i)}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Ignorieren
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <div className="flex items-center gap-2 mr-auto text-sm text-muted-foreground">
              {vendorDuplicates.length} mögliche Duplikate
            </div>
            <Button variant="outline" onClick={() => setShowDuplicateResults(false)}>
              Schließen
            </Button>
            {vendorDuplicates.length > 0 && (
              <Button onClick={mergeAllSuggested} disabled={isMerging}>
                {isMerging ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Merge className="w-4 h-4 mr-2" />
                )}
                Alle zusammenführen
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detailed Merge Dialog */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Merge className="w-5 h-5 text-primary" />
              Lieferanten zusammenführen
            </DialogTitle>
            <DialogDescription>
              Die Belege von "{mergeSource?.display_name}" werden zu "{mergeTarget?.display_name}" verschoben
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Before/After Comparison */}
            <div className="grid grid-cols-2 gap-4">
              {/* Left: Will be deleted */}
              <Card className="border-destructive/30 bg-destructive/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                    <Trash2 className="w-4 h-4" />
                    Wird gelöscht
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p className="font-medium">{mergeSource?.display_name}</p>
                  {mergeSource?.legal_name && (
                    <p className="text-muted-foreground">{mergeSource.legal_name}</p>
                  )}
                  <p className="text-muted-foreground">
                    {mergeSource?.receipt_count} Belege
                  </p>
                </CardContent>
              </Card>

              {/* Right: Will be kept */}
              <Card className="border-success/30 bg-success/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-success">
                    <Check className="w-4 h-4" />
                    Wird beibehalten
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p className="font-medium">{mergeTarget?.display_name}</p>
                  {mergeTarget?.legal_name && (
                    <p className="text-muted-foreground">{mergeTarget.legal_name}</p>
                  )}
                  <p className="text-muted-foreground">
                    {mergeTarget?.receipt_count} Belege
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Result Preview */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Ergebnis nach Zusammenführung
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Display Name */}
                <div>
                  <Label className="text-xs text-muted-foreground">Markenname</Label>
                  <Input
                    value={mergePreview?.display_name || ''}
                    onChange={(e) => setMergePreview(prev => prev ? { ...prev, display_name: e.target.value } : null)}
                  />
                </div>

                {/* Legal Name */}
                <div>
                  <Label className="text-xs text-muted-foreground">Rechtlicher Firmenname</Label>
                  <Input
                    value={mergePreview?.legal_name || ''}
                    onChange={(e) => setMergePreview(prev => prev ? { ...prev, legal_name: e.target.value } : null)}
                    placeholder="Optional"
                  />
                </div>

                {/* Detected Variants */}
                <div>
                  <Label className="text-xs text-muted-foreground">Erkannte Varianten</Label>
                  <div className="flex flex-wrap gap-1 p-2 bg-muted/30 rounded-lg min-h-[40px]">
                    {mergePreview?.detected_names.map((name, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {name}
                        <button
                          className="ml-1 hover:text-destructive"
                          onClick={() => {
                            setMergePreview(prev => prev ? {
                              ...prev,
                              detected_names: prev.detected_names.filter((_, j) => j !== i)
                            } : null);
                          }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Statistics */}
                <div className="flex gap-4 pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Gesamt Belege</p>
                    <p className="font-semibold">{mergePreview?.total_receipts}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Gesamt Umsatz</p>
                    <p className="font-semibold">{formatCurrency(mergePreview?.total_amount || 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Warning */}
            <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-warning">Achtung</p>
                <p className="text-muted-foreground">Diese Aktion kann nicht rückgängig gemacht werden. Alle Belege von "{mergeSource?.display_name}" werden "{mergeTarget?.display_name}" zugeordnet.</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMergeDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={executeMerge} disabled={isMerging}>
              {isMerging ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Merge className="w-4 h-4 mr-2" />
              )}
              Zusammenführen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
