import { useState, useEffect } from 'react';
import { Save, FileText, Layout, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuoteSettings } from '@/hooks/useQuoteSettings';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { InvoiceLayoutPreview } from './InvoiceLayoutPreview';
import { Loader2 } from 'lucide-react';

const LAYOUT_VARIANTS = [
  { value: 'classic', label: 'Klassisch', description: 'Logo links, Empfänger rechts, Standard-Layout' },
  { value: 'modern', label: 'Modern', description: 'Logo zentriert, farbige Akzente' },
  { value: 'minimal', label: 'Minimal', description: 'Kein Logo-Header, sehr schlicht' },
  { value: 'compact', label: 'Kompakt', description: 'Kompakte Tabelle, mehr auf eine Seite' },
];

export function QuoteTemplateSettings() {
  const { settings, loading, saveSettings } = useQuoteSettings();
  const { settings: companySettings, getLogoUrl } = useCompanySettings();
  const [form, setForm] = useState({
    quote_number_prefix: 'AG',
    quote_number_format: '{prefix}-{year}-{seq}',
    next_sequence_number: 1,
    default_validity_days: 30,
    default_footer_text: '',
    default_notes: '',
    layout_variant: 'classic',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        quote_number_prefix: settings.quote_number_prefix || 'AG',
        quote_number_format: settings.quote_number_format || '{prefix}-{year}-{seq}',
        next_sequence_number: settings.next_sequence_number || 1,
        default_validity_days: settings.default_validity_days || 30,
        default_footer_text: settings.default_footer_text || '',
        default_notes: settings.default_notes || '',
        layout_variant: settings.layout_variant || 'classic',
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    await saveSettings(form as any);
    setSaving(false);
  };

  const previewQuoteNumber = form.quote_number_format
    .replace('{prefix}', form.quote_number_prefix)
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
              <CardTitle>Angebotsvorlage</CardTitle>
              <CardDescription>Nummernformat, Gültigkeit, Layout, Fußzeile</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Quote Number Format */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Angebotsnummer</h3>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Präfix</Label><Input value={form.quote_number_prefix} onChange={e => setForm(f => ({ ...f, quote_number_prefix: e.target.value }))} /></div>
              <div><Label>Format</Label><Input value={form.quote_number_format} onChange={e => setForm(f => ({ ...f, quote_number_format: e.target.value }))} /></div>
              <div><Label>Nächste Nr.</Label><Input type="number" value={form.next_sequence_number} onChange={e => setForm(f => ({ ...f, next_sequence_number: parseInt(e.target.value) || 1 }))} /></div>
            </div>
            <p className="text-xs text-muted-foreground">Vorschau: <span className="font-mono font-medium text-foreground">{previewQuoteNumber}</span></p>
            <p className="text-xs text-muted-foreground">Platzhalter: {'{prefix}'}, {'{year}'}, {'{seq}'}</p>
          </div>

          {/* Validity */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2"><Calendar className="h-4 w-4" /> Gültigkeit</h3>
            <div className="max-w-xs">
              <Label>Gültigkeitsdauer (Tage)</Label>
              <Input type="number" min="1" value={form.default_validity_days} onChange={e => setForm(f => ({ ...f, default_validity_days: parseInt(e.target.value) || 30 }))} />
            </div>
            <p className="text-xs text-muted-foreground">
              Angebote sind standardmäßig {form.default_validity_days} Tage gültig ab Ausstellungsdatum.
            </p>
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
                invoiceNumber={previewQuoteNumber}
                footerText={form.default_footer_text}
                logoUrl={getLogoUrl(companySettings?.logo_path ?? null)}
                documentTitle="Angebot"
              />
            </div>
          </div>

          <Separator />

          {/* Footer & Notes */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Texte</h3>
            <div><Label>Standard-Fußzeile</Label><Textarea value={form.default_footer_text} onChange={e => setForm(f => ({ ...f, default_footer_text: e.target.value }))} rows={2} placeholder="z.B. Wir freuen uns auf Ihre Auftragserteilung!" /></div>
            <div><Label>Standard-Notizen</Label><Textarea value={form.default_notes} onChange={e => setForm(f => ({ ...f, default_notes: e.target.value }))} rows={2} placeholder="z.B. Preise verstehen sich exkl. MwSt." /></div>
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
