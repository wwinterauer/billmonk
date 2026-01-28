import { 
  Brain, 
  Mail, 
  FileSpreadsheet, 
  Shield, 
  Smartphone, 
  Building2,
  Camera,
  RefreshCw,
  Tags,
  FileCheck,
  Users,
  Zap
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const mainFeatures = [
  {
    icon: Brain,
    title: 'Lernende KI-Erkennung',
    description: 'Die KI extrahiert Lieferant, Betrag, MwSt und Datum automatisch – und wird mit jeder Korrektur besser.',
    badge: 'Kernfunktion',
  },
  {
    icon: Camera,
    title: 'Multi-Upload',
    description: 'Lade PDFs, Fotos oder mehrere Belege gleichzeitig hoch. Auch mehrseitige PDFs werden automatisch aufgeteilt.',
    badge: 'Kernfunktion',
  },
  {
    icon: Mail,
    title: 'E-Mail Import',
    description: 'Verbinde Gmail oder Outlook – Rechnungen aus E-Mail-Anhängen werden automatisch importiert und verarbeitet.',
    badge: 'Automatisierung',
  },
];

const additionalFeatures = [
  {
    icon: Building2,
    title: 'Bank-Abgleich',
    description: 'Importiere Kontoauszüge und matche Belege automatisch mit Bankbuchungen.',
  },
  {
    icon: Tags,
    title: 'Kategorien & Lieferanten',
    description: 'Organisiere Ausgaben mit eigenen Kategorien und verwalte Lieferanten-Stammdaten.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Flexible Exporte',
    description: 'Exportiere als CSV, Excel oder PDF – mit anpassbaren Vorlagen für deinen Steuerberater.',
  },
  {
    icon: RefreshCw,
    title: 'Dublikaterkennung',
    description: 'Automatische Erkennung und Warnung vor doppelt hochgeladenen Belegen.',
  },
  {
    icon: FileCheck,
    title: 'Review-Workflow',
    description: 'Effiziente Prüfung mit Tastatur-Navigation und direkter Korrekturmöglichkeit.',
  },
  {
    icon: Smartphone,
    title: 'Mobile-Ready',
    description: 'Nutze die App auf jedem Gerät – responsive Design für Desktop, Tablet und Smartphone.',
  },
  {
    icon: Users,
    title: 'Lieferanten-Lernen',
    description: 'Die KI merkt sich Korrekturen pro Lieferant und wendet sie bei neuen Belegen automatisch an.',
  },
  {
    icon: Shield,
    title: 'DSGVO-konform',
    description: 'Deine Daten werden sicher in der EU gespeichert und verschlüsselt übertragen.',
  },
  {
    icon: Zap,
    title: 'Schnelle Verarbeitung',
    description: 'KI-Analyse in Sekunden – keine Wartezeiten, sofortige Ergebnisse.',
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 bg-secondary/30">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <Badge variant="secondary" className="mb-4">Features</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Alles für deine Belegverwaltung
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Von der automatischen Erkennung bis zum Export – XpenzAi nimmt dir die lästige Arbeit ab
          </p>
        </motion.div>

        {/* Main Features - Highlighted */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {mainFeatures.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <Card className="h-full border-primary/20 bg-gradient-to-br from-primary/5 to-transparent hover:shadow-lg hover:border-primary/40 transition-all duration-300 group">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                      <feature.icon className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <Badge variant="secondary" className="text-xs">{feature.badge}</Badge>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Additional Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {additionalFeatures.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.05 }}
            >
              <Card className="h-full border-border/50 bg-card hover:shadow-md hover:border-primary/20 transition-all duration-300 group">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
