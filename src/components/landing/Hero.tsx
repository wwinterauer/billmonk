import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, ArrowRight, Sparkles, Brain, FileText, Receipt } from 'lucide-react';
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
            <Badge variant="secondary" className="mb-4 bg-amber-100 text-amber-800 border-amber-300">
              🚀 Beta Version – Jetzt kostenlos testen
            </Badge>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">
              Belege scannen.{' '}
              <span className="text-primary">KI erledigt den Rest.</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0">
              Die intelligente Belegverwaltung für Kleinunternehmer, Freelancer und Vermieter. 
              Fotografiere deine Belege – unsere KI extrahiert automatisch alle wichtigen Daten.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-6">
              <Link to="/register">
                <Button size="lg" className="gradient-primary shadow-primary hover:opacity-90 transition-opacity text-lg px-8 group">
                  Kostenlos testen
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap gap-4 justify-center lg:justify-start text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Keine Kreditkarte nötig
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                DSGVO-konform
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Made in Austria
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
              <div className="relative rounded-2xl border border-border bg-card p-6 shadow-xl">
                {/* Mock Dashboard Preview */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <span className="font-semibold text-foreground">XpenzAi</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">Dashboard</Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <div className="flex items-center gap-2 mb-1">
                        <Receipt className="h-4 w-4 text-primary" />
                        <span className="text-xs text-muted-foreground">Belege</span>
                      </div>
                      <p className="text-lg font-bold text-foreground">247</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <div className="flex items-center gap-2 mb-1">
                        <Brain className="h-4 w-4 text-success" />
                        <span className="text-xs text-muted-foreground">KI-Genauigkeit</span>
                      </div>
                      <p className="text-lg font-bold text-success">94%</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-success/10 border border-success/20">
                      <FileText className="h-4 w-4 text-success" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">Amazon - Büromaterial</p>
                        <p className="text-xs text-muted-foreground">Automatisch erkannt</p>
                      </div>
                      <span className="text-sm font-semibold text-foreground">€ 89,99</span>
                    </div>
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border border-border">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">A1 Telekom - Mobilfunk</p>
                        <p className="text-xs text-muted-foreground">Zur Prüfung</p>
                      </div>
                      <span className="text-sm font-semibold text-foreground">€ 29,90</span>
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
