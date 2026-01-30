import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Loader2, Tag as TagIcon, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { useTags } from '@/hooks/useTags';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import type { Tag, CreateTagInput, UpdateTagInput } from '@/types/tags';

// Predefined color palette
const COLOR_PALETTE = [
  { name: 'Blau', value: '#3B82F6' },
  { name: 'Grün', value: '#22C55E' },
  { name: 'Rot', value: '#EF4444' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Lila', value: '#8B5CF6' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Türkis', value: '#06B6D4' },
  { name: 'Grau', value: '#6B7280' },
  { name: 'Gelb', value: '#EAB308' },
  { name: 'Indigo', value: '#6366F1' },
];

interface TagFormData {
  name: string;
  color: string;
}

const DEFAULT_FORM_DATA: TagFormData = {
  name: '',
  color: COLOR_PALETTE[0].value,
};

export function TagManagement() {
  const { user } = useAuth();
  const {
    tags,
    loading,
    createTag,
    updateTag,
    deleteTag,
    toggleTagActive,
    isCreating,
    isUpdating,
    isDeleting,
  } = useTags();

  // Modal states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [formData, setFormData] = useState<TagFormData>(DEFAULT_FORM_DATA);
  const [isNewTag, setIsNewTag] = useState(true);
  const [receiptCount, setReceiptCount] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  // Open modal for new tag
  const handleNewTag = () => {
    setIsNewTag(true);
    setSelectedTag(null);
    setFormData({
      ...DEFAULT_FORM_DATA,
      color: COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)].value,
    });
    setFormError(null);
    setEditModalOpen(true);
  };

  // Open modal for editing
  const handleEdit = (tag: Tag) => {
    setIsNewTag(false);
    setSelectedTag(tag);
    setFormData({
      name: tag.name,
      color: tag.color,
    });
    setFormError(null);
    setEditModalOpen(true);
  };

  // Save tag (create or update)
  const handleSave = async () => {
    // Validate
    const trimmedName = formData.name.trim();
    
    if (trimmedName.length < 1) {
      setFormError('Bitte gib einen Namen ein.');
      return;
    }

    if (trimmedName.length > 50) {
      setFormError('Der Name darf maximal 50 Zeichen haben.');
      return;
    }

    // Check for duplicate names
    const duplicate = tags.find(
      t => t.name.toLowerCase() === trimmedName.toLowerCase() && t.id !== selectedTag?.id
    );
    if (duplicate) {
      setFormError('Ein Tag mit diesem Namen existiert bereits.');
      return;
    }

    try {
      if (isNewTag) {
        await createTag({
          name: trimmedName,
          color: formData.color,
        });
      } else if (selectedTag) {
        await updateTag(selectedTag.id, {
          name: trimmedName,
          color: formData.color,
        });
      }
      setEditModalOpen(false);
    } catch (error) {
      // Error is handled by the hook with toast
    }
  };

  // Open delete dialog
  const handleDeleteClick = async (tag: Tag) => {
    setSelectedTag(tag);
    
    // Count receipts using this tag
    if (user) {
      const { count } = await supabase
        .from('receipt_tags')
        .select('*', { count: 'exact', head: true })
        .eq('tag_id', tag.id);
      
      setReceiptCount(count || 0);
    }
    
    setDeleteDialogOpen(true);
  };

  // Confirm delete
  const handleDelete = async () => {
    if (!selectedTag) return;

    try {
      await deleteTag(selectedTag.id);
      setDeleteDialogOpen(false);
    } catch (error) {
      // Error is handled by the hook with toast
    }
  };

  // Toggle active status
  const handleToggleActive = async (tag: Tag) => {
    try {
      await toggleTagActive(tag.id);
    } catch (error) {
      // Error is handled by the hook with toast
    }
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
          <h3 className="text-lg font-semibold">Tags</h3>
          <p className="text-sm text-muted-foreground">
            Organisiere Belege mit Tags für Projekte, Baustellen oder Veranstaltungen
          </p>
        </div>
        <Button onClick={handleNewTag}>
          <Plus className="h-4 w-4 mr-2" />
          Neuer Tag
        </Button>
      </div>

      {/* Table or Empty State */}
      {tags.length === 0 ? (
        <div className="border rounded-lg p-8 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Hash className="h-6 w-6 text-muted-foreground" />
          </div>
          <h4 className="text-lg font-medium mb-2">Noch keine Tags erstellt</h4>
          <p className="text-muted-foreground max-w-md mx-auto mb-4">
            Tags helfen dir, Belege nach Projekten zu gruppieren – z.B. Baustellen, Veranstaltungen, Ferienwohnungen oder Mandanten.
          </p>
          <Button onClick={handleNewTag}>
            <Plus className="h-4 w-4 mr-2" />
            Ersten Tag erstellen
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.map((tag) => (
                <TableRow
                  key={tag.id}
                  className={cn(!tag.is_active && 'opacity-50')}
                >
                  <TableCell>
                    <div
                      className="h-6 w-6 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="font-medium"
                        style={{
                          backgroundColor: `${tag.color}20`,
                          color: tag.color,
                          borderColor: tag.color,
                        }}
                      >
                        {tag.name}
                      </Badge>
                      {!tag.is_active && (
                        <Badge variant="outline" className="text-xs">
                          Inaktiv
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={tag.is_active}
                        onCheckedChange={() => handleToggleActive(tag)}
                        aria-label={tag.is_active ? 'Deaktivieren' : 'Aktivieren'}
                      />
                      <span className="text-sm text-muted-foreground">
                        {tag.is_active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(tag)}
                        title="Bearbeiten"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(tag)}
                        className="text-destructive hover:text-destructive"
                        title="Löschen"
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

      {/* Create/Edit Dialog */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isNewTag ? 'Neuen Tag erstellen' : 'Tag bearbeiten'}
            </DialogTitle>
            <DialogDescription>
              {isNewTag
                ? 'Erstelle einen neuen Tag für die Beleg-Organisation.'
                : 'Bearbeite den Namen oder die Farbe des Tags.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name Input */}
            <div className="space-y-2">
              <Label htmlFor="tag-name">Name *</Label>
              <Input
                id="tag-name"
                value={formData.name}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, name: e.target.value }));
                  setFormError(null);
                }}
                placeholder="z.B. Baustelle Musterstraße"
                maxLength={50}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                {formData.name.length}/50 Zeichen
              </p>
              {formError && (
                <p className="text-sm text-destructive">{formError}</p>
              )}
            </div>

            {/* Color Picker */}
            <div className="space-y-2">
              <Label>Farbe</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, color: color.value }))
                    }
                    className={cn(
                      'h-8 w-8 rounded-full transition-all ring-offset-2 ring-offset-background',
                      formData.color === color.value
                        ? 'ring-2 ring-primary scale-110'
                        : 'hover:scale-105'
                    )}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>Vorschau</Label>
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Badge
                  variant="secondary"
                  className="font-medium"
                  style={{
                    backgroundColor: `${formData.color}20`,
                    color: formData.color,
                    borderColor: formData.color,
                  }}
                >
                  {formData.name || 'Tag-Name'}
                </Badge>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditModalOpen(false)}
              disabled={isCreating || isUpdating}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleSave}
              disabled={isCreating || isUpdating || !formData.name.trim()}
            >
              {(isCreating || isUpdating) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {isNewTag ? 'Erstellen' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tag löschen?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Möchtest du den Tag{' '}
                <Badge
                  variant="secondary"
                  className="font-medium mx-1"
                  style={{
                    backgroundColor: `${selectedTag?.color}20`,
                    color: selectedTag?.color,
                  }}
                >
                  {selectedTag?.name}
                </Badge>{' '}
                wirklich löschen?
              </p>
              {receiptCount > 0 && (
                <p className="text-amber-600 dark:text-amber-500">
                  ⚠️ Dieser Tag wird von {receiptCount} Beleg
                  {receiptCount !== 1 ? 'en' : ''} verwendet. Die Belege bleiben
                  erhalten, nur die Tag-Zuordnung wird entfernt.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
