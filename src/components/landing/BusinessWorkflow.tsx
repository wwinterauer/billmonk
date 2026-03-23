import { FileText, ClipboardCheck, Truck, Receipt, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

const steps = [
  {
    icon: FileText,
    label: 'Angebot',
    abbr: 'AG',
    description: 'Professionelle Angebote mit deinem Branding erstellen und als PDF versenden.',
  },
  {
    icon: ClipboardCheck,
    label: 'Auftragsbestätigung',
    abbr: 'AB',
    description: 'Mit einem Klick aus dem Angebot generieren und dem Kunden bestätigen.',
  },
  {
    icon: Truck,
    label: 'Lieferschein',
    abbr: 'LS',
    description: 'Lieferschein ableiten — Positionen, Mengen und Lieferadresse werden übernommen.',
  },
  {
    icon: Receipt,
    label: 'Rechnung',
    abbr: 'RE',
    description: 'Rechnung erstellen, PDF versenden und Zahlungseingang verfolgen.',
  },
];

export function BusinessWorkflow() {
  return (
    <section className="py-20 lg:py-28 bg-background overflow-hidden">
      <div className="container">
        <div
          className="text-center mb-14"
        >
          <Badge variant="outline" className="mb-4 border-warning/40 text-warning">Business-Tarif</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4" style={{ textWrap: 'balance' }}>
            Vom Angebot bis zur bezahlten Rechnung
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" style={{ textWrap: 'pretty' }}>
            Der komplette Verkaufs-Workflow in einer Oberfläche — Dokumente nahtlos ineinander umwandeln, nichts doppelt eintippen.
          </p>
        </div>

        {/* Desktop: horizontal flow */}
        <div className="hidden md:flex items-start justify-center gap-0 max-w-5xl mx-auto">
          {steps.map((step, i) => (
            <div key={step.abbr} className="flex items-start">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center text-center w-48"
              >
                <div className="w-16 h-16 rounded-2xl bg-warning/10 flex items-center justify-center mb-3 relative">
                  <step.icon className="h-7 w-7 text-warning" />
                  <span className="absolute -top-2 -right-2 text-[10px] font-bold bg-warning text-warning-foreground rounded-md px-1.5 py-0.5">
                    {step.abbr}
                  </span>
                </div>
                <h3 className="font-semibold text-foreground text-sm mb-1.5">{step.label}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed px-2">{step.description}</p>
              </motion.div>

              {i < steps.length - 1 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.15 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                  className="mt-5 mx-1"
                >
                  <ChevronRight className="h-6 w-6 text-warning/40" />
                </motion.div>
              )}
            </div>
          ))}
        </div>

        {/* Mobile: vertical flow */}
        <div className="md:hidden space-y-6 max-w-sm mx-auto">
          {steps.map((step, i) => (
            <motion.div
              key={step.abbr}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-start gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center shrink-0 relative">
                <step.icon className="h-6 w-6 text-warning" />
                <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold bg-warning text-warning-foreground rounded px-1 py-0.5">
                  {step.abbr}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">{step.label}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Extra info */}
        <div
          className="mt-12 text-center"
        >
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Inklusive Anzahlungs-, Teil- und Schlussrechnungen, automatischem Mahnwesen und wiederkehrenden Rechnungen.
          </p>
        </div>
      </div>
    </section>
  );
}
