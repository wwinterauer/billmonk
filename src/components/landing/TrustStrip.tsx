import { CheckCircle2, Lock, MapPin, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

const items = [
  { icon: MapPin, label: 'Made in Austria' },
  { icon: Lock, label: 'DSGVO-konform' },
  { icon: Clock, label: '30 Tage testen' },
  { icon: CheckCircle2, label: 'Keine Kreditkarte' },
];

export function TrustStrip() {
  return (
    <section aria-label="Vertrauen" className="border-y border-border bg-card/60 backdrop-blur">
      <div className="container py-4">
        <motion.ul
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground"
        >
          {items.map((i) => (
            <li key={i.label} className="flex items-center gap-2">
              <i.icon className="h-4 w-4 text-primary" />
              <span className="font-medium text-foreground/80">{i.label}</span>
            </li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
