import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowRight, ArrowLeft, Check, User, Building2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { title: 'Persönliche Daten', description: 'Vervollständige dein Profil' },
  { title: 'Kontotyp', description: 'Wie nutzt du BillMonk?' },
  { title: 'Abschluss', description: 'Fast geschafft!' },
];

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    first_name: user?.user_metadata?.first_name || '',
    last_name: user?.user_metadata?.last_name || '',
    street: '',
    zip: '',
    city: '',
    country: 'AT',
    phone: '',
    account_type: 'private',
    company_name: '',
    uid_number: '',
    newsletter_opt_in: false,
    privacy_accepted: false,
  });

  const updateField = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const canProceedStep0 = formData.first_name.trim() && formData.last_name.trim();
  const canProceedStep1 = formData.account_type === 'private' || formData.company_name.trim();
  const canFinish = formData.privacy_accepted;

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          street: formData.street || null,
          zip: formData.zip || null,
          city: formData.city || null,
          country: formData.country,
          phone: formData.phone || null,
          account_type: formData.account_type,
          company_name: formData.account_type !== 'private' ? formData.company_name : null,
          uid_number: formData.account_type !== 'private' ? (formData.uid_number || null) : null,
          newsletter_opt_in: formData.newsletter_opt_in,
          onboarding_completed: true,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({ title: 'Willkommen bei BillMonk!', description: 'Dein Profil wurde eingerichtet.' });
      navigate('/dashboard', { replace: true });
    } catch (_err) {
      toast({ title: 'Fehler', description: 'Profil konnte nicht gespeichert werden.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                i < step ? 'bg-primary text-primary-foreground' :
                i === step ? 'bg-primary text-primary-foreground' :
                'bg-muted text-muted-foreground'
              )}>
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn('w-12 h-0.5', i < step ? 'bg-primary' : 'bg-muted')} />
              )}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{STEPS[step].title}</CardTitle>
            <CardDescription>{STEPS[step].description}</CardDescription>
          </CardHeader>
          <CardContent>
            {step === 0 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">Vorname *</Label>
                    <Input id="first_name" value={formData.first_name} onChange={e => updateField('first_name', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Nachname *</Label>
                    <Input id="last_name" value={formData.last_name} onChange={e => updateField('last_name', e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="street">Straße</Label>
                  <Input id="street" value={formData.street} onChange={e => updateField('street', e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="zip">PLZ</Label>
                    <Input id="zip" value={formData.zip} onChange={e => updateField('zip', e.target.value)} />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="city">Ort</Label>
                    <Input id="city" value={formData.city} onChange={e => updateField('city', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="country">Land</Label>
                    <Select value={formData.country} onValueChange={v => updateField('country', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AT">Österreich</SelectItem>
                        <SelectItem value="DE">Deutschland</SelectItem>
                        <SelectItem value="CH">Schweiz</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefon</Label>
                    <Input id="phone" value={formData.phone} onChange={e => updateField('phone', e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button onClick={() => setStep(1)} disabled={!canProceedStep0}>
                    Weiter <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'private', label: 'Privat', icon: User, desc: 'Privatperson' },
                    { value: 'business', label: 'Firma', icon: Building2, desc: 'Unternehmen / Gewerbe' },
                    { value: 'association', label: 'Verein', icon: Users, desc: 'Verein / Organisation' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => updateField('account_type', opt.value)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors',
                        formData.account_type === opt.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <opt.icon className={cn('h-6 w-6', formData.account_type === opt.value ? 'text-primary' : 'text-muted-foreground')} />
                      <span className="text-sm font-medium">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.desc}</span>
                    </button>
                  ))}
                </div>

                {formData.account_type !== 'private' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                      <Label htmlFor="company_name">
                        {formData.account_type === 'business' ? 'Firmenname *' : 'Vereinsname *'}
                      </Label>
                      <Input id="company_name" value={formData.company_name} onChange={e => updateField('company_name', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="uid_number">UID-Nummer</Label>
                      <Input id="uid_number" placeholder="ATU12345678" value={formData.uid_number} onChange={e => updateField('uid_number', e.target.value)} />
                    </div>
                  </div>
                )}

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setStep(0)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Zurück
                  </Button>
                  <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
                    Weiter <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="newsletter"
                    checked={formData.newsletter_opt_in}
                    onCheckedChange={v => updateField('newsletter_opt_in', !!v)}
                  />
                  <Label htmlFor="newsletter" className="text-sm leading-relaxed cursor-pointer">
                    Ich möchte den BillMonk Newsletter erhalten (Tipps, Updates, Angebote). Jederzeit abbestellbar.
                  </Label>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="privacy"
                    checked={formData.privacy_accepted}
                    onCheckedChange={v => updateField('privacy_accepted', !!v)}
                  />
                  <Label htmlFor="privacy" className="text-sm leading-relaxed cursor-pointer">
                    Ich akzeptiere die{' '}
                    <a href="/datenschutz" target="_blank" className="text-primary underline">
                      Datenschutzerklärung
                    </a>{' '}
                    und stimme der Verarbeitung meiner Daten zu. *
                  </Label>
                </div>

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Zurück
                  </Button>
                  <Button onClick={handleFinish} disabled={!canFinish || saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Los geht's! 🚀
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
