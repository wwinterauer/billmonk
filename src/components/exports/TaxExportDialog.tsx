import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfQuarter, endOfQuarter, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import { CalendarIcon, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  type TaxExportFormat,
  type BookingType,
  type TaxExportConfig,
  type ReceiptForExport,
  type InvoiceForExport,
  generateTaxExport,
} from '@/lib/taxExportFormats';

interface TaxExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultBookingType?: BookingType;
}

const STORAGE_KEY = 'tax-export-settings';

export function TaxExportDialog({ open, onOpenChange, defaultBookingType = 'both' }: TaxExportDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Load saved settings
  const savedSettings = (() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      return s ? JSON.parse(s) : {};
    } catch { return {}; }
  })();

  const [exportFormat, setExportFormat] = useState<TaxExportFormat>(savedSettings.format || 'datev');
  const [bookingType, setBookingType] = useState<BookingType>(defaultBookingType);
  const [beraterNr, setBeraterNr] = useState(savedSettings.beraterNr || '');
  const [mandantenNr, setMandantenNr] = useState(savedSettings.mandantenNr || '');
  const [sachkontenLaenge, setSachkontenLaenge] = useState<number>(savedSettings.sachkontenLaenge || 4);
  const [expenseAccount, setExpenseAccount] = useState(savedSettings.expenseAccount || '5000');
  const [incomeAccount, setIncomeAccount] = useState(savedSettings.incomeAccount || '4000');
  const [bankAccount, setBankAccount] = useState(savedSettings.bankAccount || '2800');

  // Date range
  const now = new Date();
  const lastMonth = subMonths(now, 1);
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(lastMonth));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(lastMonth));
  const [datePreset, setDatePreset] = useState('lastMonth');

  // Update booking type when prop changes
  useEffect(() => {
    setBookingType(defaultBookingType);
  }, [defaultBookingType]);

  // Save settings on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      format: exportFormat,
      beraterNr,
      mandantenNr,
      sachkontenLaenge,
      expenseAccount,
      incomeAccount,
      bankAccount,
    }));
  }, [exportFormat, beraterNr, mandantenNr, sachkontenLaenge, expenseAccount, incomeAccount, bankAccount]);

  const handlePreset = (preset: string) => {
    setDatePreset(preset);
    const n = new Date();
    switch (preset) {
      case 'thisMonth':
        setDateFrom(startOfMonth(n));
        setDateTo(endOfMonth(n));
        break;
      case 'lastMonth':
        const lm = subMonths(n, 1);
        setDateFrom(startOfMonth(lm));
        setDateTo(endOfMonth(lm));
        break;
      case 'thisQuarter':
        setDateFrom(startOfQuarter(n));
        setDateTo(endOfQuarter(n));
        break;
      case 'thisYear':
        setDateFrom(startOfYear(n));
        setDateTo(endOfYear(n));
        break;
    }
  };

  const handleExport = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch receipts if needed
      let receipts: ReceiptForExport[] = [];
      if (bookingType === 'expenses' || bookingType === 'both') {
        const { data, error } = await supabase
          .from('receipts')
          .select('receipt_date, amount_gross, amount_net, vat_rate, vat_amount, vendor, vendor_brand, description, invoice_number, category, currency')
          .eq('user_id', user.id)
          .eq('status', 'approved')
          .gte('receipt_date', format(dateFrom, 'yyyy-MM-dd'))
          .lte('receipt_date', format(dateTo, 'yyyy-MM-dd'))
          .neq('category', 'Keine Rechnung');

        if (error) throw error;
        receipts = (data || []) as ReceiptForExport[];
      }

      // Fetch invoices if needed
      let invoices: InvoiceForExport[] = [];
      if (bookingType === 'income' || bookingType === 'both') {
        const { data, error } = await supabase
          .from('invoices')
          .select('invoice_date, total, subtotal, vat_total, invoice_number, currency, customers(display_name)')
          .eq('user_id', user.id)
          .eq('document_type', 'invoice')
          .in('status', ['sent', 'paid'])
          .gte('invoice_date', format(dateFrom, 'yyyy-MM-dd'))
          .lte('invoice_date', format(dateTo, 'yyyy-MM-dd'));

        if (error) throw error;
        invoices = (data || []).map((inv: any) => ({
          invoice_date: inv.invoice_date,
          total: inv.total,
          subtotal: inv.subtotal,
          vat_total: inv.vat_total,
          invoice_number: inv.invoice_number,
          customer_name: inv.customers?.display_name || '',
          currency: inv.currency,
        }));
      }

      if (receipts.length === 0 && invoices.length === 0) {
        toast({
          title: 'Keine Daten',
          description: 'Im gewählten Zeitraum wurden keine Buchungen gefunden.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const config: TaxExportConfig = {
        format: exportFormat,
        bookingType,
        dateFrom,
        dateTo,
        beraterNr: beraterNr || undefined,
        mandantenNr: mandantenNr || undefined,
        sachkontenLaenge,
        defaultExpenseAccount: expenseAccount,
        defaultIncomeAccount: incomeAccount,
        bankAccount,
      };

      generateTaxExport(config, receipts, invoices);

      toast({
        title: 'Export erstellt',
        description: `${exportFormat.toUpperCase()}-Datei mit ${receipts.length + invoices.length} Buchungen wurde heruntergeladen.`,
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Fehler beim Export',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Steuerberater-Export</DialogTitle>
          <DialogDescription>
            Exportiere Buchungsdaten im DATEV- oder BMD-Format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Format */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Format</Label>
              <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as TaxExportFormat)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="datev">DATEV</SelectItem>
                  <SelectItem value="bmd">BMD NTCS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Buchungsart</Label>
              <Select value={bookingType} onValueChange={(v) => setBookingType(v as BookingType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expenses">Nur Ausgaben (ER)</SelectItem>
                  <SelectItem value="income">Nur Einnahmen (AR)</SelectItem>
                  <SelectItem value="both">Beides</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date range */}
          <div className="space-y-1.5">
            <Label>Zeitraum</Label>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 'lastMonth', label: 'Letzter Monat' },
                { value: 'thisMonth', label: 'Dieser Monat' },
                { value: 'thisQuarter', label: 'Quartal' },
                { value: 'thisYear', label: 'Jahr' },
              ].map(p => (
                <Button
                  key={p.value}
                  variant={datePreset === p.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePreset(p.value)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-2 items-center mt-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('justify-start text-left font-normal w-[140px]')}>
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {format(dateFrom, 'dd.MM.yyyy', { locale: de })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateFrom} onSelect={(d) => { if (d) { setDateFrom(d); setDatePreset('custom'); } }} locale={de} /></PopoverContent>
              </Popover>
              <span className="text-muted-foreground text-sm">bis</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('justify-start text-left font-normal w-[140px]')}>
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {format(dateTo, 'dd.MM.yyyy', { locale: de })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateTo} onSelect={(d) => { if (d) { setDateTo(d); setDatePreset('custom'); } }} locale={de} /></PopoverContent>
              </Popover>
            </div>
          </div>

          <Separator />

          {/* DATEV-specific */}
          {exportFormat === 'datev' && (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Berater-Nr.</Label>
                <Input value={beraterNr} onChange={e => setBeraterNr(e.target.value)} placeholder="z.B. 12345" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Mandanten-Nr.</Label>
                <Input value={mandantenNr} onChange={e => setMandantenNr(e.target.value)} placeholder="z.B. 1001" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">SK-Länge</Label>
                <Select value={sachkontenLaenge.toString()} onValueChange={v => setSachkontenLaenge(parseInt(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="6">6</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Account mapping */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Aufwandskonto</Label>
              <Input value={expenseAccount} onChange={e => setExpenseAccount(e.target.value)} placeholder="5000" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Erlöskonto</Label>
              <Input value={incomeAccount} onChange={e => setIncomeAccount(e.target.value)} placeholder="4000" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Bankkonto</Label>
              <Input value={bankAccount} onChange={e => setBankAccount(e.target.value)} placeholder="2800" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleExport} disabled={loading}>
            <Download className="h-4 w-4 mr-2" />
            {loading ? 'Exportiere…' : 'Exportieren'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
