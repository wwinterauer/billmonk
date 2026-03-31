import { useState, useEffect } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  FolderOpen,
  Paperclip,
  Monitor,
  Plane,
  Coffee,
  Phone,
  Shield,
  Building,
  Car,
  Megaphone,
  MoreHorizontal,
  ShoppingCart,
  Wrench,
  Heart,
  Book,
  Briefcase,
  CreditCard,
  Gift,
  Home,
  Package,
  Truck,
  Utensils,
  Wifi,
  Zap,
  FileText,
  Flower2,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useBookingTypes } from '@/hooks/useBookingTypes';
import { usePlan } from '@/hooks/usePlan';

// Icon mapping
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Paperclip, Monitor, Plane, Coffee, Phone, Shield, Building, Car, Megaphone,
  MoreHorizontal, ShoppingCart, Wrench, Heart, Book, Briefcase, CreditCard,
  Gift, Home, Package, Truck, Utensils, Wifi, Zap, FileText, FolderOpen, Flower2,
};

const AVAILABLE_ICONS = Object.keys(ICON_MAP);

const COLOR_PALETTE = [
  '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#6366F1',
  '#64748B', '#EF4444', '#F97316', '#14B8A6', '#84CC16', '#A855F7',
];

interface Category {
  id: string;
  user_id: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  is_system: boolean;
  is_hidden: boolean;
  sort_order: number;
  created_at: string;
  receipt_count?: number;
  country: string | null;
  tax_code: string | null;
}

interface CategoryFormData {
  name: string;
  icon: string;
  color: string;
  is_hidden: boolean;
}

const DEFAULT_FORM_DATA: CategoryFormData = {
  name: '',
  icon: 'FileText',
  color: COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)],
  is_hidden: false,
};

export function CategoryManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { effectivePlan } = usePlan();
  const {
    bookingTypes,
    loading: bookingTypesLoading,
    toggleHidden,
    updateBookingKey,
    addCustomType,
    removeCustomType,
  } = useBookingTypes();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(DEFAULT_FORM_DATA);
  const [isNewCategory, setIsNewCategory] = useState(true);
  const [reassignCategory, setReassignCategory] = useState<string>('');

  // Booking type add modal
  const [addBookingTypeOpen, setAddBookingTypeOpen] = useState(false);
  const [newBookingTypeName, setNewBookingTypeName] = useState('');
  const [newBookingTypeKey, setNewBookingTypeKey] = useState('');
  const [bookingKeySaving, setBookingKeySaving] = useState<string | null>(null);

  const isBusinessPlan = effectivePlan === 'business';

  // Fetch only personal categories (not system/tax ones)
  const fetchCategories = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('*')
        .eq('is_system', false)
        .order('sort_order', { ascending: true })
        .order('name');

      if (catError) throw catError;

      const { data: countData } = await supabase
        .from('receipts')
        .select('category')
        .eq('user_id', user.id);

      const counts: Record<string, number> = {};
      countData?.forEach(r => {
        if (r.category) counts[r.category] = (counts[r.category] || 0) + 1;
      });

      const categoriesWithCounts = (catData || []).map(cat => ({
        ...cat,
        is_hidden: cat.is_hidden ?? false,
        sort_order: cat.sort_order ?? 0,
        receipt_count: counts[cat.name] || 0,
        country: (cat as any).country ?? null,
        tax_code: (cat as any).tax_code ?? null,
      })) as Category[];

      setCategories(categoriesWithCounts);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Fehler beim Laden', description: error instanceof Error ? error.message : 'Unbekannter Fehler' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategories(); }, [user]);

  const handleNewCategory = () => {
    setIsNewCategory(true);
    setSelectedCategory(null);
    setFormData({ ...DEFAULT_FORM_DATA, color: COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)] });
    setEditModalOpen(true);
  };

  const handleEdit = (category: Category) => {
    setIsNewCategory(false);
    setSelectedCategory(category);
    setFormData({ name: category.name, icon: category.icon || 'FileText', color: category.color || '#3B82F6', is_hidden: category.is_hidden });
    setEditModalOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (formData.name.trim().length < 2) {
      toast({ variant: 'destructive', title: 'Name zu kurz', description: 'Der Name muss mindestens 2 Zeichen haben.' });
      return;
    }
    if (formData.name.length > 50) {
      toast({ variant: 'destructive', title: 'Name zu lang', description: 'Der Name darf maximal 50 Zeichen haben.' });
      return;
    }
    const duplicate = categories.find(c => c.name.toLowerCase() === formData.name.trim().toLowerCase() && c.id !== selectedCategory?.id);
    if (duplicate) {
      toast({ variant: 'destructive', title: 'Name bereits vergeben', description: 'Eine Kategorie mit diesem Namen existiert bereits.' });
      return;
    }

    setSaving(true);
    try {
      if (isNewCategory) {
        const maxSortOrder = Math.max(...categories.map(c => c.sort_order), 0);
        const { error } = await supabase.from('categories').insert({
          user_id: user.id, name: formData.name.trim(), icon: formData.icon,
          color: formData.color, is_system: false, is_hidden: formData.is_hidden, sort_order: maxSortOrder + 1,
        });
        if (error) throw error;
        toast({ title: 'Kategorie erstellt' });
      } else if (selectedCategory) {
        const { error } = await supabase.from('categories')
          .update({ name: formData.name.trim(), icon: formData.icon, color: formData.color, is_hidden: formData.is_hidden })
          .eq('id', selectedCategory.id);
        if (error) throw error;
        if (selectedCategory.name !== formData.name.trim()) {
          await supabase.from('receipts').update({ category: formData.name.trim() }).eq('category', selectedCategory.name).eq('user_id', user.id);
        }
        toast({ title: 'Kategorie aktualisiert' });
      }
      setEditModalOpen(false);
      fetchCategories();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Fehler beim Speichern', description: error instanceof Error ? error.message : 'Unbekannter Fehler' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (category: Category) => {
    setSelectedCategory(category);
    setReassignCategory('');
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedCategory || !user) return;
    setSaving(true);
    try {
      if (selectedCategory.receipt_count && selectedCategory.receipt_count > 0 && reassignCategory) {
        await supabase.from('receipts').update({ category: reassignCategory }).eq('category', selectedCategory.name).eq('user_id', user.id);
      }
      const { error } = await supabase.from('categories').delete().eq('id', selectedCategory.id);
      if (error) throw error;
      toast({ title: 'Kategorie gelöscht' });
      setDeleteDialogOpen(false);
      fetchCategories();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Fehler beim Löschen', description: error instanceof Error ? error.message : 'Unbekannter Fehler' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisibility = async (category: Category) => {
    try {
      const { error } = await supabase.from('categories').update({ is_hidden: !category.is_hidden }).eq('id', category.id);
      if (error) throw error;
      setCategories(prev => prev.map(c => c.id === category.id ? { ...c, is_hidden: !c.is_hidden } : c));
      toast({ title: category.is_hidden ? 'Kategorie eingeblendet' : 'Kategorie ausgeblendet' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Fehler', description: error instanceof Error ? error.message : 'Unbekannter Fehler' });
    }
  };

  const renderIcon = (iconName: string | null, color: string | null) => {
    const IconComponent = iconName ? ICON_MAP[iconName] : FileText;
    if (!IconComponent) return <FileText className="h-4 w-4" />;
    return (
      <div className="h-6 w-6 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
        <IconComponent className="h-3.5 w-3.5" style={{ color: color || '#64748B' }} />
      </div>
    );
  };

  const handleAddBookingType = async () => {
    if (!newBookingTypeName.trim()) return;
    const exists = bookingTypes.some(bt => bt.name.toLowerCase() === newBookingTypeName.trim().toLowerCase());
    if (exists) {
      toast({ variant: 'destructive', title: 'Name bereits vergeben' });
      return;
    }
    const success = await addCustomType(newBookingTypeName.trim(), newBookingTypeKey.trim());
    if (success) {
      toast({ title: 'Buchungsart hinzugefügt' });
      setAddBookingTypeOpen(false);
      setNewBookingTypeName('');
      setNewBookingTypeKey('');
    }
  };

  const handleBookingKeyChange = async (name: string, key: string) => {
    setBookingKeySaving(name);
    await updateBookingKey(name, key);
    setBookingKeySaving(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ===== SECTION 1: Meine Kategorien ===== */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Meine Kategorien</h3>
          <p className="text-sm text-muted-foreground">Deine persönlichen Kategorien zur Organisation deiner Belege.</p>
        </div>
        <Button onClick={handleNewCategory}>
          <Plus className="h-4 w-4 mr-2" />
          Neue Kategorie
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Belege</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Keine eigenen Kategorien vorhanden. Erstelle deine erste Kategorie.
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow key={category.id} className={cn(category.is_hidden && 'opacity-50')}>
                  <TableCell>{renderIcon(category.icon, category.color)}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1.5">
                      {category.name}
                      {category.is_hidden && <Badge variant="outline" className="text-xs">Ausgeblendet</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{category.receipt_count || 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleVisibility(category)}>
                        {category.is_hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(category)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteClick(category)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ===== SEPARATOR ===== */}
      <Separator className="my-8" />

      {/* ===== SECTION 2: Buchungsarten ===== */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Buchungsarten</h3>
          <p className="text-sm text-muted-foreground">
            Steuerliche Einordnung deiner Belege. Wird in Exporten und für den Steuerberater verwendet.
          </p>
        </div>
        <Button variant="outline" onClick={() => setAddBookingTypeOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Buchungsart hinzufügen
        </Button>
      </div>

      {bookingTypesLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Typ</TableHead>
                {isBusinessPlan && <TableHead>Buchungsschlüssel</TableHead>}
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookingTypes.map((bt) => (
                <TableRow key={bt.name} className={cn(bt.isHidden && 'opacity-50')}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1.5">
                      {bt.label}
                      {bt.isHidden && <Badge variant="outline" className="text-xs">Ausgeblendet</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={bt.isSystem ? 'secondary' : 'outline'}>
                      {bt.isSystem ? 'Standard' : 'Eigene'}
                    </Badge>
                  </TableCell>
                  {isBusinessPlan && (
                    <TableCell>
                      <Input
                        value={bt.bookingKey}
                        onChange={(e) => handleBookingKeyChange(bt.name, e.target.value)}
                        placeholder="z.B. 4400"
                        className="h-8 w-32 font-mono text-sm"
                        disabled={bookingKeySaving === bt.name}
                      />
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleHidden(bt.name)}
                        title={bt.isHidden ? 'Einblenden' : 'Ausblenden'}>
                        {bt.isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                      {!bt.isSystem && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeCustomType(bt.name)} title="Löschen">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ===== MODALS ===== */}

      {/* Add Booking Type Modal */}
      <Dialog open={addBookingTypeOpen} onOpenChange={setAddBookingTypeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Neue Buchungsart</DialogTitle>
            <DialogDescription>Füge eine eigene Buchungsart für deine steuerliche Einordnung hinzu.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={newBookingTypeName} onChange={(e) => setNewBookingTypeName(e.target.value)} placeholder="z.B. Privatentnahme" maxLength={50} />
            </div>
            {isBusinessPlan && (
              <div className="space-y-2">
                <Label>Buchungsschlüssel (optional)</Label>
                <Input value={newBookingTypeKey} onChange={(e) => setNewBookingTypeKey(e.target.value)} placeholder="z.B. 1800" className="font-mono" maxLength={20} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddBookingTypeOpen(false)}>Abbrechen</Button>
            <Button onClick={handleAddBookingType} disabled={!newBookingTypeName.trim()}>Hinzufügen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit/Create Category Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isNewCategory ? 'Neue Kategorie erstellen' : 'Kategorie bearbeiten'}</DialogTitle>
            <DialogDescription>
              {isNewCategory ? 'Erstelle eine neue Kategorie für deine Belege.' : 'Bearbeite die Kategorie-Einstellungen.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input id="cat-name" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="z.B. Fortbildung" maxLength={50} />
              <p className="text-xs text-muted-foreground">{formData.name.length}/50 Zeichen</p>
            </div>
            <div className="space-y-2">
              <Label>Farbe</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PALETTE.map((color) => (
                  <button key={color} type="button"
                    className={cn("h-8 w-8 rounded-full border-2 transition-all", formData.color === color ? "border-foreground scale-110" : "border-transparent")}
                    style={{ backgroundColor: color }} onClick={() => setFormData(prev => ({ ...prev, color }))} />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Label htmlFor="custom-color" className="text-xs">Custom:</Label>
                <Input id="custom-color" type="color" value={formData.color} onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))} className="w-12 h-8 p-1 cursor-pointer" />
                <Input value={formData.color} onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))} placeholder="#3B82F6" className="w-24 font-mono text-sm" maxLength={7} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="grid grid-cols-8 gap-2 max-h-[160px] overflow-y-auto p-1">
                {AVAILABLE_ICONS.map((iconName) => {
                  const IconComponent = ICON_MAP[iconName];
                  return (
                    <button key={iconName} type="button"
                      className={cn("h-9 w-9 rounded-lg border flex items-center justify-center transition-all", formData.icon === iconName ? "border-primary bg-primary/10" : "border-border hover:bg-muted")}
                      onClick={() => setFormData(prev => ({ ...prev, icon: iconName }))} title={iconName}>
                      <IconComponent className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>
            {!isNewCategory && (
              <div className="flex items-center space-x-2">
                <Checkbox id="is-hidden" checked={formData.is_hidden} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_hidden: checked as boolean }))} />
                <Label htmlFor="is-hidden" className="text-sm">Diese Kategorie ausblenden</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditModalOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isNewCategory ? 'Erstellen' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedCategory?.receipt_count && selectedCategory.receipt_count > 0
                ? `Kategorie "${selectedCategory?.name}" wird verwendet`
                : `Kategorie "${selectedCategory?.name}" löschen?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedCategory?.receipt_count && selectedCategory.receipt_count > 0 ? (
                <div className="space-y-3">
                  <p>Diese Kategorie wird von <strong>{selectedCategory.receipt_count} Beleg(en)</strong> verwendet.</p>
                  <div className="space-y-2">
                    <Label>Belege verschieben zu:</Label>
                    <Select value={reassignCategory} onValueChange={setReassignCategory}>
                      <SelectTrigger><SelectValue placeholder="Ziel-Kategorie wählen" /></SelectTrigger>
                      <SelectContent>
                        {categories.filter(c => c.id !== selectedCategory.id).map((c) => (
                          <SelectItem key={c.id} value={c.name}>
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color || '#64748B' }} />
                              {c.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                'Diese Kategorie wird unwiderruflich gelöscht.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90"
              disabled={saving || (selectedCategory?.receipt_count && selectedCategory.receipt_count > 0 && !reassignCategory)}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedCategory?.receipt_count && selectedCategory.receipt_count > 0 ? 'Verschieben & Löschen' : 'Löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
