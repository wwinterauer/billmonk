import { useState, useMemo } from 'react';
import { Building, Plus, Trash2, Edit2, ExternalLink, X, Check, AlertCircle, Search, RotateCcw, ChevronLeft, ChevronRight, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
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
  const { vendors, loading, addVendor, updateVendor, deleteVendor } = useVendors();
  const { categories } = useCategories();
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

  // Form state
  const [formData, setFormData] = useState({
    display_name: '',
    legal_name: '',
    detected_names: [] as string[],
    default_category_id: '',
    default_vat_rate: '',
    website: '',
    notes: '',
  });
  const [newVariant, setNewVariant] = useState('');

  const resetForm = () => {
    setFormData({
      display_name: '',
      legal_name: '',
      detected_names: [],
      default_category_id: '',
      default_vat_rate: '',
      website: '',
      notes: '',
    });
    setNewVariant('');
  };

  const openEditDialog = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      display_name: vendor.display_name,
      legal_name: vendor.legal_name || '',
      detected_names: vendor.detected_names || [],
      default_category_id: vendor.default_category_id || '',
      default_vat_rate: vendor.default_vat_rate?.toString() || '',
      website: vendor.website || '',
      notes: vendor.notes || '',
    });
    setNewVariant('');
  };

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
        await updateVendor(editingVendor.id, {
          display_name: formData.display_name.trim(),
          legal_name: formData.legal_name.trim() || null,
          detected_names: formData.detected_names,
          default_category_id: formData.default_category_id || null,
          default_vat_rate: formData.default_vat_rate ? parseFloat(formData.default_vat_rate) : null,
          website: formData.website.trim() || null,
          notes: formData.notes.trim() || null,
        });
        toast.success('Lieferant aktualisiert');
      } else {
        await addVendor(formData.display_name.trim(), {
          legalName: formData.legal_name.trim() || undefined,
          detectedNames: formData.detected_names,
          defaultCategoryId: formData.default_category_id || undefined,
          defaultVatRate: formData.default_vat_rate ? parseFloat(formData.default_vat_rate) : undefined,
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
      await deleteVendor(deleteConfirmVendor.id);
      toast.success('Lieferant gelöscht');
      setDeleteConfirmVendor(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler beim Löschen');
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
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Neuer Lieferant
        </Button>
      </div>

      {vendors.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/30">
          <Building className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Keine Lieferanten vorhanden</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Lieferanten werden automatisch beim Hochladen von Belegen erkannt oder können manuell hinzugefügt werden.
          </p>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ersten Lieferanten hinzufügen
          </Button>
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
                      <TableHead>Anzeigename</TableHead>
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
            {/* Anzeigename */}
            <div className="space-y-2">
              <Label htmlFor="display_name">Anzeigename *</Label>
              <Input
                id="display_name"
                value={formData.display_name}
                onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                placeholder="z.B. Amazon"
              />
              <p className="text-xs text-muted-foreground">
                Dieser Name wird in Listen und Exporten verwendet
              </p>
            </div>

            {/* Rechtlicher Name */}
            <div className="space-y-2">
              <Label htmlFor="legal_name">Rechtlicher Firmenname</Label>
              <Input
                id="legal_name"
                value={formData.legal_name}
                onChange={(e) => setFormData(prev => ({ ...prev, legal_name: e.target.value }))}
                placeholder="z.B. Amazon EU S.à r.l."
              />
              <p className="text-xs text-muted-foreground">
                Optional: Vollständiger Name für Buchhaltung
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
      <AlertDialog open={!!deleteConfirmVendor} onOpenChange={() => setDeleteConfirmVendor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lieferant löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchtest du den Lieferanten "{deleteConfirmVendor?.display_name}" wirklich löschen?
              {deleteConfirmVendor?.receipt_count && deleteConfirmVendor.receipt_count > 0 && (
                <span className="block mt-2 text-amber-600">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  Dieser Lieferant ist mit {deleteConfirmVendor.receipt_count} Beleg(en) verknüpft.
                  Die Belege bleiben erhalten, aber der Lieferant wird entfernt.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
