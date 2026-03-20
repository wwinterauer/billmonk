import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { PLAN_PRICES, PLAN_LIMITS, PlanType } from '@/lib/planConfig';
import { STRIPE_TIERS } from '@/lib/stripeConfig';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PlanInfo {
  name: string;
  plan: PlanType;
  description: string;
  features: string[];
  cta: string;
  featured: boolean;
}

const plans: PlanInfo[] = [
  {
    name: 'Free',
    plan: 'free',
    description: 'Perfekt zum Ausprobieren',
    features: [
      `${PLAN_LIMITS.free.receiptsPerMonth} Belege/Monat`,
      'KI-Erkennung',
      'Beleg-Umbenennung',
      'E-Mail Support',
    ],
    cta: 'Kostenlos starten',
    featured: false,
  },
  {
    name: 'Starter',
    plan: 'starter',
    description: 'Für den Einstieg',
    features: [
      `${PLAN_LIMITS.starter.receiptsPerMonth} Belege/Monat`,
      'Kontoabgleich',
      'E-Mail Import',
      'Rollover-Guthaben',
    ],
    cta: 'Starter wählen',
    featured: false,
  },
  {
    name: 'Pro',
    plan: 'pro',
    description: 'Für Freelancer & Selbstständige',
    features: [
      `${PLAN_LIMITS.pro.receiptsPerMonth} Belege/Monat`,
      'Alles aus Starter',
      'Cloud-Backup',
      'Live-Bankanbindung (1 Konto)',
    ],
    cta: 'Pro wählen',
    featured: true,
  },
  {
    name: 'Business',
    plan: 'business',
    description: 'Für Teams & Unternehmen',
    features: [
      `${PLAN_LIMITS.business.receiptsPerMonth} Belege/Monat`,
      'Alles aus Pro',
      'Live-Bankanbindung (1 Konto)',
      'Angebote, AB & Lieferscheine',
      'Rechnungsmodul',
      'DATEV/BMD Export',
    ],
    cta: 'Business wählen',
    featured: false,
  },
];

export function Pricing() {
  const [yearly, setYearly] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const { toast } = useToast();

  const getPrice = (plan: PlanType) => {
    const prices = PLAN_PRICES[plan];
    if (yearly) {
      return `€${prices.yearly.toFixed(2).replace('.', ',')}`;
    }
    return `€${prices.monthly.toFixed(2).replace('.', ',')}`;
  };

  const handleCheckout = async (plan: PlanType) => {
    if (plan === 'free') return;

    setLoadingPlan(plan);
    try {
      const tier = STRIPE_TIERS[plan as keyof typeof STRIPE_TIERS];
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
        description: 'Checkout konnte nicht gestartet werden. Bist du eingeloggt?',
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <section id="pricing" className="py-20 bg-background">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Einfache Preise
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Wähle den Plan, der zu dir passt. Jederzeit kündbar.
          </p>

          {/* Monthly/Yearly Toggle */}
          <div className="flex items-center justify-center gap-3">
            <Label htmlFor="billing-toggle" className={!yearly ? 'text-foreground font-medium' : 'text-muted-foreground'}>
              Monatlich
            </Label>
            <Switch
              id="billing-toggle"
              checked={yearly}
              onCheckedChange={setYearly}
            />
            <Label htmlFor="billing-toggle" className={yearly ? 'text-foreground font-medium' : 'text-muted-foreground'}>
              Jährlich
              <span className="ml-1.5 text-xs text-primary font-semibold">-17%</span>
            </Label>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <Card
                className={`h-full relative ${
                  plan.featured
                    ? 'border-2 border-primary shadow-primary'
                    : 'border-border/50'
                }`}
              >
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                      Beliebt
                    </span>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <span className="text-4xl font-bold">{getPrice(plan.plan)}</span>
                    <span className="text-muted-foreground">
                      {yearly ? '/Jahr' : '/Monat'}
                    </span>
                  </div>

                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3 text-sm">
                        <Check className="h-4 w-4 text-success flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {plan.plan === 'free' ? (
                    <Link to="/register" className="block">
                      <Button className="w-full" variant="outline">
                        {plan.cta}
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      className={`w-full ${plan.featured ? 'gradient-primary hover:opacity-90' : ''}`}
                      variant={plan.featured ? 'default' : 'outline'}
                      onClick={() => handleCheckout(plan.plan)}
                      disabled={loadingPlan === plan.plan}
                    >
                      {loadingPlan === plan.plan ? 'Wird geladen...' : plan.cta}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
