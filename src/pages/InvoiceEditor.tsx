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
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, Plus, Trash2, Save, FolderPlus } from 'lucide-react';
import { useCustomers } from '@/hooks/useCustomers';
import { useInvoiceItems, type InvoiceItem } from '@/hooks/useInvoiceItems';
import { useInvoiceSettings } from '@/hooks/useInvoiceSettings';
import { useInvoices } from '@/hooks/useInvoices';
import { useCategories } from '@/hooks/useCategories';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useTags } from '@/hooks/useTags';
import { useInvoiceTags } from '@/hooks/useInvoiceTags';
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
  group_name: string | null;
  is_group_header: boolean;
  show_group_subtotal: boolean;
}

const newLine = (vatRate = 20): EditorLineItem => ({
  tempId: crypto.randomUUID(),
  invoice_item_id: null,
  description: '',
  quantity: 1,
  unit: 'Stk',
  unit_price: 0,
  vat_rate: vatRate,
  group_name: null,
  is_group_header: false,
  show_group_subtotal: false,
});

const newGroupHeader = (name: string): EditorLineItem => ({
  tempId: crypto.randomUUID(),
  invoice_item_id: null,
  description: name,
  quantity: 0,
  unit: '',
  unit_price: 0,
  vat_rate: 0,
  group_name: name,
  is_group_header: true,
  show_group_subtotal: true,
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
  const { settings: companySettings } = useCompanySettings();

  const isSmallBusiness = companySettings?.is_small_business || false;
  const defaultVatRate = isSmallBusiness ? 0 : 20;

  const [customerId, setCustomerId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [footerText, setFooterText] = useState('');
  const [lines, setLines] = useState<EditorLineItem[]>([newLine(defaultVatRate)]);
  const [saving, setSaving] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [category, setCategory] = useState('');
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(id && id !== 'new' ? id : null);

  // Shipping address
  const [shippingMode, setShippingMode] = useState<'same' | 'customer' | 'custom'>('same');
  const [customShipping, setCustomShipping] = useState({ street: '', zip: '', city: '', country: 'AT' });

  // Skonto
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountDays, setDiscountDays] = useState(0);

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

      if (settings.default_discount_percent) setDiscountPercent(settings.default_discount_percent);
      if (settings.default_discount_days) setDiscountDays(settings.default_discount_days);
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
          setShippingMode(inv.shipping_address_mode || 'same');
          setDiscountPercent(inv.discount_percent || 0);
          setDiscountDays(inv.discount_days || 0);
          if (inv.shipping_address_mode === 'custom') {
            setCustomShipping({
              street: inv.shipping_street || '',
              zip: inv.shipping_zip || '',
              city: inv.shipping_city || '',
              country: inv.shipping_country || 'AT',
            });
          }
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
            vat_rate: li.vat_rate ?? defaultVatRate,
            group_name: li.group_name || null,
            is_group_header: li.is_group_header || false,
            show_group_subtotal: li.show_group_subtotal || false,
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
      vat_rate: isSmallBusiness ? 0 : (template.vat_rate ?? 20),
      group_name: null,
      is_group_header: false,
      show_group_subtotal: false,
    }]);
  };

  const removeLine = (tempId: string) => {
    setLines(prev => prev.length <= 1 ? prev : prev.filter(l => l.tempId !== tempId));
  };

  const addGroup = () => {
    const groupName = `Gruppe ${lines.filter(l => l.is_group_header).length + 1}`;
    setLines(prev => [...prev, newGroupHeader(groupName)]);
  };

  // Determine current group for each line
  const getGroupForLine = (index: number): string | null => {
    for (let i = index - 1; i >= 0; i--) {
      if (lines[i].is_group_header) return lines[i].group_name;
    }
    return null;
  };

  const selectedCustomer = customers.find(c => c.id === customerId);

  const totals = useMemo(() => {
    let subtotal = 0;
    let vatTotal = 0;
    const vatGroups: Record<number, { net: number; vat: number }> = {};
    const groupTotals: Record<string, number> = {};

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.is_group_header) continue;
      const net = l.quantity * l.unit_price;
      const vat = net * (l.vat_rate / 100);
      subtotal += net;
      vatTotal += vat;
      if (!vatGroups[l.vat_rate]) vatGroups[l.vat_rate] = { net: 0, vat: 0 };
      vatGroups[l.vat_rate].net += net;
      vatGroups[l.vat_rate].vat += vat;

      const group = getGroupForLine(i);
      if (group) {
        groupTotals[group] = (groupTotals[group] || 0) + net;
      }
    }

    const total = subtotal + vatTotal;
    const discountAmount = discountPercent > 0 ? total * (discountPercent / 100) : 0;

    return { subtotal, vatTotal, total, vatGroups, groupTotals, discountAmount };
  }, [lines, discountPercent]);

  const fmt = (n: number) =>
    new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(n);

  // Resolve shipping address for save
  const resolveShippingFields = () => {
    if (shippingMode === 'same') return {};
    if (shippingMode === 'customer' && selectedCustomer?.has_different_shipping_address) {
      return {
        shipping_address_mode: 'customer',
        shipping_street: selectedCustomer.shipping_street,
        shipping_zip: selectedCustomer.shipping_zip,
        shipping_city: selectedCustomer.shipping_city,
        shipping_country: selectedCustomer.shipping_country,
      };
    }
    if (shippingMode === 'custom') {
      return {
        shipping_address_mode: 'custom',
        shipping_street: customShipping.street,
        shipping_zip: customShipping.zip,
        shipping_city: customShipping.city,
        shipping_country: customShipping.country,
      };
    }
    return { shipping_address_mode: 'same' };
  };

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
        discount_percent: discountPercent || undefined,
        discount_days: discountDays || undefined,
        ...resolveShippingFields(),
      },
      lines.map(l => ({
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unit_price: l.unit_price,
        vat_rate: l.vat_rate,
        invoice_item_id: l.invoice_item_id || undefined,
        group_name: l.group_name || undefined,
        is_group_header: l.is_group_header,
        show_group_subtotal: l.show_group_subtotal,
      }))
    );

    setSaving(false);
    if (result) {
      setSavedInvoiceId(result.id);
      navigate('/invoices');
    }
  };

  // Track current group for subtotal rendering
  let currentGroup: string | null = null;

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
          {isSmallBusiness && (
            <Badge variant="secondary" className="ml-auto">Kleinunternehmer</Badge>
          )}
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
              <Select value={category || '__none__'} onValueChange={(v) => setCategory(v === '__none__' ? '' : v)}>
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

        {/* Shipping Address */}
        {customerId && (
          <Card>
            <CardHeader>
              <CardTitle>Lieferanschrift</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={shippingMode} onValueChange={(v) => setShippingMode(v as any)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="same" id="ship-same" />
                  <Label htmlFor="ship-same">Lieferanschrift = Rechnungsanschrift</Label>
                </div>
                {selectedCustomer?.has_different_shipping_address && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="customer" id="ship-customer" />
                    <Label htmlFor="ship-customer">
                      Lieferanschrift aus Kundendaten
                      <span className="text-xs text-muted-foreground ml-2">
                        ({selectedCustomer.shipping_street}, {selectedCustomer.shipping_zip} {selectedCustomer.shipping_city})
                      </span>
                    </Label>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custom" id="ship-custom" />
                  <Label htmlFor="ship-custom">Abweichende Lieferanschrift (Freitext)</Label>
                </div>
              </RadioGroup>

              {shippingMode === 'custom' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <div className="md:col-span-3">
                    <Label>Straße</Label>
                    <Input value={customShipping.street} onChange={e => setCustomShipping(s => ({ ...s, street: e.target.value }))} />
                  </div>
                  <div><Label>PLZ</Label><Input value={customShipping.zip} onChange={e => setCustomShipping(s => ({ ...s, zip: e.target.value }))} /></div>
                  <div><Label>Stadt</Label><Input value={customShipping.city} onChange={e => setCustomShipping(s => ({ ...s, city: e.target.value }))} /></div>
                  <div><Label>Land</Label><Input value={customShipping.country} onChange={e => setCustomShipping(s => ({ ...s, country: e.target.value }))} /></div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
              <Button variant="outline" size="sm" onClick={addGroup}>
                <FolderPlus className="h-4 w-4 mr-1" /> Gruppe
              </Button>
              <Button variant="outline" size="sm" onClick={() => setLines(prev => [...prev, newLine(defaultVatRate)])}>
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
                  {!isSmallBusiness && <TableHead className="w-24">MwSt %</TableHead>}
                  <TableHead className="w-28 text-right">Netto</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, idx) => {
                  // Track group transitions for subtotals
                  if (line.is_group_header) {
                    // Before rendering a new group header, show subtotal of previous group
                    currentGroup = line.group_name;
                  }
                  const lineGroup = line.is_group_header ? null : getGroupForLine(idx);

                  // Check if next line starts a new group or is end => show subtotal
                  const nextLine = lines[idx + 1];
                  const isLastInGroup = lineGroup && !line.is_group_header && (
                    !nextLine || nextLine.is_group_header || getGroupForLine(idx + 1) !== lineGroup
                  );
                  const showSubtotal = isLastInGroup && lines.find(l => l.is_group_header && l.group_name === lineGroup)?.show_group_subtotal;

                  if (line.is_group_header) {
                    return (
                      <>
                        <TableRow key={line.tempId} className="bg-muted/50">
                          <TableCell colSpan={isSmallBusiness ? 5 : 6}>
                            <Input
                              value={line.description}
                              onChange={e => {
                                const newName = e.target.value;
                                setLines(prev => prev.map(l => {
                                  if (l.tempId === line.tempId) return { ...l, description: newName, group_name: newName };
                                  // Update group_name for child items (not needed, tracked by position)
                                  return l;
                                }));
                              }}
                              className="font-semibold bg-transparent border-none shadow-none"
                              placeholder="Gruppenname…"
                            />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLine(line.tempId)}>
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      </>
                    );
                  }

                  return (
                    <>
                      <TableRow key={line.tempId} className={lineGroup ? 'border-l-2 border-l-primary/20' : ''}>
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
                        {!isSmallBusiness && (
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
                        )}
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
                      {showSubtotal && (
                        <TableRow key={`subtotal-${line.tempId}`} className="border-l-2 border-l-primary/20 bg-muted/30">
                          <TableCell colSpan={isSmallBusiness ? 4 : 5} className="text-right text-sm italic text-muted-foreground">
                            Zwischensumme {lineGroup}
                          </TableCell>
                          <TableCell className="text-right font-medium text-sm italic">
                            {fmt(totals.groupTotals[lineGroup!] || 0)}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>

            {/* Totals */}
            <Separator className="my-4" />
            <div className="flex justify-end">
              <div className="w-80 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Netto</span>
                  <span>{fmt(totals.subtotal)}</span>
                </div>
                {!isSmallBusiness && Object.entries(totals.vatGroups).map(([rate, { vat }]) => (
                  <div key={rate} className="flex justify-between">
                    <span className="text-muted-foreground">MwSt {rate} %</span>
                    <span>{fmt(vat)}</span>
                  </div>
                ))}
                {isSmallBusiness && (
                  <div className="text-xs text-muted-foreground italic">
                    {companySettings?.small_business_text || 'Umsatzsteuerbefreit – Kleinunternehmer gem. § 6 Abs. 1 Z 27 UStG'}
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Gesamt</span>
                  <span>{fmt(isSmallBusiness ? totals.subtotal : totals.total)}</span>
                </div>
                {discountPercent > 0 && (
                  <div className="flex justify-between text-muted-foreground text-xs pt-1">
                    <span>Skonto ({discountPercent}% bei Zahlung innerhalb von {discountDays} Tagen)</span>
                    <span>−{fmt(totals.discountAmount)}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Skonto + Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Zusatzinformationen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Skonto %</Label>
                <Input type="number" min={0} max={100} step="0.5" value={discountPercent} onChange={e => setDiscountPercent(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label>Skonto-Tage</Label>
                <Input type="number" min={0} value={discountDays} onChange={e => setDiscountDays(parseInt(e.target.value) || 0)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  placeholder="z. B. Hinweise…"
                  rows={3}
                />
              </div>
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
