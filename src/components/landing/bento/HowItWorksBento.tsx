import { Upload, Sparkles, FileCheck, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BentoTile } from './BentoTile';
import { motion } from 'framer-motion';

const steps = [
  { icon: Upload, title: 'Beleg hochladen', description: 'PDF, Foto, Kamera oder direkt aus E-Mail-Anhängen. Auch viele auf einmal.', details: ['PDF & Bilder', 'E-Mail Import', 'Kamera-Scan'] },
  { icon: Sparkles, title: 'KI extrahiert', description: 'Lieferant, Betrag, MwSt-Satz, Datum & Rechnungsdetails — automatisch.', details: ['Lieferant', 'Beträge & MwSt', 'Re.-Nummer'] },
  { icon: FileCheck, title: 'Prüfen & Korrigieren', description: 'Schneller Review mit Tastatur-Navigation. Die KI lernt aus jeder Korrektur.', details: ['Vendor-Learning', 'Auto-Approval', 'Tags & Kategorien'] },
  { icon: CheckCircle, title: 'Exportieren', description: 'DATEV, BMD, CSV oder Excel — direkt für den Steuerberater oder den Bankabgleich.', details: ['DATEV/BMD', 'Bank-Abgleich', 'ZIP-Download'] },
];

export function HowItWorksBento() {
  return (
    <section id="how-it-works" className="py-20 lg:py-28">
      <div className="container">
        <div className="text-center mb-14 max-w-2xl mx-auto">
          <Badge variant="secondary" className="mb-4">Workflow</Badge>
          <h2 className="text-3xl sm:text-5xl font-bold text-foreground mb-4" style={{ textWrap: 'balance' }}>
            So löst Monk deinen Fall.
          </h2>
          <p className="text-lg text-muted-foreground">
            In vier Schritten von der Papierrechnung zur fertigen Buchhaltung.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          {steps.map((step, i) => (
            <BentoTile key={step.title} delay={i * 0.08} glow className="min-h-[280px] flex flex-col">
              <div className="flex items-center justify-between mb-5">
                <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl gradient-primary shadow-primary">
                  <step.icon className="h-6 w-6 text-primary-foreground" />
                  <motion.span
                    className="absolute -inset-2 rounded-3xl border border-primary/30"
                    animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
                  />
                </div>
                <span className="text-5xl font-bold text-foreground/5 tabular-nums leading-none">
                  0{i + 1}
                </span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground mb-4 flex-1">{step.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {step.details.map((d) => (
                  <Badge key={d} variant="outline" className="text-[10px]">{d}</Badge>
                ))}
              </div>
            </BentoTile>
          ))}
        </div>
      </div>
    </section>
  );
}
