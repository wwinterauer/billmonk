import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export function Hero() {
  return (
    <section className="relative overflow-hidden gradient-hero py-20 lg:py-32">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="container relative">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center lg:text-left"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">
              Nie wieder Belege{' '}
              <span className="text-primary">abtippen.</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0">
              KI-gestützte Ausgabenverwaltung. Beleg fotografieren, fertig.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-6">
              <Link to="/register">
                <Button size="lg" className="gradient-primary shadow-primary hover:opacity-90 transition-opacity text-lg px-8 group">
                  Kostenlos starten
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap gap-4 justify-center lg:justify-start text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                10 Belege gratis
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Keine Kreditkarte
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="relative mx-auto max-w-lg">
              <div className="absolute inset-0 rounded-2xl gradient-primary opacity-20 blur-xl" />
              <div className="relative rounded-2xl border border-border bg-card p-4 shadow-xl">
                <div className="aspect-[4/3] rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                  <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                    <div className="text-center p-8">
                      <div className="w-16 h-16 rounded-xl gradient-primary mx-auto mb-4 flex items-center justify-center">
                        <span className="text-3xl">📄</span>
                      </div>
                      <p className="text-muted-foreground font-medium">App Dashboard Preview</p>
                      <div className="mt-4 space-y-2">
                        <div className="h-3 bg-border rounded-full w-3/4 mx-auto" />
                        <div className="h-3 bg-border rounded-full w-1/2 mx-auto" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
