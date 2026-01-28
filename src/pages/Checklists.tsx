import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  ClipboardList,
  MoreVertical,
  Pencil,
  Trash2,
  RotateCcw,
  ExternalLink,
  Link as LinkIcon,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface ChecklistLink {
  url: string;
  label: string;
}

interface ChecklistItem {
  id: string;
  checklist_id: string;
  name: string;
  notes: string | null;
  links: ChecklistLink[];
  is_completed: boolean;
  completed_at: string | null;
  sort_order: number;
}

interface Checklist {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_archived: boolean;
  created_at: string;
  items?: ChecklistItem[];
}

export default function Checklists() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showNewChecklistDialog, setShowNewChecklistDialog] = useState(false);
  const [showNewItemDialog, setShowNewItemDialog] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<Checklist | null>(null);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<string | null>(null);
  const [expandedChecklists, setExpandedChecklists] = useState<Set<string>>(new Set());

  const [checklistForm, setChecklistForm] = useState({
    name: '',
    description: '',
    color: '#8B5CF6',
  });

  const [itemForm, setItemForm] = useState({
    name: '',
    notes: '',
    links: [] as ChecklistLink[],
  });

  const [newLink, setNewLink] = useState({ url: '', label: '' });

  const { data: checklists, isLoading } = useQuery({
    queryKey: ['checklists'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: lists, error } = await supabase
        .from('checklists')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Lade Items separat
      const { data: items } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });

      return (lists || []).map(list => ({
        ...list,
        items: (items || []).filter(item => item.checklist_id === list.id).map(item => ({
          ...item,
          links: (Array.isArray(item.links) ? item.links : []) as unknown as ChecklistLink[],
        })),
      })) as Checklist[];
    },
  });

  const saveChecklistMutation = useMutation({
    mutationFn: async (data: typeof checklistForm & { id?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nicht angemeldet');

      if (data.id) {
        const { error } = await supabase
          .from('checklists')
          .update({
            name: data.name,
            description: data.description || null,
            color: data.color,
            updated_at: new Date().toISOString(),
          })
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('checklists')
          .insert({
            user_id: user.id,
            name: data.name,
            description: data.description || null,
            color: data.color,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      setShowNewChecklistDialog(false);
      setEditingChecklist(null);
      resetChecklistForm();
      toast({ title: editingChecklist ? 'Checkliste aktualisiert' : 'Checkliste erstellt' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    },
  });

  const deleteChecklistMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('checklists').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      toast({ title: 'Checkliste gelöscht' });
    },
  });

  const saveItemMutation = useMutation({
    mutationFn: async (data: typeof itemForm & { id?: string; checklist_id: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nicht angemeldet');

      if (data.id) {
        const { error } = await supabase
          .from('checklist_items')
          .update({
            name: data.name,
            notes: data.notes || null,
            links: JSON.parse(JSON.stringify(data.links)),
            updated_at: new Date().toISOString(),
          })
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { data: maxOrder } = await supabase
          .from('checklist_items')
          .select('sort_order')
          .eq('checklist_id', data.checklist_id)
          .order('sort_order', { ascending: false })
          .limit(1)
          .single();

        const { error } = await supabase
          .from('checklist_items')
          .insert({
            user_id: user.id,
            checklist_id: data.checklist_id,
            name: data.name,
            notes: data.notes || null,
            links: JSON.parse(JSON.stringify(data.links)),
            sort_order: (maxOrder?.sort_order || 0) + 1,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      setShowNewItemDialog(false);
      setEditingItem(null);
      resetItemForm();
      toast({ title: editingItem ? 'Position aktualisiert' : 'Position hinzugefügt' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('checklist_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      toast({ title: 'Position gelöscht' });
    },
  });

  const toggleItemMutation = useMutation({
    mutationFn: async ({ id, is_completed }: { id: string; is_completed: boolean }) => {
      const { error } = await supabase
        .from('checklist_items')
        .update({
          is_completed,
          completed_at: is_completed ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
    },
  });

  const resetChecklistMutation = useMutation({
    mutationFn: async (checklistId: string) => {
      const { error } = await supabase.rpc('reset_checklist', {
        p_checklist_id: checklistId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      setShowResetConfirm(null);
      toast({ title: 'Checkliste zurückgesetzt', description: 'Alle Haken wurden entfernt.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    },
  });

  const resetChecklistForm = () => {
    setChecklistForm({ name: '', description: '', color: '#8B5CF6' });
  };

  const resetItemForm = () => {
    setItemForm({ name: '', notes: '', links: [] });
    setNewLink({ url: '', label: '' });
  };

  const addLink = () => {
    if (newLink.url) {
      setItemForm(prev => ({
        ...prev,
        links: [...prev.links, { url: newLink.url, label: newLink.label || newLink.url }],
      }));
      setNewLink({ url: '', label: '' });
    }
  };

  const removeLink = (index: number) => {
    setItemForm(prev => ({
      ...prev,
      links: prev.links.filter((_, i) => i !== index),
    }));
  };

  const toggleExpanded = (id: string) => {
    setExpandedChecklists(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getProgress = (items: ChecklistItem[]) => {
    if (!items || items.length === 0) return 0;
    const completed = items.filter(i => i.is_completed).length;
    return Math.round((completed / items.length) * 100);
  };

  const colorOptions = [
    '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B',
    '#EF4444', '#EC4899', '#6366F1', '#14B8A6',
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardList className="h-6 w-6" />
              Checklisten
            </h1>
            <p className="text-muted-foreground">
              Verwalte deine Aufgaben und To-Dos
            </p>
          </div>
          <Button onClick={() => { resetChecklistForm(); setShowNewChecklistDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Neue Checkliste
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : checklists && checklists.length > 0 ? (
          <div className="space-y-4">
            {checklists.map((checklist) => {
              const isExpanded = expandedChecklists.has(checklist.id);
              const progress = getProgress(checklist.items || []);
              const completedCount = checklist.items?.filter(i => i.is_completed).length || 0;
              const totalCount = checklist.items?.length || 0;

              return (
                <Card key={checklist.id} className="overflow-hidden">
                  <div
                    className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleExpanded(checklist.id)}
                  >
                    <div
                      className="w-full h-1 absolute top-0 left-0"
                      style={{ backgroundColor: checklist.color }}
                    />
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <h3 className="font-semibold truncate">{checklist.name}</h3>
                          <Badge variant="secondary" className="ml-2">
                            {completedCount}/{totalCount}
                          </Badge>
                        </div>
                        {checklist.description && (
                          <p className="text-sm text-muted-foreground mt-1 ml-6">
                            {checklist.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-32">
                          <Progress value={progress} className="h-2" />
                          <span className="text-xs text-muted-foreground">
                            {progress}%
                          </span>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              setSelectedChecklistId(checklist.id);
                              resetItemForm();
                              setShowNewItemDialog(true);
                            }}>
                              <Plus className="h-4 w-4 mr-2" />
                              Position hinzufügen
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              setEditingChecklist(checklist);
                              setChecklistForm({
                                name: checklist.name,
                                description: checklist.description || '',
                                color: checklist.color,
                              });
                              setShowNewChecklistDialog(true);
                            }}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Bearbeiten
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowResetConfirm(checklist.id);
                              }}
                              disabled={completedCount === 0}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Zurücksetzen
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Checkliste wirklich löschen?')) {
                                  deleteChecklistMutation.mutate(checklist.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Löschen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <CardContent className="pt-0 border-t">
                      <div className="space-y-2 mt-4">
                        {checklist.items && checklist.items.length > 0 ? (
                          <div className="space-y-2">
                            {checklist.items.map((item) => (
                              <div
                                key={item.id}
                                className={`flex items-start gap-3 p-3 rounded-lg border ${
                                  item.is_completed ? 'bg-muted/50' : ''
                                }`}
                              >
                                <Checkbox
                                  checked={item.is_completed}
                                  onCheckedChange={(checked) => {
                                    toggleItemMutation.mutate({
                                      id: item.id,
                                      is_completed: checked as boolean,
                                    });
                                  }}
                                  className="mt-1"
                                />

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={item.is_completed ? 'line-through text-muted-foreground' : ''}>
                                      {item.name}
                                    </span>
                                    {item.notes && (
                                      <span className="text-sm text-muted-foreground">
                                        — {item.notes}
                                      </span>
                                    )}
                                  </div>
                                  {item.links && item.links.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                      {item.links.map((link, idx) => (
                                        <a
                                          key={idx}
                                          href={link.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                          {link.label}
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => {
                                      setEditingItem(item);
                                      setSelectedChecklistId(item.checklist_id);
                                      setItemForm({
                                        name: item.name,
                                        notes: item.notes || '',
                                        links: item.links || [],
                                      });
                                      setShowNewItemDialog(true);
                                    }}>
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Bearbeiten
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => {
                                        if (confirm('Position wirklich löschen?')) {
                                          deleteItemMutation.mutate(item.id);
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Löschen
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Noch keine Positionen vorhanden
                          </p>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => {
                            setSelectedChecklistId(checklist.id);
                            resetItemForm();
                            setShowNewItemDialog(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Position hinzufügen
                        </Button>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Keine Checklisten vorhanden</h3>
            <p className="text-muted-foreground mb-4">
              Erstelle deine erste Checkliste um Aufgaben zu organisieren.
            </p>
            <Button onClick={() => { resetChecklistForm(); setShowNewChecklistDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Erste Checkliste erstellen
            </Button>
          </div>
        )}

        {/* Dialog: Neue/Bearbeiten Checkliste */}
        <Dialog open={showNewChecklistDialog} onOpenChange={(open) => {
          if (!open) { setEditingChecklist(null); resetChecklistForm(); }
          setShowNewChecklistDialog(open);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingChecklist ? 'Checkliste bearbeiten' : 'Neue Checkliste'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="checklist-name">Name *</Label>
                <Input
                  id="checklist-name"
                  value={checklistForm.name}
                  onChange={(e) => setChecklistForm({ ...checklistForm, name: e.target.value })}
                  placeholder="z.B. Q1 2025 Buchhaltung"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="checklist-desc">Beschreibung</Label>
                <Textarea
                  id="checklist-desc"
                  value={checklistForm.description}
                  onChange={(e) => setChecklistForm({ ...checklistForm, description: e.target.value })}
                  placeholder="Optionale Beschreibung..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Farbe</Label>
                <div className="flex gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`
                        w-8 h-8 rounded-full transition-transform
                        ${checklistForm.color === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-110'}
                      `}
                      style={{ backgroundColor: color }}
                      onClick={() => setChecklistForm({ ...checklistForm, color })}
                    />
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewChecklistDialog(false)}>
                Abbrechen
              </Button>
              <Button
                onClick={() => saveChecklistMutation.mutate({
                  ...checklistForm,
                  id: editingChecklist?.id,
                })}
                disabled={!checklistForm.name || saveChecklistMutation.isPending}
              >
                {saveChecklistMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingChecklist ? 'Speichern' : 'Erstellen'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Neue/Bearbeiten Position */}
        <Dialog open={showNewItemDialog} onOpenChange={(open) => {
          if (!open) { setEditingItem(null); resetItemForm(); }
          setShowNewItemDialog(open);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingItem ? 'Position bearbeiten' : 'Neue Position'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="item-name">Name *</Label>
                <Input
                  id="item-name"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  placeholder="z.B. USt-Voranmeldung einreichen"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="item-notes">Notizen</Label>
                <Textarea
                  id="item-notes"
                  value={itemForm.notes}
                  onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })}
                  placeholder="Optionale Notizen..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Links</Label>
                {itemForm.links.length > 0 && (
                  <div className="space-y-2 mb-2">
                    {itemForm.links.map((link, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded">
                        <LinkIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 text-sm truncate">{link.label}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeLink(idx)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Input
                    value={newLink.label}
                    onChange={(e) => setNewLink({ ...newLink, label: e.target.value })}
                    placeholder="Bezeichnung"
                    className="flex-1"
                  />
                  <Input
                    value={newLink.url}
                    onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                    placeholder="https://..."
                    className="flex-1"
                  />
                  <Button variant="outline" onClick={addLink} disabled={!newLink.url}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewItemDialog(false)}>
                Abbrechen
              </Button>
              <Button
                onClick={() => saveItemMutation.mutate({
                  ...itemForm,
                  id: editingItem?.id,
                  checklist_id: selectedChecklistId!,
                })}
                disabled={!itemForm.name || !selectedChecklistId || saveItemMutation.isPending}
              >
                {saveItemMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingItem ? 'Speichern' : 'Hinzufügen'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bestätigungs-Dialog: Zurücksetzen */}
        <AlertDialog open={!!showResetConfirm} onOpenChange={() => setShowResetConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Checkliste zurücksetzen?</AlertDialogTitle>
              <AlertDialogDescription>
                Alle Haken werden entfernt. Die Positionen bleiben erhalten.
                Diese Aktion kann nicht rückgängig gemacht werden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => showResetConfirm && resetChecklistMutation.mutate(showResetConfirm)}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Zurücksetzen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
