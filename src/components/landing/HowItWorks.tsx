import { Upload, Sparkles, CheckCircle, FileCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

const steps = [
  {
    icon: Upload,
    title: 'Beleg hochladen',
    description: 'PDF, Foto oder direkt aus E-Mail-Anhängen importieren. Auch mehrere Belege auf einmal.',
    details: ['PDF & Bilder', 'E-Mail Import', 'Kamera-Scan'],
  },
  {
    icon: Sparkles,
    title: 'KI extrahiert Daten',
    description: 'Unsere KI erkennt automatisch Lieferant, Betrag, MwSt-Satz, Datum und Rechnungsdetails.',
    details: ['Lieferant & Marke', 'Beträge & MwSt', 'Rechnungsnummer'],
  },
  {
    icon: FileCheck,
    title: 'Prüfen & Korrigieren',
    description: 'Schneller Review-Prozess mit Tastatur-Navigation. Die KI lernt aus deinen Korrekturen.',
    details: ['Schnelle Prüfung', 'KI lernt mit', 'Kategorisierung'],
  },
  {
    icon: CheckCircle,
    title: 'Exportieren & Archivieren',
    description: 'Exportiere für den Steuerberater oder matche Belege mit deinen Bankbuchungen.',
    details: ['CSV/Excel/PDF', 'Bank-Abgleich', 'Sicher archiviert'],
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 bg-background">
      <div className="container">
        <div
          className="text-center mb-16"
        >
          <Badge variant="secondary" className="mb-4">Workflow</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            So einfach funktioniert's
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            In vier Schritten von der Papierrechnung zur fertigen Buchhaltung
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="relative text-center group"
            >
              {/* Step number */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center z-10">
                {index + 1}
              </div>
              
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-1/2 w-full h-0.5 bg-gradient-to-r from-primary/30 to-primary/10" />
              )}
              
              <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-2xl gradient-primary mb-6 shadow-primary group-hover:scale-105 transition-transform">
                <step.icon className="h-10 w-10 text-primary-foreground" />
              </div>
              
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {step.title}
              </h3>
              <p className="text-muted-foreground mb-4">
                {step.description}
              </p>
              
              <div className="flex flex-wrap gap-1 justify-center">
                {step.details.map((detail) => (
                  <Badge key={detail} variant="outline" className="text-xs">
                    {detail}
                  </Badge>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
