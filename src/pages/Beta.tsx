import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Lock, FileText, Brain, Banknote, ArrowRight } from 'lucide-react';

export default function Beta() {
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
        .select('id, code, is_active, used_count, max_uses')
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

      // Increment used_count via RPC not possible with anon, so we set cookie and let it be
      // We'll increment server-side or via admin. For now just set cookie.
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `beta_access=true; expires=${expires}; path=/; SameSite=Lax`;

      // Try to increment used_count (will work if user is authenticated admin, otherwise silently fail)
      await supabase
        .from('beta_codes')
        .update({ used_count: data.used_count + 1 })
        .eq('id', data.id);

      toast.success('Beta-Zugang freigeschaltet!');
      navigate('/');
    } catch {
      toast.error('Fehler bei der Überprüfung');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3">
              <img src="/icons/icon.svg" alt="BillMonk" className="h-12 w-12" />
              <h1 className="text-3xl font-bold text-foreground tracking-tight">BillMonk</h1>
            </div>
            <div className="inline-block bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full">
              CLOSED BETA
            </div>
          </div>

          {/* Teaser */}
          <Card className="border-border/50 shadow-lg">
            <CardContent className="pt-6 space-y-4">
              <p className="text-muted-foreground text-center text-sm leading-relaxed">
                BillMonk ist deine KI-gestützte Plattform für Belegverwaltung, Buchhaltung und Rechnungserstellung — alles an einem Ort.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                {[
                  { icon: Brain, label: 'KI-Belegerkennung' },
                  { icon: FileText, label: 'Rechnungserstellung' },
                  { icon: Banknote, label: 'Bank-Integration' },
                  { icon: Lock, label: 'DSGVO-konform' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Code Entry */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="beta-code" className="text-sm font-medium text-foreground">
                Beta-Zugang
              </label>
              <Input
                id="beta-code"
                placeholder="Beta-Code eingeben..."
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="text-center text-lg tracking-widest font-mono"
                autoComplete="off"
              />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading || !code.trim()}>
              {loading ? 'Wird geprüft...' : 'Zugang freischalten'}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          {/* Impressum / Contact */}
          <div className="text-center text-xs text-muted-foreground space-y-1 pt-4 border-t border-border/50">
            <p className="font-medium">Kontakt & Impressum</p>
            <p>BillMonk · E-Mail: hello@billmonk.at</p>
            <a href="/datenschutz" className="underline hover:text-foreground transition-colors">
              Datenschutzerklärung
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
