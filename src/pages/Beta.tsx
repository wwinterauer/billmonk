import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Lock, ArrowRight, Loader2, UserPlus, KeyRound, CheckCircle2 } from 'lucide-react';

import { Hero } from '@/components/landing/Hero';
import { ProblemSolution } from '@/components/landing/ProblemSolution';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Features } from '@/components/landing/Features';
import { Pricing } from '@/components/landing/Pricing';
import { Footer } from '@/components/landing/Footer';

export default function Beta() {
  const [activeTab, setActiveTab] = useState<'apply' | 'code'>('apply');
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <img src="/icons/icon.svg" alt="BillMonk" className="h-8 w-8" />
            <span className="font-bold text-lg text-foreground">BillMonk</span>
            <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-0">BETA</Badge>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Preise</a>
            <a href="#beta-signup" className="text-muted-foreground hover:text-foreground transition-colors">Beta-Zugang</a>
          </nav>
          <Button size="sm" variant="outline" onClick={() => setActiveTab('code')} className="gap-1.5">
            <KeyRound className="h-3.5 w-3.5" />
            Code eingeben
          </Button>
        </div>
      </header>

      {/* Landing content */}
      <Hero />
      <ProblemSolution />
      <HowItWorks />
      <Features />
      <Pricing />

      {/* Beta signup section */}
      <section id="beta-signup" className="py-20 bg-secondary/30">
        <div className="container max-w-2xl">
          <div className="text-center mb-8">
            <Badge variant="secondary" className="mb-4 bg-primary/10 text-primary border-0">
              Closed Beta
            </Badge>
            <h2 className="text-3xl font-bold text-foreground mb-3">Beta-Zugang beantragen</h2>
            <p className="text-muted-foreground">
              Registriere dich und erhalte deinen persönlichen Beta-Code per E-Mail.
            </p>
          </div>

          {/* Tab toggle */}
          <div className="flex justify-center gap-2 mb-8">
            <Button
              variant={activeTab === 'apply' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('apply')}
              className="gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Bewerben
            </Button>
            <Button
              variant={activeTab === 'code' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('code')}
              className="gap-2"
            >
              <KeyRound className="h-4 w-4" />
              Code einlösen
            </Button>
          </div>

          {activeTab === 'apply' ? (
            <BetaApplicationForm />
          ) : (
            <BetaCodeEntry />
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

/* ─── Beta Application Form ─── */
function BetaApplicationForm() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    street: '',
    zip: '',
    city: '',
    country: 'AT',
    organizationType: 'privat',
    organizationName: '',
    intendedPlan: 'starter',
  });

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.firstName || !form.lastName) return;
    if (form.password.length < 6) {
      toast.error('Passwort muss mindestens 6 Zeichen haben');
      return;
    }

    setLoading(true);
    try {
      // 1. Create account
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/beta`,
          data: {
            first_name: form.firstName,
            last_name: form.lastName,
          },
        },
      });

      if (signUpError) {
        toast.error(signUpError.message === 'User already registered'
          ? 'Diese E-Mail ist bereits registriert. Nutze "Code einlösen".'
          : signUpError.message);
        setLoading(false);
        return;
      }

      const userId = signUpData.user?.id;

      // 2. Insert beta application
      if (userId) {
        await supabase.from('beta_applications').insert({
          user_id: userId,
          email: form.email,
          first_name: form.firstName,
          last_name: form.lastName,
          street: form.street || null,
          zip: form.zip || null,
          city: form.city || null,
          country: form.country,
          organization_type: form.organizationType,
          organization_name: form.organizationName || null,
          intended_plan: form.intendedPlan,
        } as any);
      }

      // 3. Send admin notification
      try {
        await supabase.functions.invoke('send-transactional-email', {
          body: {
            template: 'beta-application-notification',
            data: {
              first_name: form.firstName,
              last_name: form.lastName,
              email: form.email,
              organization_type: form.organizationType,
              organization_name: form.organizationName,
              intended_plan: form.intendedPlan,
              city: form.city,
              country: form.country,
            },
          },
        });
      } catch {
        // Non-critical — admin will see it in dashboard
      }

      // Sign out so user doesn't get into the app without beta code
      await supabase.auth.signOut();

      setSubmitted(true);
      toast.success('Bewerbung eingegangen!');
    } catch {
      toast.error('Fehler bei der Registrierung');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardContent className="pt-6 text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
          <h3 className="text-xl font-semibold text-foreground">Bewerbung eingegangen!</h3>
          <p className="text-muted-foreground">
            Wir prüfen deine Bewerbung und senden dir deinen persönlichen Beta-Code per E-Mail.
            Bitte bestätige auch deine E-Mail-Adresse über den Link, den wir dir geschickt haben.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          Beta-Bewerbung
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">Vorname *</Label>
              <Input id="firstName" required value={form.firstName} onChange={e => update('firstName', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Nachname *</Label>
              <Input id="lastName" required value={form.lastName} onChange={e => update('lastName', e.target.value)} />
            </div>
          </div>

          {/* Email + Password */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-Mail *</Label>
              <Input id="email" type="email" required value={form.email} onChange={e => update('email', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Passwort *</Label>
              <Input id="password" type="password" required minLength={6} value={form.password} onChange={e => update('password', e.target.value)} placeholder="Min. 6 Zeichen" />
            </div>
          </div>

          <Separator />

          {/* Address */}
          <div className="space-y-1.5">
            <Label htmlFor="street">Straße</Label>
            <Input id="street" value={form.street} onChange={e => update('street', e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="zip">PLZ</Label>
              <Input id="zip" value={form.zip} onChange={e => update('zip', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">Ort</Label>
              <Input id="city" value={form.city} onChange={e => update('city', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="country">Land</Label>
              <Select value={form.country} onValueChange={v => update('country', v)}>
                <SelectTrigger id="country"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AT">Österreich</SelectItem>
                  <SelectItem value="DE">Deutschland</SelectItem>
                  <SelectItem value="CH">Schweiz</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Organization */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Organisationstyp *</Label>
              <Select value={form.organizationType} onValueChange={v => update('organizationType', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="privat">Privat</SelectItem>
                  <SelectItem value="firma">Firma / Selbstständig</SelectItem>
                  <SelectItem value="verein">Verein</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orgName">Name (Firma/Verein)</Label>
              <Input id="orgName" value={form.organizationName} onChange={e => update('organizationName', e.target.value)} placeholder="Optional" />
            </div>
          </div>

          {/* Plan */}
          <div className="space-y-1.5">
            <Label>Welchen Plan möchtest du nutzen? *</Label>
            <Select value={form.intendedPlan} onValueChange={v => update('intendedPlan', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Starter (€2,99/Monat)</SelectItem>
                <SelectItem value="pro">Pro (€7,99/Monat)</SelectItem>
                <SelectItem value="business">Business (€15,99/Monat)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full gap-2" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {loading ? 'Wird erstellt...' : 'Bewerbung absenden'}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Mit der Registrierung akzeptierst du unsere{' '}
            <a href="/datenschutz" className="underline hover:text-foreground">Datenschutzerklärung</a>.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

/* ─── Beta Code Entry ─── */
function BetaCodeEntry() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('beta_codes')
        .select('id, code, is_active, used_count, max_uses, expires_at')
        .eq('code', code.trim())
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) {
        toast.error('Ungültiger oder inaktiver Beta-Code');
        setLoading(false);
        return;
      }

      if (data.max_uses !== null && data.used_count >= data.max_uses) {
        toast.error('Dieser Beta-Code wurde bereits zu oft verwendet');
        setLoading(false);
        return;
      }

      // Check expiry
      if ((data as any).expires_at && new Date((data as any).expires_at) < new Date()) {
        toast.error('Dieser Beta-Code ist abgelaufen');
        setLoading(false);
        return;
      }

      // Set localStorage + cookie
      localStorage.setItem('beta_access', 'true');
      const expires = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `beta_access=true; expires=${expires}; path=/; SameSite=Lax`;

      // Try to increment used_count
      await supabase
        .from('beta_codes')
        .update({ used_count: data.used_count + 1 })
        .eq('id', data.id);

      // If user is logged in, set beta_expires_at on profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const updateData: Record<string, any> = {
          is_beta_user: true,
          plan: 'business',
          subscription_status: 'active',
        };
        if ((data as any).expires_at) {
          updateData.beta_expires_at = (data as any).expires_at;
        }
        await supabase.from('profiles').update(updateData).eq('id', user.id);
      }

      toast.success('Beta-Zugang freigeschaltet!');
      navigate('/');
    } catch {
      toast.error('Fehler bei der Überprüfung');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          Beta-Code einlösen
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Du hast bereits einen Beta-Code erhalten? Gib ihn hier ein, um sofort loszulegen.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Beta-Code eingeben..."
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="text-center text-lg tracking-widest font-mono"
            autoComplete="off"
          />
          <Button type="submit" className="w-full gap-2" disabled={loading || !code.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {loading ? 'Wird geprüft...' : 'Zugang freischalten'}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>

        <Separator className="my-6" />

        <p className="text-xs text-muted-foreground text-center">
          Noch keinen Code? Wechsle zum Tab "Bewerben" und registriere dich für die Beta.
        </p>
      </CardContent>
    </Card>
  );
}
