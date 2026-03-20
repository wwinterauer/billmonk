import { Check, X, Minus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

type CellValue = boolean | string;

interface FeatureRow {
  label: string;
  free: CellValue;
  starter: CellValue;
  pro: CellValue;
  business: CellValue;
}

const featureGroups: { group: string; features: FeatureRow[] }[] = [
  {
    group: 'Belege & Erkennung',
    features: [
      { label: 'Belege pro Monat', free: '10', starter: '30', pro: '100', business: '250' },
      { label: 'Dokumente pro Monat', free: '–', starter: '–', pro: '–', business: '250' },
      { label: 'KI-Erkennung', free: true, starter: true, pro: true, business: true },
      { label: 'Lieferanten-Lernen', free: true, starter: true, pro: true, business: true },
      { label: 'Dublikaterkennung', free: true, starter: true, pro: true, business: true },
      { label: 'Multi-Upload & PDF-Split', free: true, starter: true, pro: true, business: true },
    ],
  },
  {
    group: 'Import & Abgleich',
    features: [
      { label: 'E-Mail Import (Gmail, Outlook, IMAP)', free: false, starter: true, pro: true, business: true },
      { label: 'Bank-Import (CSV)', free: false, starter: true, pro: true, business: true },
      { label: 'Kontoabgleich', free: false, starter: true, pro: true, business: true },
      { label: 'Live-Bankanbindung', free: false, starter: false, pro: '1 Konto', business: '1 Konto' },
    ],
  },
  {
    group: 'Export & Backup',
    features: [
      { label: 'CSV / Excel / PDF Export', free: true, starter: true, pro: true, business: true },
      { label: 'Anpassbare Export-Vorlagen', free: false, starter: true, pro: true, business: true },
      { label: 'Cloud-Backup (Google Drive)', free: false, starter: false, pro: true, business: true },
      { label: 'DATEV / BMD Export', free: false, starter: false, pro: false, business: true },
    ],
  },
  {
    group: 'Rechnungen & Dokumente',
    features: [
      { label: 'Ausgangsrechnungen', free: false, starter: false, pro: false, business: true },
      { label: 'Angebote', free: false, starter: false, pro: false, business: true },
      { label: 'Auftragsbestätigungen', free: false, starter: false, pro: false, business: true },
      { label: 'Lieferscheine', free: false, starter: false, pro: false, business: true },
    ],
  },
  {
    group: 'Sonstiges',
    features: [
      { label: 'Aufbewahrung', free: '–', starter: '7 Jahre', pro: '10 Jahre', business: '10 Jahre' },
      { label: 'Rollover-Guthaben', free: false, starter: true, pro: true, business: true },
      { label: 'Mobile App (PWA)', free: true, starter: true, pro: true, business: true },
    ],
  },
];

function CellContent({ value }: { value: CellValue }) {
  if (value === true) return <Check className="h-4 w-4 text-success mx-auto" />;
  if (value === false) return <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />;
  if (value === '–') return <Minus className="h-4 w-4 text-muted-foreground/40 mx-auto" />;
  return <span className="text-sm font-medium text-foreground">{value}</span>;
}

const plans = ['free', 'starter', 'pro', 'business'] as const;
const planLabels = { free: 'Free', starter: 'Starter', pro: 'Pro', business: 'Business' };

export function PricingComparison() {
  return (
    <section className="py-20 bg-background">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Alle Features im Überblick
          </h2>
          <p className="text-lg text-muted-foreground">
            Vergleiche die Pläne im Detail
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-x-auto"
        >
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-4 pr-4 font-medium text-muted-foreground w-[40%]">Feature</th>
                {plans.map((p) => (
                  <th key={p} className="py-4 px-3 text-center font-semibold text-foreground">
                    <div className="flex flex-col items-center gap-1">
                      {planLabels[p]}
                      {p === 'pro' && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0">Beliebt</Badge>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {featureGroups.map((group) => (
                <>
                  <tr key={group.group}>
                    <td colSpan={5} className="pt-6 pb-2 font-semibold text-foreground text-xs uppercase tracking-wider">
                      {group.group}
                    </td>
                  </tr>
                  {group.features.map((feature) => (
                    <tr key={feature.label} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                      <td className="py-3 pr-4 text-muted-foreground">{feature.label}</td>
                      {plans.map((p) => (
                        <td key={p} className="py-3 px-3 text-center">
                          <CellContent value={feature[p]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
}
