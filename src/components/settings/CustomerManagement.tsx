import { useState } from 'react';
import { Plus, Pencil, Trash2, Archive, Search, Building2, Mail, Phone, MapPin, Save, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useCustomers, Customer } from '@/hooks/useCustomers';
import { useInvoiceSettings } from '@/hooks/useInvoiceSettings';
import { Loader2 } from 'lucide-react';

const EMPTY_FORM = {
  display_name: '',
  company_name: '',
  contact_person: '',
  email: '',
  phone: '',
  street: '',
  zip: '',
  city: '',
  country: 'AT',
  uid_number: '',
  customer_number: '',
  payment_terms_days: 14,
  notes: '',
  has_different_shipping_address: false,
  shipping_street: '',
  shipping_zip: '',
  shipping_city: '',
  shipping_country: 'AT',
};

export function CustomerManagement() {
  const { customers, loading, addCustomer, updateCustomer, deleteCustomer } = useCustomers();
  const { settings: invoiceSettings, saveSettings } = useInvoiceSettings();
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [customerNumberPrefix, setCustomerNumberPrefix] = useState('KD');
  const [customerNumberFormat, setCustomerNumberFormat] = useState('{prefix}-{seq}');
  const [nextCustomerNumber, setNextCustomerNumber] = useState(1);
  const [savingNumberSettings, setSavingNumberSettings] = useState(false);
  const [numberSettingsLoaded, setNumberSettingsLoaded] = useState(false);

  // Sync number settings from invoiceSettings
  if (invoiceSettings && !numberSettingsLoaded) {
    setCustomerNumberPrefix((invoiceSettings as any).customer_number_prefix || 'KD');
    setCustomerNumberFormat((invoiceSettings as any).customer_number_format || '{prefix}-{seq}');
    setNextCustomerNumber((invoiceSettings as any).next_customer_number || 1);
    setNumberSettingsLoaded(true);
  }

  const previewCustomerNumber = customerNumberFormat
    .replace('{prefix}', customerNumberPrefix)
    .replace('{seq}', String(nextCustomerNumber).padStart(4, '0'));

  const handleSaveNumberSettings = async () => {
    setSavingNumberSettings(true);
    await saveSettings({
      customer_number_prefix: customerNumberPrefix,
      customer_number_format: customerNumberFormat,
      next_customer_number: nextCustomerNumber,
    } as any);
    setSavingNumberSettings(false);
  };

  const filtered = customers.filter(c => {
    if (!showArchived && c.is_archived) return false;
    if (showArchived && !c.is_archived) return false;
    const q = search.toLowerCase();
    return !q || c.display_name.toLowerCase().includes(q) || c.company_name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
  });

  const generateCustomerNumber = (): string => {
    const prefix = invoiceSettings?.customer_number_prefix || 'KD';
    const seq = invoiceSettings?.next_customer_number || 1;
    const format = invoiceSettings?.customer_number_format || '{prefix}-{seq}';
    return format
      .replace('{prefix}', prefix)
      .replace('{seq}', String(seq).padStart(4, '0'));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      customer_number: generateCustomerNumber(),
    });
    setDialogOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditingId(c.id);
    setForm({
      display_name: c.display_name || '',
      company_name: c.company_name || '',
      contact_person: c.contact_person || '',
      email: c.email || '',
      phone: c.phone || '',
      street: c.street || '',
      zip: c.zip || '',
      city: c.city || '',
      country: c.country || 'AT',
      uid_number: c.uid_number || '',
      customer_number: c.customer_number || '',
      payment_terms_days: c.payment_terms_days || 14,
      notes: c.notes || '',
      has_different_shipping_address: c.has_different_shipping_address || false,
      shipping_street: c.shipping_street || '',
      shipping_zip: c.shipping_zip || '',
      shipping_city: c.shipping_city || '',
      shipping_country: c.shipping_country || 'AT',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.display_name.trim()) return;
    const payload: any = { ...form };
    if (!payload.has_different_shipping_address) {
      payload.shipping_street = null;
      payload.shipping_zip = null;
      payload.shipping_city = null;
      payload.shipping_country = null;
    }
    if (editingId) {
      await updateCustomer(editingId, payload);
    } else {
      await addCustomer(payload);
    }
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteCustomer(deleteId);
      setDeleteId(null);
    }
  };

  const handleArchive = async (id: string, archived: boolean) => {
    await updateCustomer(id, { is_archived: archived } as any);
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Kundennummernkreis */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Hash className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Kundennummernkreis</CardTitle>
              <CardDescription>Format und Zähler für automatische Kundennummern</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Präfix</Label><Input value={customerNumberPrefix} onChange={e => setCustomerNumberPrefix(e.target.value)} /></div>
            <div><Label>Format</Label><Input value={customerNumberFormat} onChange={e => setCustomerNumberFormat(e.target.value)} /></div>
            <div><Label>Nächste Nr.</Label><Input type="number" value={nextCustomerNumber} onChange={e => setNextCustomerNumber(parseInt(e.target.value) || 1)} /></div>
          </div>
          <p className="text-xs text-muted-foreground">Vorschau: <span className="font-mono font-medium text-foreground">{previewCustomerNumber}</span></p>
          <p className="text-xs text-muted-foreground">Platzhalter: {'{prefix}'}, {'{seq}'}</p>
          <Button size="sm" onClick={handleSaveNumberSettings} disabled={savingNumberSettings}>
            {savingNumberSettings ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Speichern
          </Button>
        </CardContent>
      </Card>

      {/* Kundenliste */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle>Kundenverwaltung</CardTitle>
              <CardDescription>Verwalte deine Kunden für Ausgangsrechnungen</CardDescription>
            </div>
            <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1" /> Kunde</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Button variant={showArchived ? 'secondary' : 'outline'} size="sm" onClick={() => setShowArchived(!showArchived)}>
              <Archive className="h-4 w-4 mr-1" /> Archiviert
            </Button>
          </div>

          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Keine Kunden gefunden</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
                    {c.display_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{c.display_name}</span>
                      {c.customer_number && <Badge variant="outline" className="text-xs">{c.customer_number}</Badge>}
                      {c.company_name && <Badge variant="secondary" className="text-xs">{c.company_name}</Badge>}
                      {c.is_archived && <Badge variant="outline" className="text-xs">Archiviert</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                      {c.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{c.city}</span>}
                      {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleArchive(c.id, !c.is_archived)}>
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Kunde bearbeiten' : 'Neuer Kunde'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Anzeigename *</Label><Input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} /></div>
              <div><Label>Firma</Label><Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Kontaktperson</Label><Input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} /></div>
              <div><Label>Kundennummer</Label><Input value={form.customer_number} onChange={e => setForm(f => ({ ...f, customer_number: e.target.value }))} placeholder="Wird automatisch generiert" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>E-Mail</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><Label>Telefon</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            </div>

            <Separator />
            <p className="text-sm font-medium text-muted-foreground">Rechnungsanschrift</p>

            <div><Label>Straße</Label><Input value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>PLZ</Label><Input value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} /></div>
              <div><Label>Stadt</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
              <div><Label>Land</Label><Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} /></div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="different-shipping"
                checked={form.has_different_shipping_address}
                onCheckedChange={(checked) => setForm(f => ({ ...f, has_different_shipping_address: !!checked }))}
              />
              <Label htmlFor="different-shipping" className="cursor-pointer">Abweichende Lieferanschrift</Label>
            </div>

            {form.has_different_shipping_address && (
              <>
                <p className="text-sm font-medium text-muted-foreground">Lieferanschrift</p>
                <div><Label>Straße</Label><Input value={form.shipping_street} onChange={e => setForm(f => ({ ...f, shipping_street: e.target.value }))} /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>PLZ</Label><Input value={form.shipping_zip} onChange={e => setForm(f => ({ ...f, shipping_zip: e.target.value }))} /></div>
                  <div><Label>Stadt</Label><Input value={form.shipping_city} onChange={e => setForm(f => ({ ...f, shipping_city: e.target.value }))} /></div>
                  <div><Label>Land</Label><Input value={form.shipping_country} onChange={e => setForm(f => ({ ...f, shipping_country: e.target.value }))} /></div>
                </div>
              </>
            )}

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <div><Label>UID-Nummer</Label><Input value={form.uid_number} onChange={e => setForm(f => ({ ...f, uid_number: e.target.value }))} /></div>
              <div><Label>Zahlungsziel (Tage)</Label><Input type="number" value={form.payment_terms_days} onChange={e => setForm(f => ({ ...f, payment_terms_days: parseInt(e.target.value) || 14 }))} /></div>
            </div>
            <div><Label>Notizen</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={!form.display_name.trim()}>{editingId ? 'Speichern' : 'Erstellen'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Kunde löschen?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Dieser Kunde wird unwiderruflich gelöscht. Bestehende Rechnungen bleiben erhalten.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleDelete}>Löschen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
