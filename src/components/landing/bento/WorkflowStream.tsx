import { motion } from 'framer-motion';
import { Inbox, Brain, FileCheck, Landmark, FileSpreadsheet, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const stages = [
  { icon: Inbox, label: 'Import', tone: 'bg-primary/15 text-primary' },
  { icon: Brain, label: 'KI-Extraktion', tone: 'bg-accent/15 text-accent' },
  { icon: FileCheck, label: 'Review', tone: 'bg-warning/15 text-warning' },
  { icon: Landmark, label: 'Bank-Match', tone: 'bg-success/15 text-success' },
  { icon: FileSpreadsheet, label: 'Export', tone: 'bg-primary/15 text-primary' },
];

export function WorkflowStream() {
  return (
    <section className="py-20 lg:py-28">
      <div className="container">
        <div className="text-center mb-12 max-w-2xl mx-auto">
          <Badge variant="secondary" className="mb-4">Pipeline</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Eine durchgängige Pipeline — null manuelle Übergaben.
          </h2>
          <p className="text-lg text-muted-foreground">
            Vom Posteingang bis in die Buchhaltung: jeder Beleg läuft denselben automatisierten Weg.
          </p>
        </div>

        <div className="relative rounded-3xl border border-border bg-card/60 p-6 lg:p-10 overflow-hidden">
          {/* Flow line */}
          <div className="hidden lg:block absolute left-10 right-10 top-1/2 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          {/* Pulse dot */}
          <motion.div
            aria-hidden
            className="hidden lg:block absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary))]"
            initial={{ left: '2.5rem' }}
            animate={{ left: 'calc(100% - 2.5rem)' }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', repeatType: 'reverse' }}
          />

          <div className="relative grid grid-cols-2 md:grid-cols-5 gap-4 lg:gap-6">
            {stages.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.45 }}
                className="flex flex-col items-center text-center gap-3"
              >
                <div className={`h-16 w-16 rounded-2xl flex items-center justify-center ${s.tone} ring-8 ring-card`}>
                  <s.icon className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Schritt {i + 1}</p>
                  <p className="font-semibold text-foreground">{s.label}</p>
                </div>
                {i < stages.length - 1 && (
                  <ArrowRight className="lg:hidden h-4 w-4 text-muted-foreground -mb-2 mt-1" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
