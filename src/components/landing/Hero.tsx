import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, ArrowRight, Brain, FileText, Receipt, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import logoTeal from '@/assets/logo-teal.png';

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
            <Badge variant="secondary" className="mb-4 bg-teal-50 text-teal-800 border-teal-200">
              Neuer Fall? Keine Sorge — Monk übernimmt.
            </Badge>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6" style={{ lineHeight: '1.08' }}>
              Rechnungen & Belege.{' '}
              <span className="text-primary">Erfasst, organisiert, wiedergefunden.</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0" style={{ textWrap: 'pretty' }}>
              Ob privat oder geschäftlich — BillMonk erkennt deine Belege per KI, organisiert sie automatisch und macht sie jederzeit durchsuchbar. Nie wieder Rechnungen suchen.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-6">
              <Link to="/register">
                <Button size="lg" className="gradient-primary shadow-primary hover:opacity-90 transition-opacity text-lg px-8 group active:scale-[0.97]">
                  Kostenlos testen
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap gap-4 justify-center lg:justify-start text-sm text-muted-foreground mb-8">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                30 Tage kostenlos testen
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

            {/* Social Proof */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex items-center gap-3 justify-center lg:justify-start"
            >
              <div className="flex -space-x-2">
                {['MK', 'TS', 'SM', 'JR'].map((initials) => (
                  <div
                    key={initials}
                    className="w-8 h-8 rounded-full border-2 border-background bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary"
                  >
                    {initials}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className="h-3.5 w-3.5 fill-warning text-warning" />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                Vertraut von Nutzern in AT & DE
              </span>
            </motion.div>
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
                      <img src={logoTeal} alt="BillMonk" className="h-6" />
                    </div>
                    <Badge variant="secondary" className="text-xs">Dashboard</Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <div className="flex items-center gap-2 mb-1">
                        <Receipt className="h-4 w-4 text-primary" />
                        <span className="text-xs text-muted-foreground">Belege</span>
                      </div>
                      <p className="text-lg font-bold text-foreground tabular-nums font-mono">247</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <div className="flex items-center gap-2 mb-1">
                        <Brain className="h-4 w-4 text-success" />
                        <span className="text-xs text-muted-foreground">KI-Genauigkeit</span>
                      </div>
                      <p className="text-lg font-bold text-success tabular-nums font-mono">94%</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-success/10 border border-success/20">
                      <FileText className="h-4 w-4 text-success" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">Amazon - Büromaterial</p>
                        <p className="text-xs text-muted-foreground">Automatisch erkannt</p>
                      </div>
                      <span className="text-sm font-semibold text-foreground tabular-nums font-mono">€ 89,99</span>
                    </div>
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border border-border">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">A1 Telekom - Mobilfunk</p>
                        <p className="text-xs text-muted-foreground">Zur Prüfung</p>
                      </div>
                      <span className="text-sm font-semibold text-foreground tabular-nums font-mono">€ 29,90</span>
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
