import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, CreditCard, Crown, Check } from 'lucide-react';
import { usePlan } from '@/hooks/usePlan';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PLAN_NAMES, PLAN_LIMITS, PLAN_PRICES, PlanType } from '@/lib/planConfig';
import { STRIPE_TIERS } from '@/lib/stripeConfig';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const UPGRADE_PLANS: { plan: Exclude<PlanType, 'free'>; features: string[] }[] = [
  {
    plan: 'starter',
    features: ['30 Belege/Monat', 'Kontoabgleich', 'E-Mail Import', 'Rollover-Guthaben'],
  },
  {
    plan: 'pro',
    features: ['100 Belege/Monat', 'Alles aus Starter', 'Cloud-Backup', 'Live-Bankanbindung', 'Priority Support'],
  },
  {
    plan: 'business',
    features: ['250 Belege/Monat', 'Alles aus Pro', 'Rechnungsmodul', 'DATEV/BMD Export', 'Dedicated Support'],
  },
];

export function SubscriptionSettings() {
  const { plan, effectivePlan, isAdmin, hasStripeCustomer, receiptsUsed, receiptsLimit, receiptsCredit, documentsUsed, documentsLimit, documentsCredit, loading: planLoading } = usePlan();
  const { toast } = useToast();
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);
  const [yearly, setYearly] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Abo-Portal konnte nicht geöffnet werden. Bitte versuche es erneut.',
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const checkSubscription = async () => {
    setCheckLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) throw error;
      toast({
        title: 'Status aktualisiert',
        description: data?.subscribed
          ? `Aktives ${PLAN_NAMES[data.plan as PlanType] || data.plan}-Abo erkannt.`
          : 'Kein aktives Abo gefunden.',
      });
      window.location.reload();
    } catch {
      toast({ variant: 'destructive', title: 'Fehler', description: 'Status konnte nicht geprüft werden.' });
    } finally {
      setCheckLoading(false);
    }
  };

  const handleCheckout = async (targetPlan: Exclude<PlanType, 'free'>) => {
    setLoadingPlan(targetPlan);
    try {
      const tier = STRIPE_TIERS[targetPlan];
      const priceId = yearly ? tier.yearlyPriceId : tier.monthlyPriceId;

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Checkout konnte nicht gestartet werden.',
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  const displayPlan = isAdmin ? plan : effectivePlan;
  const isPaid = displayPlan !== 'free';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                Dein Abo
              </CardTitle>
              <CardDescription>Verwalte deinen Plan und dein Abonnement</CardDescription>
            </div>
            <Badge variant={isPaid ? 'default' : 'secondary'} className="text-sm">
              {PLAN_NAMES[displayPlan]} Plan
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current plan details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-foreground">
                €{PLAN_PRICES[displayPlan].monthly.toFixed(2).replace('.', ',')}
              </p>
              <p className="text-xs text-muted-foreground">pro Monat</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-foreground">
                {PLAN_LIMITS[displayPlan].receiptsPerMonth}
              </p>
              <p className="text-xs text-muted-foreground">Belege/Monat</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-foreground">{receiptsUsed}</p>
              <p className="text-xs text-muted-foreground">Belege verwendet</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-foreground">
                {Math.max(0, receiptsLimit - receiptsUsed)}
              </p>
              <p className="text-xs text-muted-foreground">Belege verfügbar</p>
            </div>
          </div>

          {/* Document quota (only for plans with documents) */}
          {PLAN_LIMITS[displayPlan].documentsPerMonth > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-foreground">
                  {PLAN_LIMITS[displayPlan].documentsPerMonth}
                </p>
                <p className="text-xs text-muted-foreground">Dokumente/Monat</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-foreground">{documentsUsed}</p>
                <p className="text-xs text-muted-foreground">Dokumente verwendet</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-foreground">
                  {Math.max(0, documentsLimit - documentsUsed)}
                </p>
                <p className="text-xs text-muted-foreground">Dokumente verfügbar</p>
              </div>
              {documentsCredit > 0 && (
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold text-foreground">{documentsCredit}</p>
                  <p className="text-xs text-muted-foreground">Dokumente Guthaben</p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            {isPaid && hasStripeCustomer && (
              <Button onClick={openPortal} disabled={portalLoading} variant="outline">
                {portalLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                Abo verwalten
              </Button>
            )}
            <Button onClick={checkSubscription} disabled={checkLoading} variant="ghost" size="sm">
              {checkLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Status prüfen
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade plans */}
      {!isPaid && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Plan upgraden
            </CardTitle>
            <CardDescription>
              <div className="flex items-center gap-3 mt-2">
                <Label className={!yearly ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                  Monatlich
                </Label>
                <Switch checked={yearly} onCheckedChange={setYearly} />
                <Label className={yearly ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                  Jährlich
                  <span className="ml-1.5 text-xs text-primary font-semibold">-17%</span>
                </Label>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-4">
              {UPGRADE_PLANS.map((item) => {
                const prices = PLAN_PRICES[item.plan];
                const price = yearly ? prices.yearly : prices.monthly;
                

                return (
                  <Card key={item.plan} className="relative border-border/50">
                    {item.plan === 'pro' && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                          Beliebt
                        </span>
                      </div>
                    )}
                    <CardHeader className="text-center pb-2">
                      <CardTitle className="text-lg">{PLAN_NAMES[item.plan]}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-center">
                        <span className="text-3xl font-bold">€{price.toFixed(2).replace('.', ',')}</span>
                        <span className="text-muted-foreground text-sm">
                          {yearly ? '/Jahr' : '/Monat'}
                        </span>
                      </div>
                      <ul className="space-y-2">
                        {item.features.map((f) => (
                          <li key={f} className="flex items-center gap-2 text-sm">
                            <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        className="w-full"
                        variant={item.plan === 'pro' ? 'default' : 'outline'}
                        onClick={() => handleCheckout(item.plan)}
                        disabled={loadingPlan === item.plan}
                      >
                        {loadingPlan === item.plan ? 'Wird geladen...' : `${PLAN_NAMES[item.plan]} wählen`}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
