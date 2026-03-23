import { motion } from 'framer-motion';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
  {
    q: 'Wie genau ist die KI-Erkennung?',
    a: 'Unsere KI erreicht eine Erkennungsgenauigkeit von über 90 % bei Standardbelegen. Durch das Lieferanten-Lernen verbessert sich die Genauigkeit mit jeder Korrektur automatisch – speziell für deine wiederkehrenden Lieferanten.',
  },
  {
    q: 'Sind meine Daten sicher?',
    a: 'Ja. Alle Daten werden DSGVO-konform in europäischen Rechenzentren gespeichert und verschlüsselt übertragen. Wir verkaufen keine Daten an Dritte und verarbeiten Belege ausschließlich für deinen Account.',
  },
  {
    q: 'Kann ich meine Daten an den Steuerberater exportieren?',
    a: 'Absolut. Du kannst Exporte als CSV, Excel oder PDF erstellen – mit anpassbaren Vorlagen. Im Business-Plan sind zusätzlich DATEV- und BMD-Exporte verfügbar.',
  },
  {
    q: 'Was passiert nach der Beta-Phase?',
    a: 'Beta-Nutzer sichern sich 50 % Rabatt für die ersten 12 Monate nach dem offiziellen Launch. Du kannst jederzeit kündigen – es gibt keine Mindestlaufzeit.',
  },
  {
    q: 'Kann ich jederzeit kündigen?',
    a: 'Ja, alle Pläne sind monatlich kündbar. Nach der Kündigung hast du noch bis zum Ende des Abrechnungszeitraums Zugriff auf alle Funktionen.',
  },
  {
    q: 'Welche Belegformate werden unterstützt?',
    a: 'XpenzAi verarbeitet PDF-Dateien, Fotos (JPG, PNG) und mehrseitige Scans. Du kannst Belege per Upload, E-Mail-Import oder direkt mit der Kamera erfassen.',
  },
  {
    q: 'Muss ich eine Software installieren?',
    a: 'Nein. XpenzAi ist eine Web-App und läuft direkt im Browser – auf Desktop, Tablet und Smartphone. Optional kannst du die App als PWA auf deinem Gerät installieren.',
  },
];

export function FAQ() {
  return (
    <section id="faq" className="py-20 lg:py-28 bg-secondary/30">
      <div className="container max-w-3xl">
        <div
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4" style={{ textWrap: 'balance' }}>
            Häufige Fragen
          </h2>
          <p className="text-lg text-muted-foreground">
            Alles was du wissen musst – kurz und ehrlich
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="border border-border/60 rounded-xl px-5 bg-card data-[state=open]:shadow-md transition-shadow"
              >
                <AccordionTrigger className="text-left font-medium text-foreground hover:no-underline py-4">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4 leading-relaxed">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
