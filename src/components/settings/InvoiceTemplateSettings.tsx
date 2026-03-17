import { useState, useEffect } from 'react';
import { Save, FileText, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useInvoiceSettings } from '@/hooks/useInvoiceSettings';
import { Loader2 } from 'lucide-react';

export function InvoiceTemplateSettings() {
  const { settings, loading, saveSettings } = useInvoiceSettings();
  const [form, setForm] = useState({
    invoice_number_prefix: 'RE',
    invoice_number_format: '{prefix}-{year}-{seq}',
    next_sequence_number: 1,
    default_payment_terms_days: 14,
    default_footer_text: '',
    default_notes: '',
    bank_name: '',
    iban: '',
    bic: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        invoice_number_prefix: settings.invoice_number_prefix || 'RE',
        invoice_number_format: settings.invoice_number_format || '{prefix}-{year}-{seq}',
        next_sequence_number: settings.next_sequence_number || 1,
        default_payment_terms_days: settings.default_payment_terms_days || 14,
        default_footer_text: settings.default_footer_text || '',
        default_notes: settings.default_notes || '',
        bank_name: settings.bank_name || '',
        iban: settings.iban || '',
        bic: settings.bic || '',
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    await saveSettings(form as any);
    setSaving(false);
  };

  const previewNumber = form.invoice_number_format
    .replace('{prefix}', form.invoice_number_prefix)
    .replace('{year}', new Date().getFullYear().toString())
    .replace('{seq}', String(form.next_sequence_number).padStart(4, '0'));

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Rechnungsvorlage</CardTitle>
              <CardDescription>Nummernformat, Bankdaten, Fußzeile</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Number Format */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Rechnungsnummer</h3>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Präfix</Label><Input value={form.invoice_number_prefix} onChange={e => setForm(f => ({ ...f, invoice_number_prefix: e.target.value }))} /></div>
              <div><Label>Format</Label><Input value={form.invoice_number_format} onChange={e => setForm(f => ({ ...f, invoice_number_format: e.target.value }))} /></div>
              <div><Label>Nächste Nr.</Label><Input type="number" value={form.next_sequence_number} onChange={e => setForm(f => ({ ...f, next_sequence_number: parseInt(e.target.value) || 1 }))} /></div>
            </div>
            <p className="text-xs text-muted-foreground">Vorschau: <span className="font-mono font-medium text-foreground">{previewNumber}</span></p>
            <p className="text-xs text-muted-foreground">Platzhalter: {'{prefix}'}, {'{year}'}, {'{seq}'}</p>
          </div>

          <Separator />

          {/* Payment Terms */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Zahlungsbedingungen</h3>
            <div className="max-w-xs">
              <Label>Standard-Zahlungsziel (Tage)</Label>
              <Input type="number" value={form.default_payment_terms_days} onChange={e => setForm(f => ({ ...f, default_payment_terms_days: parseInt(e.target.value) || 14 }))} />
            </div>
          </div>

          <Separator />

          {/* Bank Details */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2"><Building2 className="h-4 w-4" /> Bankdaten</h3>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Bank</Label><Input value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} /></div>
              <div><Label>IBAN</Label><Input value={form.iban} onChange={e => setForm(f => ({ ...f, iban: e.target.value }))} /></div>
              <div><Label>BIC</Label><Input value={form.bic} onChange={e => setForm(f => ({ ...f, bic: e.target.value }))} /></div>
            </div>
          </div>

          <Separator />

          {/* Footer & Notes */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Texte</h3>
            <div><Label>Standard-Fußzeile</Label><Textarea value={form.default_footer_text} onChange={e => setForm(f => ({ ...f, default_footer_text: e.target.value }))} rows={2} placeholder="z.B. Vielen Dank für Ihren Auftrag!" /></div>
            <div><Label>Standard-Notizen</Label><Textarea value={form.default_notes} onChange={e => setForm(f => ({ ...f, default_notes: e.target.value }))} rows={2} placeholder="z.B. Zahlbar innerhalb von 14 Tagen." /></div>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Speichern
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
