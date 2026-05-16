import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { CalendarIcon, Loader2, PenLine } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useCategories } from '@/hooks/useCategories';
import { useVatRates } from '@/hooks/useVatRates';
import { useTags } from '@/hooks/useTags';
import { VendorAutocomplete } from '@/components/receipts/VendorAutocomplete';
import { PAYMENT_METHODS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface ManualExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const CURRENCIES = ['EUR', 'CHF', 'USD', 'GBP'];

export function ManualExpenseDialog({ open, onOpenChange, onCreated }: ManualExpenseDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { userCategories, taxCategories } = useCategories();
  const { vatRateGroups, defaultVatRate } = useVatRates();
  const { activeTags } = useTags();

  const [saving, setSaving] = useState(false);
  const [keepOpen, setKeepOpen] = useState(false);

  // Form state
  const [receiptDate, setReceiptDate] = useState<Date>(new Date());
  const [vendor, setVendor] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [amountGross, setAmountGross] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [vatRate, setVatRate] = useState<string>(defaultVatRate);
  const [amountNet, setAmountNet] = useState('');
  const [vatAmount, setVatAmount] = useState('');
  const [category, setCategory] = useState('');
  const [taxType, setTaxType] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bar');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Sync default VAT once loaded
  useEffect(() => {
    if (open && defaultVatRate && !vatRate) {
      setVatRate(defaultVatRate);
    }
  }, [open, defaultVatRate]);

  // Auto-calc net/VAT from gross + rate (skip for 0 and mixed)
  useEffect(() => {
    const gross = parseFloat(amountGross.replace(',', '.'));
    if (!isFinite(gross) || gross <= 0) {
      setAmountNet('');
      setVatAmount('');
      return;
    }
    if (vatRate === 'mixed' || vatRate === '0') {
      setAmountNet(gross.toFixed(2));
      setVatAmount('0.00');
      return;
    }
    const rate = parseFloat(vatRate);
    if (!isFinite(rate) || rate <= 0) {
      setAmountNet(gross.toFixed(2));
      setVatAmount('0.00');
      return;
    }
    const net = gross / (1 + rate / 100);
    setAmountNet(net.toFixed(2));
    setVatAmount((gross - net).toFixed(2));
  }, [amountGross, vatRate]);

  const resetForm = () => {
    setReceiptDate(new Date());
    setVendor('');
    setSelectedVendorId(null);
    setDescription('');
    setAmountGross('');
    setCurrency('EUR');
    setVatRate(defaultVatRate);
    setAmountNet('');
    setVatAmount('');
    setCategory('');
    setTaxType('');
    setPaymentMethod('Bar');
    setInvoiceNumber('');
    setNotes('');
  };

  const handleVendorSelect = (v: {
    id: string;
    display_name: string;
    default_category: { name: string } | null;
    default_vat_rate: number | null;
    field_defaults: Record<string, string> | null;
  }) => {
    setSelectedVendorId(v.id);
    setVendor(v.display_name);
    if (v.default_category?.name && !category) {
      setCategory(v.default_category.name);
    }
    if (v.default_vat_rate != null && !amountGross) {
      setVatRate(String(v.default_vat_rate));
    }
    const fd = v.field_defaults || {};
    if (fd.tax_type && !taxType) setTaxType(fd.tax_type);
    if (fd.payment_method && paymentMethod === 'Bar') setPaymentMethod(fd.payment_method);
    if (fd.description && !description) setDescription(fd.description);
  };

  const handleSave = async () => {
    if (!user) return;

    // Validation
    const gross = parseFloat(amountGross.replace(',', '.'));
    if (!vendor.trim()) {
      toast({ variant: 'destructive', title: 'Lieferant fehlt' });
      return;
    }
    if (!description.trim()) {
      toast({ variant: 'destructive', title: 'Beschreibung fehlt' });
      return;
    }
    if (!isFinite(gross) || gross <= 0) {
      toast({ variant: 'destructive', title: 'Bitte gültigen Betrag eingeben' });
      return;
    }

    setSaving(true);
    try {
      const net = parseFloat(amountNet.replace(',', '.'));
      const vat = parseFloat(vatAmount.replace(',', '.'));
      const numericVatRate =
        vatRate === 'mixed' || vatRate === '0' || !isFinite(parseFloat(vatRate))
          ? vatRate === 'mixed' ? null : 0
          : parseFloat(vatRate);

      const { error } = await supabase.from('receipts').insert({
        user_id: user.id,
        file_url: null,
        file_name: null,
        file_type: null,
        status: 'approved',
        source: 'manual',
        is_no_receipt_entry: true,
        vendor: vendor.trim(),
        vendor_id: selectedVendorId,
        description: description.trim(),
        amount_gross: gross,
        amount_net: isFinite(net) ? net : null,
        vat_amount: isFinite(vat) ? vat : null,
        vat_rate: numericVatRate,
        currency,
        receipt_date: format(receiptDate, 'yyyy-MM-dd'),
        category: category || null,
        tax_type: taxType || null,
        payment_method: paymentMethod || null,
        invoice_number: invoiceNumber.trim() || null,
        notes: notes.trim() || null,
        ai_confidence: null,
        auto_approved: false,
      });

      if (error) throw error;

      toast({ title: 'Ausgabe erfasst', description: `${vendor} – ${gross.toFixed(2)} ${currency}` });
      onCreated();

      if (keepOpen) {
        resetForm();
      } else {
        onOpenChange(false);
        resetForm();
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Fehler beim Speichern',
        description: err instanceof Error ? err.message : 'Unbekannter Fehler',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5" />
            Ausgabe manuell erfassen
          </DialogTitle>
          <DialogDescription>
            Für Barausgaben, Pauschalen oder Belege ohne Datei. Der Eintrag wird als „Kein Beleg" markiert.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Date + Vendor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Datum *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !receiptDate && 'text-muted-foreground',
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {receiptDate ? format(receiptDate, 'dd.MM.yyyy', { locale: de }) : 'Datum wählen'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={receiptDate}
                    onSelect={(d) => d && setReceiptDate(d)}
                    initialFocus
                    locale={de}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <VendorAutocomplete
                value={vendor}
                vendorId={selectedVendorId}
                onChange={(value, id) => {
                  setVendor(value);
                  setSelectedVendorId(id || null);
                }}
                onVendorSelect={handleVendorSelect}
                disabled={saving}
                label="Lieferant *"
                placeholder="z.B. Bäckerei Müller"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Beschreibung *</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="z.B. Geschäftsessen Kunde XY"
              disabled={saving}
            />
          </div>

          {/* Amount + Currency + VAT */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Bruttobetrag *</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={amountGross}
                onChange={(e) => setAmountGross(e.target.value)}
                placeholder="0,00"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Währung</Label>
              <Select value={currency} onValueChange={setCurrency} disabled={saving}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>MwSt.-Satz</Label>
              <Select value={vatRate} onValueChange={setVatRate} disabled={saving}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {vatRateGroups.map((g) => (
                    <SelectGroup key={g.label}>
                      <SelectLabel>{g.label}</SelectLabel>
                      {g.rates.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Net + VAT amount (editable) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Netto</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={amountNet}
                onChange={(e) => setAmountNet(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">MwSt.-Betrag</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={vatAmount}
                onChange={(e) => setVatAmount(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          {/* Category + Tax type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Kategorie</Label>
              <SearchableSelect
                value={category}
                onChange={setCategory}
                options={userCategories.map((c) => ({ value: c.name, label: c.name }))}
                placeholder="Kategorie wählen…"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Buchungsart (Steuer)</Label>
              <SearchableSelect
                value={taxType}
                onChange={setTaxType}
                options={taxCategories.map((c) => ({ value: c.name, label: c.name }))}
                placeholder="Buchungsart wählen…"
                disabled={saving}
              />
            </div>
          </div>

          {/* Payment method + Invoice number */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Zahlungsmethode</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={saving}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rechnungsnr. (optional)</Label>
              <Input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="z.B. RE-2026-001"
                disabled={saving}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notizen (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Interne Notizen…"
              rows={2}
              disabled={saving}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <Checkbox
              checked={keepOpen}
              onCheckedChange={(c) => setKeepOpen(c === true)}
              disabled={saving}
            />
            Weitere Ausgabe erfassen
          </label>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gradient-primary">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ausgabe speichern
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
