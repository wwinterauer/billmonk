import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Save,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  GripVertical,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Settings2,
  Loader2,
  RotateCcw,
  CheckSquare,
  Square,
  Pencil,
  AlignLeft,
  AlignCenter,
  AlignRight,
  MousePointerClick,
  ArrowUp,
  ArrowDown,
  Tag,
  Building,
  Calendar,
  CalendarDays,
  CalendarRange,
  Percent,
  CreditCard,
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
import {
  useExportTemplates,
  DEFAULT_COLUMNS,
  FIELD_TYPES,
  SORTABLE_FIELDS,
  GROUPING_OPTIONS,
  formatPreview,
  getGroupPreview,
  getSortInfo,
  type ExportTemplate,
  type ExportColumn,
} from '@/hooks/useExportTemplates';
import { cn } from '@/lib/utils';

interface ExportTemplateEditorProps {
  open: boolean;
  onClose: () => void;
  onApplyTemplate?: (template: ExportTemplate) => void;
}

// Sortable Column Component
interface SortableColumnProps {
  column: ExportColumn;
  isSelected: boolean;
  onSelect: (column: ExportColumn) => void;
  onToggleVisible: (columnId: string) => void;
}

function SortableColumn({
  column,
  isSelected,
  onSelect,
  onToggleVisible,
}: SortableColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-all",
        column.visible ? "bg-background" : "bg-muted/50 opacity-60",
        isSelected && "ring-2 ring-primary border-primary",
        isDragging && "opacity-50 shadow-lg z-50"
      )}
    >
      {/* Drag Handle */}
      <button
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Visibility Toggle */}
      <button
        onClick={() => onToggleVisible(column.id)}
        className="p-1 hover:bg-muted rounded transition-colors"
      >
        {column.visible ? (
          <Eye className="h-4 w-4 text-green-600" />
        ) : (
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Column Info */}
      <div
        className="flex-1 cursor-pointer min-w-0"
        onClick={() => onSelect(column)}
      >
        <div className="font-medium truncate">{column.label}</div>
        <div className="text-xs text-muted-foreground">
          {column.field} • {FIELD_TYPES[column.type]?.label || column.type}
        </div>
      </div>

      {/* Format Badge */}
      {column.format && (
        <Badge variant="outline" className="text-xs shrink-0">
          {column.format}
        </Badge>
      )}

      {/* Edit Button */}
      <button
        className="p-1 hover:bg-muted rounded transition-colors"
        onClick={() => onSelect(column)}
      >
        <Pencil className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
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
  const [selectedColumn, setSelectedColumn] = useState<ExportColumn | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
      setEditingTemplate(createEmptyTemplate());
    }
  }, [loading, templates, selectedTemplateId, editingTemplate, createEmptyTemplate]);

  // Load a template
  const loadTemplate = (templateId: string) => {
    if (templateId === 'new') {
      setSelectedTemplateId(null);
      setEditingTemplate(createEmptyTemplate());
      setSelectedColumn(null);
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
      setSelectedColumn(null);
    }
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !editingTemplate) return;

    const oldIndex = editingTemplate.columns.findIndex(c => c.id === active.id);
    const newIndex = editingTemplate.columns.findIndex(c => c.id === over.id);

    const newColumns = arrayMove(editingTemplate.columns, oldIndex, newIndex).map(
      (col, index) => ({ ...col, order: index })
    );

    setEditingTemplate({
      ...editingTemplate,
      columns: newColumns,
    });
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
    setSelectedColumn(null);
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

    if (selectedColumn?.id === columnId) {
      setSelectedColumn({ ...selectedColumn, label });
    }
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

    if (selectedColumn?.id === columnId) {
      setSelectedColumn({ ...selectedColumn, format });
    }
  };

  // Generic column update function
  const updateColumn = (columnId: string, updates: Partial<ExportColumn>) => {
    if (!editingTemplate) return;

    setEditingTemplate({
      ...editingTemplate,
      columns: editingTemplate.columns.map(col =>
        col.id === columnId ? { ...col, ...updates } : col
      ),
    });

    if (selectedColumn?.id === columnId) {
      setSelectedColumn({ ...selectedColumn, ...updates });
    }
  };

  // Show/hide all columns
  const showAllColumns = () => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      columns: editingTemplate.columns.map(c => ({ ...c, visible: true })),
    });
  };

  const hideAllColumns = () => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      columns: editingTemplate.columns.map(c => ({ ...c, visible: false })),
    });
  };

  const resetColumns = () => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      columns: [...DEFAULT_COLUMNS],
    });
    setSelectedColumn(null);
  };

  // Apply template to export
  const handleApply = () => {
    if (!editingTemplate) return;

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
  const visibleCount = editingTemplate.columns.filter(c => c.visible).length;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
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

          {/* Main content - Two column layout */}
          <div className="flex-1 overflow-hidden flex gap-6 py-4">
            {/* Left: Column list */}
            <div className="w-1/2 flex flex-col overflow-hidden">
              <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="pb-3 shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Spalten</CardTitle>
                      <CardDescription>
                        {visibleCount} von {editingTemplate.columns.length} sichtbar
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={showAllColumns}
                        title="Alle einblenden"
                      >
                        <CheckSquare className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={hideAllColumns}
                        title="Alle ausblenden"
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={resetColumns}
                        title="Zurücksetzen"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto space-y-2 pb-4">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={sortedColumns.map(c => c.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {sortedColumns.map(column => (
                        <SortableColumn
                          key={column.id}
                          column={column}
                          isSelected={selectedColumn?.id === column.id}
                          onSelect={setSelectedColumn}
                          onToggleVisible={toggleColumnVisibility}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </CardContent>
              </Card>
            </div>

            {/* Right: Settings */}
            <div className="w-1/2 overflow-y-auto space-y-4">
              {/* Template name */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Vorlage</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={editingTemplate.name}
                        onChange={(e) =>
                          setEditingTemplate({ ...editingTemplate, name: e.target.value })
                        }
                        placeholder="z.B. Monatsbericht"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Beschreibung</Label>
                      <Input
                        value={editingTemplate.description || ''}
                        onChange={(e) =>
                          setEditingTemplate({ ...editingTemplate, description: e.target.value })
                        }
                        placeholder="Optional..."
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="is-default"
                      checked={editingTemplate.is_default}
                      onCheckedChange={(checked) =>
                        setEditingTemplate({ ...editingTemplate, is_default: checked })
                      }
                    />
                    <Label htmlFor="is-default">Als Standard verwenden</Label>
                  </div>
                </CardContent>
              </Card>

              {/* Selected column editor */}
              {selectedColumn ? (
                <Card className="border-primary">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">Spalte bearbeiten</CardTitle>
                        <CardDescription>{selectedColumn.field}</CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedColumn(null)}
                      >
                        ✕
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Column label */}
                    <div className="space-y-2">
                      <Label>Spaltenüberschrift</Label>
                      <Input
                        value={selectedColumn.label}
                        onChange={(e) => updateColumn(selectedColumn.id, { label: e.target.value })}
                        placeholder="z.B. Datum"
                      />
                    </div>

                    {/* Field type (readonly) */}
                    <div className="space-y-2">
                      <Label>Feldtyp</Label>
                      <Input
                        value={FIELD_TYPES[selectedColumn.type]?.label || selectedColumn.type}
                        disabled
                        className="bg-muted"
                      />
                    </div>

                    {/* Format (based on type) */}
                    {FIELD_TYPES[selectedColumn.type]?.formats && (
                      <div className="space-y-2">
                        <Label>Format</Label>
                        <Select
                          value={selectedColumn.format || ''}
                          onValueChange={(val) => updateColumn(selectedColumn.id, { format: val })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Format wählen..." />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPES[selectedColumn.type].formats?.map((format) => (
                              <SelectItem key={format} value={format}>
                                <span className="flex items-center gap-2">
                                  {format}
                                  <span className="text-muted-foreground">
                                    ({formatPreview(selectedColumn.type, format)})
                                  </span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Width */}
                    <div className="space-y-2">
                      <Label>Spaltenbreite (optional)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={selectedColumn.width || ''}
                          onChange={(e) => updateColumn(selectedColumn.id, { 
                            width: e.target.value ? parseInt(e.target.value) : undefined 
                          })}
                          placeholder="Auto"
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">Pixel</span>
                      </div>
                    </div>

                    {/* Alignment */}
                    <div className="space-y-2">
                      <Label>Ausrichtung</Label>
                      <div className="flex gap-1">
                        <Button
                          variant={selectedColumn.align === 'left' || !selectedColumn.align ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => updateColumn(selectedColumn.id, { align: 'left' })}
                        >
                          <AlignLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          variant={selectedColumn.align === 'center' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => updateColumn(selectedColumn.id, { align: 'center' })}
                        >
                          <AlignCenter className="w-4 h-4" />
                        </Button>
                        <Button
                          variant={selectedColumn.align === 'right' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => updateColumn(selectedColumn.id, { align: 'right' })}
                        >
                          <AlignRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Visibility */}
                    <div className="flex items-center justify-between">
                      <Label>Sichtbar im Export</Label>
                      <Switch
                        checked={selectedColumn.visible}
                        onCheckedChange={(v) => updateColumn(selectedColumn.id, { visible: v })}
                      />
                    </div>

                    {/* Preview */}
                    <div className="pt-4 border-t">
                      <Label className="text-muted-foreground">Vorschau</Label>
                      <div className="mt-2 p-3 bg-muted rounded-lg font-mono text-sm">
                        {formatPreview(selectedColumn.type, selectedColumn.format)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <MousePointerClick className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">Wähle eine Spalte zum Bearbeiten</p>
                  </CardContent>
                </Card>
              )}

              {/* Sortierung */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Sortierung</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 space-y-2">
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
                          {SORTABLE_FIELDS.map((field) => (
                            <SelectItem key={field.value} value={field.value}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-[150px] space-y-2">
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
                          <SelectItem value="asc">
                            <span className="flex items-center gap-2">
                              <ArrowUp className="h-4 w-4" />
                              Aufsteigend
                            </span>
                          </SelectItem>
                          <SelectItem value="desc">
                            <span className="flex items-center gap-2">
                              <ArrowDown className="h-4 w-4" />
                              Absteigend
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Sort Info */}
                  <p className="text-sm text-muted-foreground">
                    {getSortInfo(editingTemplate.sort_by, editingTemplate.sort_direction)}
                  </p>
                </CardContent>
              </Card>

              {/* Gruppierung */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Gruppierung</CardTitle>
                  <CardDescription>Fasse Belege nach Kriterien zusammen</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Gruppieren nach</Label>
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
                        <SelectValue placeholder="Keine Gruppierung" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Keine Gruppierung</SelectItem>
                        <Separator className="my-1" />
                        {GROUPING_OPTIONS.map((option) => {
                          const IconComponent = {
                            Tag,
                            Building,
                            Calendar,
                            CalendarDays,
                            CalendarRange,
                            Percent,
                            CreditCard,
                          }[option.icon];
                          
                          return (
                            <SelectItem key={option.value} value={option.value}>
                              <span className="flex items-center gap-2">
                                {IconComponent && <IconComponent className="h-4 w-4" />}
                                {option.label}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {editingTemplate.group_by && (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Zwischensummen anzeigen</Label>
                          <p className="text-xs text-muted-foreground">Summen pro Gruppe berechnen</p>
                        </div>
                        <Switch
                          id="group-subtotals"
                          checked={editingTemplate.group_subtotals}
                          onCheckedChange={(checked) =>
                            setEditingTemplate({ ...editingTemplate, group_subtotals: checked })
                          }
                        />
                      </div>

                      {/* Group Preview */}
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm font-medium mb-2">Vorschau der Gruppen:</p>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          {getGroupPreview(editingTemplate.group_by).map((group, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <ChevronRight className="h-3 w-3" />
                              {group}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
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
                      Erweitert
                    </CardTitle>
                    {showAdvanced ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </CardHeader>
                {showAdvanced && (
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="include-header"
                          checked={editingTemplate.include_header}
                          onCheckedChange={(checked) =>
                            setEditingTemplate({ ...editingTemplate, include_header: checked })
                          }
                        />
                        <Label htmlFor="include-header">Kopfzeile</Label>
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch
                          id="include-totals"
                          checked={editingTemplate.include_totals}
                          onCheckedChange={(checked) =>
                            setEditingTemplate({ ...editingTemplate, include_totals: checked })
                          }
                        />
                        <Label htmlFor="include-totals">Summenzeile</Label>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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
                            <SelectItem value="de-AT">Österreich</SelectItem>
                            <SelectItem value="de-DE">Deutschland</SelectItem>
                            <SelectItem value="en-US">US</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>
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
