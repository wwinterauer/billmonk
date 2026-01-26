import { Brain, Cloud, Building2, FileSpreadsheet, Shield, Smartphone } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';

const features = [
  {
    icon: Brain,
    title: 'Lernende KI',
    description: 'Wird mit jeder Korrektur besser',
  },
  {
    icon: Cloud,
    title: 'Cloud-Sync',
    description: 'OneDrive, Google Drive, Dropbox',
  },
  {
    icon: Building2,
    title: 'Kontoabgleich',
    description: 'Automatisch mit Bankbuchungen matchen',
  },
  {
    icon: FileSpreadsheet,
    title: 'Excel-Export',
    description: 'Perfekt für den Steuerberater',
  },
  {
    icon: Shield,
    title: 'DSGVO-konform',
    description: 'Daten sicher in der EU',
  },
  {
    icon: Smartphone,
    title: 'Mobile App',
    description: 'Belege unterwegs scannen',
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
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Alles was du brauchst
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Moderne Funktionen für effiziente Ausgabenverwaltung
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <Card className="h-full border-border/50 bg-card hover:shadow-lg hover:border-primary/20 transition-all duration-300 group">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="h-6 w-6 text-primary" />
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
      </div>
    </section>
  );
}
