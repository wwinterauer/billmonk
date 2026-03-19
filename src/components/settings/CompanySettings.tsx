import { useState, useEffect, useRef } from 'react';
import { Save, Upload, Building2, Landmark, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const SMALL_BIZ_DEFAULTS: Record<string, string> = {
  AT: 'Umsatzsteuerbefreit – Kleinunternehmer gem. § 6 Abs. 1 Z 27 UStG',
  DE: 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.',
  CH: 'Von der Mehrwertsteuer befreit.',
};

export function CompanySettings() {
  const { settings, loading, saveSettings, uploadLogo } = useCompanySettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    company_name: '',
    street: '',
    zip: '',
    city: '',
    country: 'AT',
    uid_number: '',
    company_register_court: '',
    company_register_number: '',
    phone: '',
    email: '',
    logo_path: '' as string | null,
    bank_name: '',
    iban: '',
    bic: '',
    account_holder: '',
    is_small_business: false,
    small_business_text: SMALL_BIZ_DEFAULTS['AT'],
  });

  useEffect(() => {
    if (settings) {
      setForm({
        company_name: settings.company_name || '',
        street: settings.street || '',
        zip: settings.zip || '',
        city: settings.city || '',
        country: settings.country || 'AT',
        uid_number: settings.uid_number || '',
        company_register_court: settings.company_register_court || '',
        company_register_number: settings.company_register_number || '',
        phone: settings.phone || '',
        email: settings.email || '',
        logo_path: settings.logo_path,
        bank_name: settings.bank_name || '',
        iban: settings.iban || '',
        bic: settings.bic || '',
        account_holder: settings.account_holder || '',
        is_small_business: settings.is_small_business || false,
        small_business_text: settings.small_business_text || SMALL_BIZ_DEFAULTS['AT'],
      });
      if (settings.logo_path) {
        const { data } = supabase.storage.from('company-logos').getPublicUrl(settings.logo_path);
        setLogoPreview(data?.publicUrl || null);
      }
    }
  }, [settings]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = await uploadLogo(file);
    if (path) {
      setForm(f => ({ ...f, logo_path: path }));
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveLogo = () => {
    setForm(f => ({ ...f, logo_path: null }));
    setLogoPreview(null);
  };

  const handleCountryChange = (country: string) => {
    setForm(f => ({
      ...f,
      country,
      small_business_text: f.small_business_text === SMALL_BIZ_DEFAULTS[f.country]
        ? (SMALL_BIZ_DEFAULTS[country] || f.small_business_text)
        : f.small_business_text,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    await saveSettings(form as any);
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Firmendaten</CardTitle>
              <CardDescription>Deine Firmenangaben für Rechnungen und Angebote</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Firmenlogo</h3>
            <div className="flex items-center gap-4">
              {logoPreview ? (
                <div className="relative">
                  <img src={logoPreview} alt="Logo" className="h-16 w-auto max-w-[200px] object-contain rounded border bg-background p-1" />
                  <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6" onClick={handleRemoveLogo}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="h-16 w-32 rounded border-2 border-dashed border-muted-foreground/25 flex items-center justify-center text-muted-foreground text-xs">
                  Kein Logo
                </div>
              )}
              <div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-1" /> Logo hochladen
                </Button>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG oder SVG, max. 2 MB</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Company Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Firmendaten</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Firmenname</Label><Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} /></div>
              <div className="col-span-2"><Label>Straße</Label><Input value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} /></div>
              <div><Label>PLZ</Label><Input value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} /></div>
              <div><Label>Stadt</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
              <div>
                <Label>Land</Label>
                <Select value={form.country} onValueChange={handleCountryChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AT">Österreich</SelectItem>
                    <SelectItem value="DE">Deutschland</SelectItem>
                    <SelectItem value="CH">Schweiz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>UID-Nummer</Label><Input value={form.uid_number} onChange={e => setForm(f => ({ ...f, uid_number: e.target.value }))} placeholder="ATU12345678" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Firmenbuchgericht</Label><Input value={form.company_register_court} onChange={e => setForm(f => ({ ...f, company_register_court: e.target.value }))} placeholder="z.B. Landesgericht Wien" /></div>
              <div><Label>Firmenbuchnummer</Label><Input value={form.company_register_number} onChange={e => setForm(f => ({ ...f, company_register_number: e.target.value }))} placeholder="z.B. FN 123456a" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Telefon</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div><Label>E-Mail</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            </div>
          </div>

          <Separator />

          {/* Bank Details */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2"><Landmark className="h-4 w-4" /> Bankverbindung</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Kontoinhaber</Label><Input value={form.account_holder} onChange={e => setForm(f => ({ ...f, account_holder: e.target.value }))} /></div>
              <div><Label>Bank</Label><Input value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} /></div>
              <div><Label>IBAN</Label><Input value={form.iban} onChange={e => setForm(f => ({ ...f, iban: e.target.value }))} placeholder="AT12 3456 7890 1234 5678" /></div>
              <div><Label>BIC</Label><Input value={form.bic} onChange={e => setForm(f => ({ ...f, bic: e.target.value }))} /></div>
            </div>
          </div>

          <Separator />

          {/* Small Business */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Kleinunternehmerregelung</h3>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label>Kleinunternehmer</Label>
                <p className="text-xs text-muted-foreground">
                  Rechnungen werden ohne MwSt. ausgestellt. Der Pflichthinweis wird automatisch eingefügt.
                </p>
              </div>
              <Switch
                checked={form.is_small_business}
                onCheckedChange={v => setForm(f => ({ ...f, is_small_business: v }))}
              />
            </div>
            {form.is_small_business && (
              <div>
                <Label>Pflichttext auf Rechnung</Label>
                <Textarea
                  value={form.small_business_text}
                  onChange={e => setForm(f => ({ ...f, small_business_text: e.target.value }))}
                  rows={2}
                  placeholder="Pflichthinweis Kleinunternehmerregelung"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Dieser Text wird auf jeder Rechnung automatisch angezeigt.
                </p>
              </div>
            )}
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
