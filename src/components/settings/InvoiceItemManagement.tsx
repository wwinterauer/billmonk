import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useInvoiceItems, InvoiceItem } from '@/hooks/useInvoiceItems';
import { Loader2 } from 'lucide-react';

const UNITS = ['Stk', 'Std', 'Pauschale', 'km', 'kg', 'm²', 'Monat', 'Jahr'];
const VAT_RATES = [{ value: '20', label: '20%' }, { value: '13', label: '13%' }, { value: '10', label: '10%' }, { value: '0', label: '0%' }];

const EMPTY_FORM = { name: '', description: '', unit: 'Stk', unit_price: 0, vat_rate: 20, is_active: true };

export function InvoiceItemManagement() {
  const { items, loading, addItem, updateItem, deleteItem } = useInvoiceItems();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = items.filter(i => {
    const q = search.toLowerCase();
    return !q || i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q);
  });

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (i: InvoiceItem) => {
    setEditingId(i.id);
    setForm({
      name: i.name,
      description: i.description || '',
      unit: i.unit || 'Stk',
      unit_price: i.unit_price || 0,
      vat_rate: i.vat_rate || 20,
      is_active: i.is_active !== false,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (editingId) {
      await updateItem(editingId, form as any);
    } else {
      await addItem(form as any);
    }
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (deleteId) { await deleteItem(deleteId); setDeleteId(null); }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
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
            <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1" /> Artikel</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>

          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Keine Artikel gefunden</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(i => (
                <div key={i.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Artikel bearbeiten' : 'Neuer Artikel'}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Beschreibung</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
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
    </div>
  );
}
