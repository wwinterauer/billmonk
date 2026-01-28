import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

export function CTA() {
  return (
    <section className="py-20 gradient-cta">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto"
        >
          <Badge variant="secondary" className="mb-4 bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30">
            Beta-Phase
          </Badge>
          
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-4">
            Bereit, das Belegchaos zu beenden?
          </h2>
          <p className="text-lg text-primary-foreground/80 mb-6">
            Teste XpenzAi kostenlos in der Beta-Phase und gestalte die Zukunft der Belegverwaltung mit.
          </p>
          
          <div className="flex flex-wrap gap-4 justify-center mb-8 text-sm text-primary-foreground/80">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Kostenlos in der Beta
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Feedback willkommen
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Keine Kreditkarte
            </span>
          </div>
          
          <Link to="/register">
            <Button 
              size="lg" 
              variant="secondary"
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 text-lg px-8 group"
            >
              Jetzt kostenlos testen
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
