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
  RotateCcw,
  Flower2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// Icon mapping
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
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
  FolderOpen,
  Flower2,
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
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Modal states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(DEFAULT_FORM_DATA);
  const [isNewCategory, setIsNewCategory] = useState(true);
  
  // Delete with reassignment
  const [reassignCategory, setReassignCategory] = useState<string>('');

  // Fetch categories with receipt counts
  const fetchCategories = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Get categories
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name');

      if (catError) throw catError;

      // Get receipt counts per category
      const { data: countData, error: countError } = await supabase
        .from('receipts')
        .select('category')
        .eq('user_id', user.id);

      if (countError) throw countError;

      // Calculate counts
      const counts: Record<string, number> = {};
      countData?.forEach(r => {
        if (r.category) {
          counts[r.category] = (counts[r.category] || 0) + 1;
        }
      });

      // Merge data
      const categoriesWithCounts = (catData || []).map(cat => ({
        ...cat,
        is_hidden: cat.is_hidden ?? false,
        sort_order: cat.sort_order ?? 0,
        receipt_count: counts[cat.name] || 0,
      })) as Category[];

      setCategories(categoriesWithCounts);
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
    fetchCategories();
  }, [user]);

  // Open modal for new category
  const handleNewCategory = () => {
    setIsNewCategory(true);
    setSelectedCategory(null);
    setFormData({
      ...DEFAULT_FORM_DATA,
      color: COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)],
    });
    setEditModalOpen(true);
  };

  // Open modal for editing
  const handleEdit = (category: Category) => {
    setIsNewCategory(false);
    setSelectedCategory(category);
    setFormData({
      name: category.name,
      icon: category.icon || 'FileText',
      color: category.color || '#3B82F6',
      is_hidden: category.is_hidden,
    });
    setEditModalOpen(true);
  };

  // Save category (create or update)
  const handleSave = async () => {
    if (!user) return;
    
    // Validate
    if (formData.name.trim().length < 2) {
      toast({
        variant: 'destructive',
        title: 'Name zu kurz',
        description: 'Der Name muss mindestens 2 Zeichen haben.',
      });
      return;
    }

    if (formData.name.length > 50) {
      toast({
        variant: 'destructive',
        title: 'Name zu lang',
        description: 'Der Name darf maximal 50 Zeichen haben.',
      });
      return;
    }

    // Check for duplicate names
    const duplicate = categories.find(
      c => c.name.toLowerCase() === formData.name.trim().toLowerCase() && c.id !== selectedCategory?.id
    );
    if (duplicate) {
      toast({
        variant: 'destructive',
        title: 'Name bereits vergeben',
        description: 'Eine Kategorie mit diesem Namen existiert bereits.',
      });
      return;
    }

    setSaving(true);
    try {
      if (isNewCategory) {
        // Create new category
        const maxSortOrder = Math.max(...categories.map(c => c.sort_order), 0);
        const { error } = await supabase
          .from('categories')
          .insert({
            user_id: user.id,
            name: formData.name.trim(),
            icon: formData.icon,
            color: formData.color,
            is_system: false,
            is_hidden: formData.is_hidden,
            sort_order: maxSortOrder + 1,
          });

        if (error) throw error;

        toast({ title: 'Kategorie erstellt' });
      } else if (selectedCategory) {
        // Update existing category
        const { error } = await supabase
          .from('categories')
          .update({
            name: formData.name.trim(),
            icon: formData.icon,
            color: formData.color,
            is_hidden: formData.is_hidden,
          })
          .eq('id', selectedCategory.id);

        if (error) throw error;

        // If name changed, update receipts
        if (selectedCategory.name !== formData.name.trim()) {
          const { error: updateError } = await supabase
            .from('receipts')
            .update({ category: formData.name.trim() })
            .eq('category', selectedCategory.name)
            .eq('user_id', user.id);

          if (updateError) throw updateError;
        }

        toast({ title: 'Kategorie aktualisiert' });
      }

      setEditModalOpen(false);
      fetchCategories();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler beim Speichern',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    } finally {
      setSaving(false);
    }
  };

  // Open delete dialog
  const handleDeleteClick = (category: Category) => {
    setSelectedCategory(category);
    setReassignCategory('');
    setDeleteDialogOpen(true);
  };

  // Confirm delete
  const handleDelete = async () => {
    if (!selectedCategory || !user) return;

    setSaving(true);
    try {
      // If category has receipts, reassign them
      if (selectedCategory.receipt_count && selectedCategory.receipt_count > 0 && reassignCategory) {
        const { error: reassignError } = await supabase
          .from('receipts')
          .update({ category: reassignCategory })
          .eq('category', selectedCategory.name)
          .eq('user_id', user.id);

        if (reassignError) throw reassignError;
      }

      // Delete category
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', selectedCategory.id);

      if (error) throw error;

      toast({ title: 'Kategorie gelöscht' });
      setDeleteDialogOpen(false);
      fetchCategories();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler beim Löschen',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    } finally {
      setSaving(false);
    }
  };

  // Toggle visibility
  const handleToggleVisibility = async (category: Category) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ is_hidden: !category.is_hidden })
        .eq('id', category.id);

      if (error) throw error;

      setCategories(prev => prev.map(c => 
        c.id === category.id ? { ...c, is_hidden: !c.is_hidden } : c
      ));

      toast({
        title: category.is_hidden ? 'Kategorie eingeblendet' : 'Kategorie ausgeblendet',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    }
  };

  // Restore default categories
  const handleRestoreDefaults = async () => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ is_hidden: false })
        .eq('is_system', true);

      if (error) throw error;

      toast({ title: 'Standard-Kategorien wiederhergestellt' });
      fetchCategories();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    }
  };

  // Render icon
  const renderIcon = (iconName: string | null, color: string | null) => {
    const IconComponent = iconName ? ICON_MAP[iconName] : FileText;
    if (!IconComponent) return <FileText className="h-4 w-4" />;
    return (
      <div 
        className="h-6 w-6 rounded-full flex items-center justify-center"
        style={{ backgroundColor: `${color}20` }}
      >
        <IconComponent className="h-3.5 w-3.5" style={{ color: color || '#64748B' }} />
      </div>
    );
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Ausgaben-Kategorien</h3>
          <p className="text-sm text-muted-foreground">Verwalte die Kategorien für deine Belege</p>
        </div>
        <Button onClick={handleNewCategory}>
          <Plus className="h-4 w-4 mr-2" />
          Neue Kategorie
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead className="text-right">Belege</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Keine Kategorien vorhanden
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow 
                  key={category.id}
                  className={cn(category.is_hidden && 'opacity-50')}
                >
                  <TableCell>
                    {renderIcon(category.icon, category.color)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {category.name}
                    {category.is_hidden && (
                      <Badge variant="outline" className="ml-2 text-xs">Ausgeblendet</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={category.is_system ? 'secondary' : 'outline'}>
                      {category.is_system ? 'Standard' : 'Eigene'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {category.receipt_count || 0} Belege
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {category.name === 'Keine Rechnung' ? (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Geschützt
                        </Badge>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleToggleVisibility(category)}
                            title={category.is_hidden ? 'Einblenden' : 'Ausblenden'}
                          >
                            {category.is_hidden ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(category)}
                            title="Bearbeiten"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteClick(category)}
                            title="Löschen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Restore Defaults */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleRestoreDefaults}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Standard-Kategorien wiederherstellen
        </Button>
      </div>

      {/* Edit/Create Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isNewCategory ? 'Neue Kategorie erstellen' : 'Kategorie bearbeiten'}
            </DialogTitle>
            <DialogDescription>
              {isNewCategory 
                ? 'Erstelle eine neue Kategorie für deine Belege.'
                : 'Bearbeite die Kategorie-Einstellungen.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="z.B. Fortbildung"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                {formData.name.length}/50 Zeichen
              </p>
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label>Farbe</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-all",
                      formData.color === color ? "border-foreground scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Label htmlFor="custom-color" className="text-xs">Custom:</Label>
                <Input
                  id="custom-color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="w-12 h-8 p-1 cursor-pointer"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  placeholder="#3B82F6"
                  className="w-24 font-mono text-sm"
                  maxLength={7}
                />
              </div>
            </div>

            {/* Icon */}
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="grid grid-cols-8 gap-2 max-h-[160px] overflow-y-auto p-1">
                {AVAILABLE_ICONS.map((iconName) => {
                  const IconComponent = ICON_MAP[iconName];
                  return (
                    <button
                      key={iconName}
                      type="button"
                      className={cn(
                        "h-9 w-9 rounded-lg border flex items-center justify-center transition-all",
                        formData.icon === iconName 
                          ? "border-primary bg-primary/10" 
                          : "border-border hover:bg-muted"
                      )}
                      onClick={() => setFormData(prev => ({ ...prev, icon: iconName }))}
                      title={iconName}
                    >
                      <IconComponent className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hidden checkbox (only for existing categories) */}
            {!isNewCategory && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is-hidden"
                  checked={formData.is_hidden}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, is_hidden: checked as boolean }))
                  }
                />
                <Label htmlFor="is-hidden" className="text-sm">
                  Diese Kategorie ausblenden
                </Label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditModalOpen(false)}>
              Abbrechen
            </Button>
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
                : `Kategorie "${selectedCategory?.name}" löschen?`
              }
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedCategory?.receipt_count && selectedCategory.receipt_count > 0 ? (
                <div className="space-y-3">
                  <p>
                    Diese Kategorie wird von <strong>{selectedCategory.receipt_count} Beleg(en)</strong> verwendet.
                  </p>
                  <div className="space-y-2">
                    <Label>Belege verschieben zu:</Label>
                    <Select value={reassignCategory} onValueChange={setReassignCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Ziel-Kategorie wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories
                          .filter(c => c.id !== selectedCategory.id)
                          .map((c) => (
                            <SelectItem key={c.id} value={c.name}>
                              <span className="flex items-center gap-2">
                                <span 
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: c.color || '#64748B' }}
                                />
                                {c.name}
                              </span>
                            </SelectItem>
                          ))
                        }
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
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
              disabled={
                saving || 
                (selectedCategory?.receipt_count && selectedCategory.receipt_count > 0 && !reassignCategory)
              }
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedCategory?.receipt_count && selectedCategory.receipt_count > 0 
                ? 'Verschieben & Löschen' 
                : 'Löschen'
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
