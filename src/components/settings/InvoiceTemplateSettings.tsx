import { useState, useEffect } from 'react';
import { Save, FileText, Building2, Layout, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInvoiceSettings } from '@/hooks/useInvoiceSettings';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { InvoiceLayoutPreview } from './InvoiceLayoutPreview';
import { Loader2 } from 'lucide-react';

const LAYOUT_VARIANTS = [
  { value: 'classic', label: 'Klassisch', description: 'Logo links, Empfänger rechts, Standard-Layout' },
  { value: 'modern', label: 'Modern', description: 'Logo zentriert, farbige Akzente' },
  { value: 'minimal', label: 'Minimal', description: 'Kein Logo-Header, sehr schlicht' },
  { value: 'compact', label: 'Kompakt', description: 'Kompakte Tabelle, mehr auf eine Seite' },
];

export function InvoiceTemplateSettings() {
  const { settings, loading, saveSettings } = useInvoiceSettings();
  const { settings: companySettings, getLogoUrl } = useCompanySettings();
    invoice_number_prefix: 'RE',
    invoice_number_format: '{prefix}-{year}-{seq}',
    next_sequence_number: 1,
    default_payment_terms_days: 14,
    default_footer_text: '',
    default_notes: '',
    default_discount_percent: 0,
    default_discount_days: 0,
    layout_variant: 'classic',
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
        default_discount_percent: (settings as any).default_discount_percent || 0,
        default_discount_days: (settings as any).default_discount_days || 0,
        layout_variant: (settings as any).layout_variant || 'classic',
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    await saveSettings(form as any);
    setSaving(false);
  };

  const previewInvoiceNumber = form.invoice_number_format
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
              <CardDescription>Nummernformat, Skonto, Layout, Fußzeile</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invoice Number Format */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Rechnungsnummer</h3>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Präfix</Label><Input value={form.invoice_number_prefix} onChange={e => setForm(f => ({ ...f, invoice_number_prefix: e.target.value }))} /></div>
              <div><Label>Format</Label><Input value={form.invoice_number_format} onChange={e => setForm(f => ({ ...f, invoice_number_format: e.target.value }))} /></div>
              <div><Label>Nächste Nr.</Label><Input type="number" value={form.next_sequence_number} onChange={e => setForm(f => ({ ...f, next_sequence_number: parseInt(e.target.value) || 1 }))} /></div>
            </div>
            <p className="text-xs text-muted-foreground">Vorschau: <span className="font-mono font-medium text-foreground">{previewInvoiceNumber}</span></p>
            <p className="text-xs text-muted-foreground">Platzhalter: {'{prefix}'}, {'{year}'}, {'{seq}'}</p>
          </div>




          {/* Payment Terms + Discount */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2"><Percent className="h-4 w-4" /> Zahlungsbedingungen & Skonto</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Zahlungsziel (Tage)</Label>
                <Input type="number" value={form.default_payment_terms_days} onChange={e => setForm(f => ({ ...f, default_payment_terms_days: parseInt(e.target.value) || 14 }))} />
              </div>
              <div>
                <Label>Skonto %</Label>
                <Input type="number" step="0.5" min="0" value={form.default_discount_percent} onChange={e => setForm(f => ({ ...f, default_discount_percent: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Skonto-Frist (Tage)</Label>
                <Input type="number" min="0" value={form.default_discount_days} onChange={e => setForm(f => ({ ...f, default_discount_days: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            {form.default_discount_percent > 0 && (
              <p className="text-xs text-muted-foreground">
                Hinweis: Bei Zahlung innerhalb von {form.default_discount_days} Tagen gewähren Sie {form.default_discount_percent}% Skonto.
              </p>
            )}
          </div>

          <Separator />

          {/* Layout Variant */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2"><Layout className="h-4 w-4" /> Layout-Variante</h3>
            <Select value={form.layout_variant} onValueChange={v => setForm(f => ({ ...f, layout_variant: v }))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LAYOUT_VARIANTS.map(lv => (
                  <SelectItem key={lv.value} value={lv.value}>
                    <div>
                      <span className="font-medium">{lv.label}</span>
                      <span className="text-muted-foreground ml-2 text-xs">– {lv.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="mt-4">
              <InvoiceLayoutPreview
                layoutVariant={form.layout_variant}
                companySettings={companySettings}
                invoiceNumber={previewInvoiceNumber}
                footerText={form.default_footer_text}
                logoUrl={getLogoUrl(companySettings?.logo_path ?? null)}
              />
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
