import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';

const plans = [
  {
    name: 'Free',
    price: '€0',
    period: '/Monat',
    description: 'Perfekt zum Ausprobieren',
    features: [
      '10 Belege/Monat',
      '1 Cloud-Ordner',
      'E-Mail Support',
    ],
    cta: 'Kostenlos starten',
    href: '/register',
    featured: false,
  },
  {
    name: 'Pro',
    price: '€9,90',
    period: '/Monat',
    description: 'Für Freelancer & Selbstständige',
    features: [
      '100 Belege/Monat',
      'Unbegrenzte Cloud-Ordner',
      'Kontoabgleich',
      'Priority Support',
    ],
    cta: 'Pro wählen',
    href: '/register',
    featured: true,
  },
  {
    name: 'Business',
    price: '€19,90',
    period: '/Monat',
    description: 'Für Teams & Unternehmen',
    features: [
      'Unbegrenzte Belege',
      'Multi-User',
      'API-Zugang',
      'Dedicated Support',
    ],
    cta: 'Kontakt',
    href: '/register',
    featured: false,
  },
];

export function Pricing() {
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
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Wähle den Plan, der zu dir passt. Jederzeit kündbar.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
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
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3 text-sm">
                        <Check className="h-4 w-4 text-success flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link to={plan.href} className="block">
                    <Button 
                      className={`w-full ${plan.featured ? 'gradient-primary hover:opacity-90' : ''}`}
                      variant={plan.featured ? 'default' : 'outline'}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
