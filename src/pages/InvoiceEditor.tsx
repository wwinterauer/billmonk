import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { useCustomers } from '@/hooks/useCustomers';
import { useInvoiceItems, type InvoiceItem } from '@/hooks/useInvoiceItems';
import { useInvoiceSettings } from '@/hooks/useInvoiceSettings';
import { useInvoices } from '@/hooks/useInvoices';
import { useCategories } from '@/hooks/useCategories';
import { InvoiceTagSelector } from '@/components/invoices/InvoiceTagSelector';
import { supabase } from '@/integrations/supabase/client';

interface EditorLineItem {
  tempId: string;
  invoice_item_id: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  vat_rate: number;
}

const newLine = (): EditorLineItem => ({
  tempId: crypto.randomUUID(),
  invoice_item_id: null,
  description: '',
  quantity: 1,
  unit: 'Stk',
  unit_price: 0,
  vat_rate: 20,
});

const InvoiceEditor = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== 'new';
  const navigate = useNavigate();

  const { customers } = useCustomers();
  const { items: articleTemplates } = useInvoiceItems();
  const { settings } = useInvoiceSettings();
  const { createInvoice, fetchLineItems } = useInvoices();
  const { categories } = useCategories();

  const [customerId, setCustomerId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [footerText, setFooterText] = useState('');
  const [lines, setLines] = useState<EditorLineItem[]>([newLine()]);
  const [saving, setSaving] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [category, setCategory] = useState('');
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(id && id !== 'new' ? id : null);

  // Generate invoice number from settings
  useEffect(() => {
    if (settings && !isEdit) {
      const prefix = settings.invoice_number_prefix || 'RE';
      const seq = settings.next_sequence_number || 1;
      const year = new Date().getFullYear();
      const formatted = (settings.invoice_number_format || '{prefix}-{year}-{seq}')
        .replace('{prefix}', prefix)
        .replace('{year}', String(year))
        .replace('{seq}', String(seq).padStart(4, '0'));
      setInvoiceNumber(formatted);
    }
    if (settings?.default_footer_text && !footerText) {
      setFooterText(settings.default_footer_text);
    }
    if (settings?.default_notes && !notes) {
      setNotes(settings.default_notes);
    }
  }, [settings, isEdit]);

  // Set due date when customer changes
  useEffect(() => {
    if (customerId && invoiceDate) {
      const cust = customers.find(c => c.id === customerId);
      const days = cust?.payment_terms_days ?? settings?.default_payment_terms_days ?? 14;
      const due = new Date(invoiceDate);
      due.setDate(due.getDate() + days);
      setDueDate(due.toISOString().split('T')[0]);
    }
  }, [customerId, invoiceDate, customers, settings]);

  // Load existing invoice data for editing
  useEffect(() => {
    if (isEdit && id) {
      (async () => {
        const { data } = await supabase
          .from('invoices')
          .select('*')
          .eq('id', id)
          .single();
        if (data) {
          const inv = data as any;
          setCustomerId(inv.customer_id);
          setInvoiceDate(inv.invoice_date || '');
          setDueDate(inv.due_date || '');
          setNotes(inv.notes || '');
          setFooterText(inv.footer_text || '');
          setInvoiceNumber(inv.invoice_number);
          setCategory(inv.category || '');
        }

        const lineItems = await fetchLineItems(id);
        if (lineItems.length > 0) {
          setLines(lineItems.map(li => ({
            tempId: li.id,
            invoice_item_id: li.invoice_item_id,
            description: li.description,
            quantity: li.quantity || 1,
            unit: li.unit || 'Stk',
            unit_price: li.unit_price || 0,
            vat_rate: li.vat_rate ?? 20,
          })));
        }
      })();
    }
  }, [isEdit, id]);

  const updateLine = (tempId: string, field: keyof EditorLineItem, value: any) => {
    setLines(prev => prev.map(l => l.tempId === tempId ? { ...l, [field]: value } : l));
  };

  const addFromTemplate = (template: InvoiceItem) => {
    setLines(prev => [...prev, {
      tempId: crypto.randomUUID(),
      invoice_item_id: template.id,
      description: template.name + (template.description ? ` – ${template.description}` : ''),
      quantity: 1,
      unit: template.unit || 'Stk',
      unit_price: template.unit_price || 0,
      vat_rate: template.vat_rate ?? 20,
    }]);
  };

  const removeLine = (tempId: string) => {
    setLines(prev => prev.length <= 1 ? prev : prev.filter(l => l.tempId !== tempId));
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    let vatTotal = 0;
    const vatGroups: Record<number, { net: number; vat: number }> = {};

    for (const l of lines) {
      const net = l.quantity * l.unit_price;
      const vat = net * (l.vat_rate / 100);
      subtotal += net;
      vatTotal += vat;
      if (!vatGroups[l.vat_rate]) vatGroups[l.vat_rate] = { net: 0, vat: 0 };
      vatGroups[l.vat_rate].net += net;
      vatGroups[l.vat_rate].vat += vat;
    }

    return { subtotal, vatTotal, total: subtotal + vatTotal, vatGroups };
  }, [lines]);

  const fmt = (n: number) =>
    new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(n);

  const handleSave = async (asDraft = true) => {
    if (!customerId) return;
    setSaving(true);

    const result = await createInvoice(
      {
        customer_id: customerId,
        invoice_number: invoiceNumber,
        status: asDraft ? 'draft' : 'sent',
        invoice_date: invoiceDate,
        due_date: dueDate || undefined,
        notes: notes || undefined,
        footer_text: footerText || undefined,
        category: category || undefined,
      },
      lines.map(l => ({
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unit_price: l.unit_price,
        vat_rate: l.vat_rate,
        invoice_item_id: l.invoice_item_id || undefined,
      }))
    );

    setSaving(false);
    if (result) {
      setSavedInvoiceId(result.id);
      navigate('/invoices');
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/invoices')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isEdit ? 'Rechnung bearbeiten' : 'Neue Rechnung'}
            </h1>
            <p className="text-muted-foreground">{invoiceNumber || '–'}</p>
          </div>
        </div>

        {/* Meta */}
        <Card>
          <CardHeader>
            <CardTitle>Rechnungsdaten</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Kunde *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Kunde auswählen…" />
                </SelectTrigger>
                <SelectContent>
                  {customers.filter(c => !c.is_archived).map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.display_name}{c.company_name ? ` (${c.company_name})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Rechnungsnr.</Label>
              <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Rechnungsdatum</Label>
              <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Fälligkeitsdatum</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Kategorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Kategorie wählen…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Keine Kategorie</SelectItem>
                  {categories.filter(c => !c.is_hidden).map(c => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {savedInvoiceId && (
              <div className="space-y-2 md:col-span-2">
                <Label>Tags</Label>
                <InvoiceTagSelector invoiceId={savedInvoiceId} size="sm" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Positionen</CardTitle>
            <div className="flex gap-2">
              {articleTemplates.filter(a => a.is_active).length > 0 && (
                <Select onValueChange={(val) => {
                  const tpl = articleTemplates.find(a => a.id === val);
                  if (tpl) addFromTemplate(tpl);
                }}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Aus Vorlage…" />
                  </SelectTrigger>
                  <SelectContent>
                    {articleTemplates.filter(a => a.is_active).map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button variant="outline" size="sm" onClick={() => setLines(prev => [...prev, newLine()])}>
                <Plus className="h-4 w-4 mr-1" /> Position
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[250px]">Beschreibung</TableHead>
                  <TableHead className="w-20">Menge</TableHead>
                  <TableHead className="w-20">Einheit</TableHead>
                  <TableHead className="w-28">Einzelpreis</TableHead>
                  <TableHead className="w-24">MwSt %</TableHead>
                  <TableHead className="w-28 text-right">Netto</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map(line => (
                  <TableRow key={line.tempId}>
                    <TableCell>
                      <Input
                        value={line.description}
                        onChange={e => updateLine(line.tempId, 'description', e.target.value)}
                        placeholder="Beschreibung…"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.quantity}
                        onChange={e => updateLine(line.tempId, 'quantity', parseFloat(e.target.value) || 0)}
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={line.unit} onValueChange={v => updateLine(line.tempId, 'unit', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Stk">Stk</SelectItem>
                          <SelectItem value="Std">Std</SelectItem>
                          <SelectItem value="Pauschale">Pauschale</SelectItem>
                          <SelectItem value="m">m</SelectItem>
                          <SelectItem value="m²">m²</SelectItem>
                          <SelectItem value="kg">kg</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.unit_price}
                        onChange={e => updateLine(line.tempId, 'unit_price', parseFloat(e.target.value) || 0)}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={String(line.vat_rate)}
                        onValueChange={v => updateLine(line.tempId, 'vat_rate', parseFloat(v))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0 %</SelectItem>
                          <SelectItem value="10">10 %</SelectItem>
                          <SelectItem value="13">13 %</SelectItem>
                          <SelectItem value="20">20 %</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {fmt(line.quantity * line.unit_price)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeLine(line.tempId)}
                        disabled={lines.length <= 1}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Totals */}
            <Separator className="my-4" />
            <div className="flex justify-end">
              <div className="w-72 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Netto</span>
                  <span>{fmt(totals.subtotal)}</span>
                </div>
                {Object.entries(totals.vatGroups).map(([rate, { vat }]) => (
                  <div key={rate} className="flex justify-between">
                    <span className="text-muted-foreground">MwSt {rate} %</span>
                    <span>{fmt(vat)}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Gesamt</span>
                  <span>{fmt(totals.total)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Zusatzinformationen</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Anmerkungen</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="z. B. Leistungszeitraum, Projektbezug…"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Fußzeile</Label>
              <Textarea
                value={footerText}
                onChange={e => setFooterText(e.target.value)}
                placeholder="z. B. Bankverbindung, Hinweise…"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate('/invoices')}>Abbrechen</Button>
          <Button
            variant="secondary"
            disabled={!customerId || saving || lines.every(l => !l.description)}
            onClick={() => handleSave(true)}
          >
            <Save className="h-4 w-4 mr-2" />
            Als Entwurf speichern
          </Button>
          <Button
            disabled={!customerId || saving || lines.every(l => !l.description)}
            onClick={() => handleSave(false)}
          >
            <Save className="h-4 w-4 mr-2" />
            Speichern & Versenden
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default InvoiceEditor;
