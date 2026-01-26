import { Upload, Sparkles, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const steps = [
  {
    icon: Upload,
    title: '1. Beleg hochladen',
    description: 'PDF, Foto oder direkt aus der Cloud',
  },
  {
    icon: Sparkles,
    title: '2. KI extrahiert Daten',
    description: 'Lieferant, Betrag, MwSt, Datum - automatisch',
  },
  {
    icon: CheckCircle,
    title: '3. Prüfen & Fertig',
    description: 'Kurz bestätigen, für immer archiviert',
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 bg-background">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            So funktioniert's
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            In nur drei einfachen Schritten zur automatischen Belegverwaltung
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="relative text-center group"
            >
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-1/2 w-full h-0.5 bg-gradient-to-r from-primary/20 to-primary/5" />
              )}
              
              <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-2xl gradient-primary mb-6 shadow-primary group-hover:scale-105 transition-transform">
                <step.icon className="h-10 w-10 text-primary-foreground" />
              </div>
              
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {step.title}
              </h3>
              <p className="text-muted-foreground">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
