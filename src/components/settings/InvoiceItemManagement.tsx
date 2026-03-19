import { useState, useRef, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, Package, FolderPlus, ChevronDown, ChevronRight, Upload, X, Image as ImageIcon,
  Wrench, Paintbrush, Truck, Monitor, Hammer, Scissors, Coffee, ShoppingCart, FileText, Briefcase, Star,
  Zap, Heart, Settings, Globe, Phone, Camera, Printer, Layers, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useInvoiceItems, InvoiceItem } from '@/hooks/useInvoiceItems';
import { useItemGroups } from '@/hooks/useItemGroups';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const UNITS = ['Stk', 'Std', 'Pauschale', 'km', 'kg', 'm²', 'Monat', 'Jahr'];
const VAT_RATES = [{ value: '20', label: '20%' }, { value: '13', label: '13%' }, { value: '10', label: '10%' }, { value: '0', label: '0%' }];

const ICON_OPTIONS = [
  { name: 'Package', icon: Package },
  { name: 'Wrench', icon: Wrench },
  { name: 'Paintbrush', icon: Paintbrush },
  { name: 'Truck', icon: Truck },
  { name: 'Monitor', icon: Monitor },
  { name: 'Hammer', icon: Hammer },
  { name: 'Scissors', icon: Scissors },
  { name: 'Coffee', icon: Coffee },
  { name: 'ShoppingCart', icon: ShoppingCart },
  { name: 'FileText', icon: FileText },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'Star', icon: Star },
  { name: 'Zap', icon: Zap },
  { name: 'Heart', icon: Heart },
  { name: 'Settings', icon: Settings },
  { name: 'Globe', icon: Globe },
  { name: 'Phone', icon: Phone },
  { name: 'Camera', icon: Camera },
  { name: 'Printer', icon: Printer },
  { name: 'Layers', icon: Layers },
  { name: 'Box', icon: Box },
];

const getIconComponent = (name: string | null) => {
  if (!name) return Package;
  return ICON_OPTIONS.find(i => i.name === name)?.icon || Package;
};

const EMPTY_FORM = { name: '', description: '', unit: 'Stk', unit_price: 0, vat_rate: 20, is_active: true, icon: '', image_path: '', item_group_id: '' };

export function InvoiceItemManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { items, loading, addItem, updateItem, deleteItem } = useInvoiceItems();
  const { groups, addGroup, updateGroup, deleteGroup } = useItemGroups();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['__none__']));
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = items.filter(i => {
    const q = search.toLowerCase();
    return !q || i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q);
  });

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setImagePreview(null); setDialogOpen(true); };
  const openEdit = (i: InvoiceItem) => {
    setEditingId(i.id);
    setForm({
      name: i.name,
      description: i.description || '',
      unit: i.unit || 'Stk',
      unit_price: i.unit_price || 0,
      vat_rate: i.vat_rate || 20,
      is_active: i.is_active !== false,
      icon: i.icon || '',
      image_path: i.image_path || '',
      item_group_id: i.item_group_id || '',
    });
    if (i.image_path) {
      loadImagePreview(i.image_path);
    } else {
      setImagePreview(null);
    }
    setDialogOpen(true);
  };

  const loadImagePreview = async (path: string) => {
    const { data } = await supabase.storage.from('item-images').createSignedUrl(path, 3600);
    if (data?.signedUrl) setImagePreview(data.signedUrl);
  };

  const handleImageUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Datei zu groß', description: 'Maximal 2MB erlaubt', variant: 'destructive' });
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) {
      toast({ title: 'Ungültiges Format', description: 'Nur JPG, PNG, WEBP erlaubt', variant: 'destructive' });
      return;
    }
    setUploading(true);
    const fileName = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('item-images').upload(fileName, file);
    if (error) {
      toast({ title: 'Upload fehlgeschlagen', description: error.message, variant: 'destructive' });
    } else {
      setForm(f => ({ ...f, image_path: fileName }));
      const { data } = await supabase.storage.from('item-images').createSignedUrl(fileName, 3600);
      if (data?.signedUrl) setImagePreview(data.signedUrl);
    }
    setUploading(false);
  };

  const removeImage = async () => {
    if (form.image_path) {
      await supabase.storage.from('item-images').remove([form.image_path]);
    }
    setForm(f => ({ ...f, image_path: '' }));
    setImagePreview(null);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const payload: any = {
      name: form.name,
      description: form.description || null,
      unit: form.unit,
      unit_price: form.unit_price,
      vat_rate: form.vat_rate,
      is_active: form.is_active,
      icon: form.icon || null,
      image_path: form.image_path || null,
      item_group_id: form.item_group_id || null,
    };
    if (editingId) {
      await updateItem(editingId, payload);
    } else {
      await addItem(payload);
    }
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (deleteId) { await deleteItem(deleteId); setDeleteId(null); }
  };

  // Group management
  const openGroupCreate = () => { setEditingGroupId(null); setGroupName(''); setGroupDialogOpen(true); };
  const openGroupEdit = (g: { id: string; name: string }) => { setEditingGroupId(g.id); setGroupName(g.name); setGroupDialogOpen(true); };
  const handleGroupSave = async () => {
    if (!groupName.trim()) return;
    if (editingGroupId) {
      await updateGroup(editingGroupId, groupName);
    } else {
      await addGroup(groupName);
    }
    setGroupDialogOpen(false);
  };
  const handleGroupDelete = async () => {
    if (deleteGroupId) { await deleteGroup(deleteGroupId); setDeleteGroupId(null); }
  };

  // Group items
  const groupedItems: { groupId: string; groupName: string; items: InvoiceItem[] }[] = [];
  const groupMap = new Map<string, InvoiceItem[]>();
  for (const item of filtered) {
    const gid = item.item_group_id || '__none__';
    if (!groupMap.has(gid)) groupMap.set(gid, []);
    groupMap.get(gid)!.push(item);
  }
  for (const g of groups) {
    groupedItems.push({ groupId: g.id, groupName: g.name, items: groupMap.get(g.id) || [] });
  }
  const ungrouped = groupMap.get('__none__') || [];
  if (ungrouped.length > 0 || groups.length === 0) {
    groupedItems.push({ groupId: '__none__', groupName: 'Ohne Gruppe', items: ungrouped });
  }

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const IconComp = getIconComponent(null);

  return (
    <div className="space-y-4">
      {/* Groups management */}
      {groups.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-secondary/50 flex items-center justify-center">
                <Layers className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base">Artikelgruppen</CardTitle>
              </div>
              <Button onClick={openGroupCreate} size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Gruppe</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {groups.map(g => (
                <div key={g.id} className="flex items-center gap-1 px-3 py-1.5 rounded-full border bg-card text-sm">
                  <span>{g.name}</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5 ml-1" onClick={() => openGroupEdit(g)}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => setDeleteGroupId(g.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle>Artikel & Dienstleistungen</CardTitle>
              <CardDescription>Vorlagen für Rechnungspositionen</CardDescription>
            </div>
            <div className="flex gap-2">
              {groups.length === 0 && (
                <Button onClick={openGroupCreate} size="sm" variant="outline"><FolderPlus className="h-4 w-4 mr-1" /> Gruppe</Button>
              )}
              <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1" /> Artikel</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>

          {groupedItems.every(g => g.items.length === 0) ? (
            <p className="text-center text-muted-foreground py-8">Keine Artikel gefunden</p>
          ) : (
            <div className="space-y-2">
              {groupedItems.map(group => {
                if (group.items.length === 0 && group.groupId === '__none__') return null;
                const isExpanded = expandedGroups.has(group.groupId);
                return (
                  <Collapsible key={group.groupId} open={isExpanded} onOpenChange={() => toggleGroup(group.groupId)}>
                    <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-accent/50 transition-colors text-left">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <span className="font-medium text-sm">{group.groupName}</span>
                      <Badge variant="secondary" className="text-xs ml-auto">{group.items.length}</Badge>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-1 ml-6 mt-1">
                        {group.items.map(i => {
                          const Icon = getIconComponent(i.icon);
                          return (
                            <div key={i.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                              <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                                {i.image_path ? (
                                  <ItemImageThumb path={i.image_path} />
                                ) : (
                                  <Icon className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{i.name}</span>
                                  {!i.is_active && <Badge variant="outline" className="text-xs">Inaktiv</Badge>}
                                </div>
                                {i.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{i.description}</p>}
                              </div>
                              <div className="text-right text-sm flex-shrink-0">
                                <div className="font-medium">€ {(i.unit_price || 0).toFixed(2)}</div>
                                <div className="text-xs text-muted-foreground">{i.unit} · {i.vat_rate}% MwSt</div>
                              </div>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(i.id)}><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Article Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Artikel bearbeiten' : 'Neuer Artikel'}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Beschreibung</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            
            {/* Group Select */}
            {groups.length > 0 && (
              <div>
                <Label>Artikelgruppe</Label>
                <Select value={form.item_group_id || '__none__'} onValueChange={v => setForm(f => ({ ...f, item_group_id: v === '__none__' ? '' : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Keine Gruppe</SelectItem>
                    {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Einheit</Label>
                <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Einzelpreis (€)</Label><Input type="number" step="0.01" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: parseFloat(e.target.value) || 0 }))} /></div>
              <div>
                <Label>MwSt-Satz</Label>
                <Select value={String(form.vat_rate)} onValueChange={v => setForm(f => ({ ...f, vat_rate: parseFloat(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{VAT_RATES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Icon Picker */}
            <div>
              <Label>Symbol (nur zur Übersicht)</Label>
              <div className="grid grid-cols-7 gap-1.5 mt-1.5">
                {ICON_OPTIONS.map(opt => {
                  const isSelected = form.icon === opt.name;
                  return (
                    <button
                      key={opt.name}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, icon: isSelected ? '' : opt.name }))}
                      className={`h-9 w-9 rounded-md flex items-center justify-center border transition-colors ${
                        isSelected ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'
                      }`}
                    >
                      <opt.icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Image Upload */}
            <div>
              <Label>Artikelbild (wird in PDFs angezeigt)</Label>
              {imagePreview ? (
                <div className="mt-1.5 relative inline-block">
                  <img src={imagePreview} alt="Artikelbild" className="h-24 w-24 object-cover rounded-lg border" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-6 w-6 absolute -top-2 -right-2 rounded-full"
                    onClick={removeImage}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div
                  className="mt-1.5 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImageUpload(f); }}
                >
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  ) : (
                    <>
                      <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                      <p className="text-xs text-muted-foreground">Bild hochladen (max 2MB, JPG/PNG/WEBP)</p>
                    </>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ''; }}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>Aktiv</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={!form.name.trim()}>{editingId ? 'Speichern' : 'Erstellen'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Article Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Artikel löschen?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Dieser Artikel wird unwiderruflich gelöscht.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleDelete}>Löschen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group Dialog */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingGroupId ? 'Gruppe bearbeiten' : 'Neue Artikelgruppe'}</DialogTitle></DialogHeader>
          <div><Label>Name *</Label><Input value={groupName} onChange={e => setGroupName(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleGroupSave} disabled={!groupName.trim()}>{editingGroupId ? 'Speichern' : 'Erstellen'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Group Dialog */}
      <Dialog open={!!deleteGroupId} onOpenChange={() => setDeleteGroupId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Artikelgruppe löschen?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Artikel in dieser Gruppe werden beibehalten, aber der Gruppe entfernt.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteGroupId(null)}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleGroupDelete}>Löschen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Small component for loading thumbnails
function ItemImageThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useState(() => {
    supabase.storage.from('item-images').createSignedUrl(path, 3600).then(({ data }) => {
      if (data?.signedUrl) setUrl(data.signedUrl);
    });
  });
  if (!url) return <ImageIcon className="h-4 w-4 text-muted-foreground" />;
  return <img src={url} alt="" className="h-8 w-8 object-cover rounded-md" />;
}
