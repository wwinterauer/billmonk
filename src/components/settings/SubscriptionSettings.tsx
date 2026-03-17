import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, CreditCard, Crown } from 'lucide-react';
import { usePlan } from '@/hooks/usePlan';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PLAN_NAMES, PLAN_LIMITS, PLAN_PRICES, PlanType } from '@/lib/planConfig';

export function SubscriptionSettings() {
  const { plan, effectivePlan, isAdmin, receiptsUsed, receiptsLimit, receiptsCredit, loading: planLoading } = usePlan();
  const { toast } = useToast();
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);

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
      // Reload to reflect changes
      window.location.reload();
    } catch {
      toast({ variant: 'destructive', title: 'Fehler', description: 'Status konnte nicht geprüft werden.' });
    } finally {
      setCheckLoading(false);
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
              <p className="text-xs text-muted-foreground">verwendet</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-foreground">
                {receiptsLimit - receiptsUsed + receiptsCredit}
              </p>
              <p className="text-xs text-muted-foreground">verfügbar</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            {isPaid && (
              <Button onClick={openPortal} disabled={portalLoading} variant="outline">
                {portalLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                Abo verwalten
              </Button>
            )}
            {!isPaid && (
              <Button asChild>
                <a href="/#pricing">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Plan upgraden
                </a>
              </Button>
            )}
            <Button onClick={checkSubscription} disabled={checkLoading} variant="ghost" size="sm">
              {checkLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Status prüfen
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
