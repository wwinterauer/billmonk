import { X, Check, Clock, AlertTriangle, FileWarning, FolderSearch, Brain, Zap, Shield, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

const problems = [
  { icon: Clock, text: 'Stundenlang Belege abtippen' },
  { icon: FileWarning, text: 'Belege verloren oder unleserlich' },
  { icon: FolderSearch, text: 'Keine Übersicht über Ausgaben' },
  { icon: AlertTriangle, text: 'Steuerberater-Panik vor dem Jahresende' },
];

const solutions = [
  { icon: Zap, text: 'KI erkennt alles in Sekunden' },
  { icon: Shield, text: 'Sicher archiviert in der Cloud' },
  { icon: TrendingUp, text: 'Echtzeit-Überblick über alle Ausgaben' },
  { icon: Brain, text: 'Export-fertig für den Steuerberater' },
];

export function ProblemSolution() {
  return (
    <section className="py-20 lg:py-28 bg-background">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4" style={{ textWrap: 'balance' }}>
            Schluss mit dem Belegchaos
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" style={{ textWrap: 'pretty' }}>
            Manuelle Belegverwaltung kostet Zeit und Nerven. XpenzAi automatisiert den gesamten Prozess.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
          {/* Problems */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 lg:p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <X className="h-5 w-5 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Ohne XpenzAi</h3>
            </div>
            <ul className="space-y-4">
              {problems.map((item, i) => (
                <motion.li
                  key={item.text}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.1 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-start gap-3"
                >
                  <item.icon className="h-5 w-5 text-destructive/70 mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{item.text}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* Solutions */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl border border-success/20 bg-success/5 p-6 lg:p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <Check className="h-5 w-5 text-success" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Mit XpenzAi</h3>
            </div>
            <ul className="space-y-4">
              {solutions.map((item, i) => (
                <motion.li
                  key={item.text}
                  initial={{ opacity: 0, x: 12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.1 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-start gap-3"
                >
                  <item.icon className="h-5 w-5 text-success mt-0.5 shrink-0" />
                  <span className="text-foreground">{item.text}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
