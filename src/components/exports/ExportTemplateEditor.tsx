import { useState, useEffect } from 'react';
import {
  Save,
  Eye,
  Trash2,
  Plus,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Settings2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  useExportTemplates,
  DEFAULT_COLUMNS,
  FIELD_TYPES,
  AVAILABLE_FIELDS,
  type ExportTemplate,
  type ExportColumn,
} from '@/hooks/useExportTemplates';

interface ExportTemplateEditorProps {
  open: boolean;
  onClose: () => void;
  onApplyTemplate?: (template: ExportTemplate) => void;
}

export function ExportTemplateEditor({
  open,
  onClose,
  onApplyTemplate,
}: ExportTemplateEditorProps) {
  const {
    templates,
    loading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    createEmptyTemplate,
  } = useExportTemplates();

  // Current editing state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Omit<ExportTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'> | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Initialize with first template or empty
  useEffect(() => {
    if (!loading && templates.length > 0 && !selectedTemplateId) {
      const defaultTemplate = templates.find(t => t.is_default) || templates[0];
      setSelectedTemplateId(defaultTemplate.id);
      setEditingTemplate({
        name: defaultTemplate.name,
        description: defaultTemplate.description,
        is_default: defaultTemplate.is_default,
        columns: [...defaultTemplate.columns],
        sort_by: defaultTemplate.sort_by,
        sort_direction: defaultTemplate.sort_direction,
        group_by: defaultTemplate.group_by,
        group_subtotals: defaultTemplate.group_subtotals,
        include_header: defaultTemplate.include_header,
        include_totals: defaultTemplate.include_totals,
        date_format: defaultTemplate.date_format,
        number_format: defaultTemplate.number_format,
      });
    } else if (!loading && templates.length === 0 && !editingTemplate) {
      // No templates, create empty one
      setEditingTemplate(createEmptyTemplate());
    }
  }, [loading, templates, selectedTemplateId, editingTemplate, createEmptyTemplate]);

  // Load a template
  const loadTemplate = (templateId: string) => {
    if (templateId === 'new') {
      setSelectedTemplateId(null);
      setEditingTemplate(createEmptyTemplate());
      return;
    }

    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplateId(templateId);
      setEditingTemplate({
        name: template.name,
        description: template.description,
        is_default: template.is_default,
        columns: [...template.columns],
        sort_by: template.sort_by,
        sort_direction: template.sort_direction,
        group_by: template.group_by,
        group_subtotals: template.group_subtotals,
        include_header: template.include_header,
        include_totals: template.include_totals,
        date_format: template.date_format,
        number_format: template.number_format,
      });
    }
  };

  // Save template
  const handleSave = async () => {
    if (!editingTemplate) return;

    setSaving(true);
    try {
      if (selectedTemplateId) {
        await updateTemplate(selectedTemplateId, editingTemplate);
      } else {
        const newTemplate = await createTemplate(editingTemplate);
        if (newTemplate) {
          setSelectedTemplateId(newTemplate.id);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  // Delete template
  const handleDelete = async () => {
    if (!selectedTemplateId) return;

    await deleteTemplate(selectedTemplateId);
    setDeleteDialogOpen(false);
    setSelectedTemplateId(null);
    setEditingTemplate(createEmptyTemplate());
  };

  // Toggle column visibility
  const toggleColumnVisibility = (columnId: string) => {
    if (!editingTemplate) return;

    setEditingTemplate({
      ...editingTemplate,
      columns: editingTemplate.columns.map(col =>
        col.id === columnId ? { ...col, visible: !col.visible } : col
      ),
    });
  };

  // Update column label
  const updateColumnLabel = (columnId: string, label: string) => {
    if (!editingTemplate) return;

    setEditingTemplate({
      ...editingTemplate,
      columns: editingTemplate.columns.map(col =>
        col.id === columnId ? { ...col, label } : col
      ),
    });
  };

  // Update column format
  const updateColumnFormat = (columnId: string, format: string) => {
    if (!editingTemplate) return;

    setEditingTemplate({
      ...editingTemplate,
      columns: editingTemplate.columns.map(col =>
        col.id === columnId ? { ...col, format } : col
      ),
    });
  };

  // Move column up/down
  const moveColumn = (columnId: string, direction: 'up' | 'down') => {
    if (!editingTemplate) return;

    const columns = [...editingTemplate.columns].sort((a, b) => a.order - b.order);
    const currentIndex = columns.findIndex(c => c.id === columnId);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= columns.length) return;

    // Swap orders
    const temp = columns[currentIndex].order;
    columns[currentIndex].order = columns[newIndex].order;
    columns[newIndex].order = temp;

    setEditingTemplate({
      ...editingTemplate,
      columns,
    });
  };

  // Apply template to export
  const handleApply = () => {
    if (!editingTemplate) return;

    // Find the full template or create a temporary one
    const fullTemplate = selectedTemplateId
      ? templates.find(t => t.id === selectedTemplateId)
      : null;

    if (fullTemplate && onApplyTemplate) {
      onApplyTemplate(fullTemplate);
    }
    onClose();
  };

  if (!editingTemplate) {
    return null;
  }

  const sortedColumns = [...editingTemplate.columns].sort((a, b) => a.order - b.order);

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Export-Editor</DialogTitle>
            <DialogDescription>
              Konfiguriere das Layout für deine Ausgaben-Exporte
            </DialogDescription>
          </DialogHeader>

          {/* Header with template selection */}
          <div className="flex items-center gap-3 py-2 border-b">
            <Select
              value={selectedTemplateId || 'new'}
              onValueChange={loadTemplate}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Vorlage wählen..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Neue Vorlage
                  </span>
                </SelectItem>
                {templates.length > 0 && <Separator className="my-1" />}
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="flex items-center gap-2">
                      {t.name}
                      {t.is_default && (
                        <Badge variant="secondary" className="text-xs">Standard</Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex-1" />

            {selectedTemplateId && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Speichern
            </Button>

            <Button size="sm" onClick={handleApply}>
              <Eye className="h-4 w-4 mr-2" />
              Anwenden
            </Button>
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-y-auto space-y-6 py-4">
            {/* Template name and settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vorlagenname</Label>
                <Input
                  value={editingTemplate.name}
                  onChange={(e) =>
                    setEditingTemplate({ ...editingTemplate, name: e.target.value })
                  }
                  placeholder="z.B. Monatsbericht"
                />
              </div>
              <div className="space-y-2">
                <Label>Beschreibung (optional)</Label>
                <Input
                  value={editingTemplate.description || ''}
                  onChange={(e) =>
                    setEditingTemplate({ ...editingTemplate, description: e.target.value })
                  }
                  placeholder="Kurze Beschreibung..."
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="is-default"
                  checked={editingTemplate.is_default}
                  onCheckedChange={(checked) =>
                    setEditingTemplate({ ...editingTemplate, is_default: checked })
                  }
                />
                <Label htmlFor="is-default">Als Standard-Vorlage verwenden</Label>
              </div>
            </div>

            <Separator />

            {/* Column configuration */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Spalten</CardTitle>
                <CardDescription>
                  Wähle die Spalten aus, die exportiert werden sollen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {sortedColumns.map((column, index) => (
                  <div
                    key={column.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      column.visible ? 'bg-background' : 'bg-muted/50 opacity-60'
                    }`}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />

                    <Checkbox
                      checked={column.visible}
                      onCheckedChange={() => toggleColumnVisibility(column.id)}
                    />

                    <Input
                      value={column.label}
                      onChange={(e) => updateColumnLabel(column.id, e.target.value)}
                      className="w-[150px]"
                    />

                    <Badge variant="outline" className="text-xs">
                      {FIELD_TYPES[column.type]?.label || column.type}
                    </Badge>

                    {FIELD_TYPES[column.type]?.formats && (
                      <Select
                        value={column.format || ''}
                        onValueChange={(val) => updateColumnFormat(column.id, val)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Format" />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPES[column.type].formats?.map((format) => (
                            <SelectItem key={format} value={format}>
                              {format}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <div className="flex-1" />

                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moveColumn(column.id, 'up')}
                        disabled={index === 0}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moveColumn(column.id, 'down')}
                        disabled={index === sortedColumns.length - 1}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Sorting & Grouping */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Sortierung & Gruppierung</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Sortieren nach</Label>
                    <Select
                      value={editingTemplate.sort_by || 'receipt_date'}
                      onValueChange={(val) =>
                        setEditingTemplate({ ...editingTemplate, sort_by: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AVAILABLE_FIELDS.map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Richtung</Label>
                    <Select
                      value={editingTemplate.sort_direction}
                      onValueChange={(val: 'asc' | 'desc') =>
                        setEditingTemplate({ ...editingTemplate, sort_direction: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">Aufsteigend (A-Z, 1-9)</SelectItem>
                        <SelectItem value="desc">Absteigend (Z-A, 9-1)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Gruppieren nach (optional)</Label>
                    <Select
                      value={editingTemplate.group_by || 'none'}
                      onValueChange={(val) =>
                        setEditingTemplate({
                          ...editingTemplate,
                          group_by: val === 'none' ? null : val,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Keine Gruppierung</SelectItem>
                        {AVAILABLE_FIELDS.map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {editingTemplate.group_by && (
                    <div className="flex items-center gap-2 pt-6">
                      <Switch
                        id="group-subtotals"
                        checked={editingTemplate.group_subtotals}
                        onCheckedChange={(checked) =>
                          setEditingTemplate({ ...editingTemplate, group_subtotals: checked })
                        }
                      />
                      <Label htmlFor="group-subtotals">Zwischensummen anzeigen</Label>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Advanced options */}
            <Card>
              <CardHeader
                className="pb-3 cursor-pointer"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    Erweiterte Optionen
                  </CardTitle>
                  {showAdvanced ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </CardHeader>
              {showAdvanced && (
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="include-header"
                        checked={editingTemplate.include_header}
                        onCheckedChange={(checked) =>
                          setEditingTemplate({ ...editingTemplate, include_header: checked })
                        }
                      />
                      <Label htmlFor="include-header">Kopfzeile einschließen</Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        id="include-totals"
                        checked={editingTemplate.include_totals}
                        onCheckedChange={(checked) =>
                          setEditingTemplate({ ...editingTemplate, include_totals: checked })
                        }
                      />
                      <Label htmlFor="include-totals">Summenzeile einschließen</Label>
                    </div>

                    <div className="space-y-2">
                      <Label>Datumsformat</Label>
                      <Select
                        value={editingTemplate.date_format}
                        onValueChange={(val) =>
                          setEditingTemplate({ ...editingTemplate, date_format: val })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPES.date.formats?.map((format) => (
                            <SelectItem key={format} value={format}>
                              {format}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Zahlenformat</Label>
                      <Select
                        value={editingTemplate.number_format}
                        onValueChange={(val) =>
                          setEditingTemplate({ ...editingTemplate, number_format: val })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="de-AT">Deutsch (Österreich)</SelectItem>
                          <SelectItem value="de-DE">Deutsch (Deutschland)</SelectItem>
                          <SelectItem value="en-US">Englisch (US)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vorlage löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Vorlage "{editingTemplate?.name}" wird unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
