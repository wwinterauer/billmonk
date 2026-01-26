import { useState } from 'react';
import { Building, Plus, Trash2, Edit2, ExternalLink, X, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { useCategories } from '@/hooks/useCategories';
import { toast } from 'sonner';

const VAT_RATES = [
  { value: '19', label: '19%' },
  { value: '7', label: '7%' },
  { value: '0', label: '0%' },
];

export function VendorManagement() {
  const { vendors, loading, addVendor, updateVendor, deleteVendor } = useVendors();
  const { categories } = useCategories();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [deleteConfirmVendor, setDeleteConfirmVendor] = useState<Vendor | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    display_name: '',
    legal_name: '',
    default_category_id: '',
    default_vat_rate: '',
    website: '',
    notes: '',
  });

  const resetForm = () => {
    setFormData({
      display_name: '',
      legal_name: '',
      default_category_id: '',
      default_vat_rate: '',
      website: '',
      notes: '',
    });
  };

  const openEditDialog = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      display_name: vendor.display_name,
      legal_name: vendor.legal_name || '',
      default_category_id: vendor.default_category_id || '',
      default_vat_rate: vendor.default_vat_rate?.toString() || '',
      website: vendor.website || '',
      notes: vendor.notes || '',
    });
  };

  const closeDialogs = () => {
    setIsAddDialogOpen(false);
    setEditingVendor(null);
    resetForm();
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
          default_category_id: formData.default_category_id || null,
          default_vat_rate: formData.default_vat_rate ? parseFloat(formData.default_vat_rate) : null,
          website: formData.website.trim() || null,
          notes: formData.notes.trim() || null,
        });
        toast.success('Lieferant aktualisiert');
      } else {
        await addVendor(formData.display_name.trim(), {
          legalName: formData.legal_name.trim() || undefined,
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

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return '-';
    const category = categories.find(c => c.id === categoryId);
    return category?.name || '-';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

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
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Rechtlicher Name</TableHead>
                <TableHead>Standardkategorie</TableHead>
                <TableHead>MwSt.</TableHead>
                <TableHead className="text-right">Belege</TableHead>
                <TableHead className="text-right">Gesamt</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.map((vendor) => (
                <TableRow key={vendor.id}>
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
                    {vendor.legal_name || '-'}
                  </TableCell>
                  <TableCell>{getCategoryName(vendor.default_category_id)}</TableCell>
                  <TableCell>
                    {vendor.default_vat_rate !== null ? `${vendor.default_vat_rate}%` : '-'}
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
                        onClick={() => setDeleteConfirmVendor(vendor)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen || !!editingVendor} onOpenChange={closeDialogs}>
        <DialogContent className="sm:max-w-[500px]">
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

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="display_name">Anzeigename *</Label>
              <Input
                id="display_name"
                value={formData.display_name}
                onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                placeholder="z.B. Amazon"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="legal_name">Rechtlicher Name</Label>
              <Input
                id="legal_name"
                value={formData.legal_name}
                onChange={(e) => setFormData(prev => ({ ...prev, legal_name: e.target.value }))}
                placeholder="z.B. Amazon EU S.à r.l."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="default_category">Standardkategorie</Label>
                <Select
                  value={formData.default_category_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, default_category_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="default_vat_rate">Standard-MwSt.</Label>
                <Select
                  value={formData.default_vat_rate}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, default_vat_rate: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Auswählen..." />
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
            </div>

            <div className="grid gap-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={formData.website}
                onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                placeholder="z.B. amazon.de"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notizen</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Zusätzliche Informationen..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialogs}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              ) : editingVendor ? (
                <Check className="h-4 w-4 mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {editingVendor ? 'Speichern' : 'Hinzufügen'}
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
