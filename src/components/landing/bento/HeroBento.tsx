import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Brain, CheckCircle2, Receipt, Sparkles, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BentoTile } from './BentoTile';
import { AnimatedCounter } from './AnimatedCounter';
import { HeroBackdrop } from './HeroBackdrop';
import { HeroVideo } from './HeroVideo';
import { MagneticWrap } from './MagneticWrap';
import { TiltCard } from './TiltCard';

export function HeroBento() {
  return (
    <section className="relative overflow-hidden">
      <HeroBackdrop />



      <div className="container pt-20 pb-16 lg:pt-28 lg:pb-24">
        {/* HERO Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 lg:gap-5">
          {/* HEADLINE TILE — spans 4 cols */}
          <BentoTile className="lg:col-span-4 lg:row-span-2 min-h-[420px] flex flex-col justify-between" glow>
            <div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Badge variant="secondary" className="mb-5 bg-primary/10 text-primary border-primary/20 px-3 py-1">
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Neuer Fall? Keine Sorge — Monk übernimmt.
                </Badge>
              </motion.div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight text-foreground" style={{ lineHeight: '1.02', textWrap: 'balance' }}>
                Rechnungen & Belege.{' '}
                <span className="relative inline-block">
                  <span className="relative z-10 bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-primary)' }}>
                    Erfasst, organisiert,
                  </span>
                  <motion.span
                    aria-hidden
                    className="absolute -bottom-1 left-0 h-2 w-full rounded-full bg-primary/20"
                    initial={{ scaleX: 0, originX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.8, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  />
                </span>{' '}
                <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-primary)' }}>
                  wiedergefunden.
                </span>
              </h1>
              <p className="mt-6 text-lg lg:text-xl text-muted-foreground max-w-xl" style={{ textWrap: 'pretty' }}>
                Ob privat oder geschäftlich — BillMonk erkennt deine Belege per KI, organisiert sie automatisch und macht sie jederzeit durchsuchbar. Nie wieder Rechnungen suchen.
              </p>
            </div>

            <div className="mt-8 space-y-5">
              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/register">
                  <Button size="lg" className="gradient-primary shadow-primary text-base px-8 h-12 group active:scale-[0.97]">
                    Kostenlos testen
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <a href="#how-it-works">
                  <Button size="lg" variant="outline" className="h-12 px-6 text-base">
                    So funktioniert's
                  </Button>
                </a>
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                {['30 Tage kostenlos', 'DSGVO-konform', 'Made in Austria'].map((t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    {t}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <div className="flex -space-x-2">
                  {['MK', 'TS', 'SM', 'JR'].map((i) => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-card bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">
                      {i}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="h-3.5 w-3.5 fill-warning text-warning" />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">Vertraut von Nutzern in AT &amp; DE</span>
              </div>
            </div>
          </BentoTile>

          {/* KI-Accuracy counter */}
          <BentoTile tone="primary" delay={0.1} className="lg:col-span-2 min-h-[200px] flex flex-col justify-between">
            <div className="flex items-center gap-2 text-primary">
              <Brain className="h-5 w-5" />
              <span className="text-xs uppercase tracking-wider font-semibold">KI-Genauigkeit</span>
            </div>
            <div>
              <div className="text-6xl font-bold tabular-nums text-foreground">
                <AnimatedCounter to={94} suffix=" %" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">Lieferant, Betrag, MwSt &amp; Datum — automatisch.</p>
            </div>
          </BentoTile>

          {/* Receipts processed counter */}
          <BentoTile tone="success" delay={0.18} className="lg:col-span-2 min-h-[200px] flex flex-col justify-between">
            <div className="flex items-center gap-2 text-success">
              <Receipt className="h-5 w-5" />
              <span className="text-xs uppercase tracking-wider font-semibold">Belege verarbeitet</span>
            </div>
            <div>
              <div className="text-6xl font-bold tabular-nums text-foreground">
                <AnimatedCounter to={250000} />
              </div>
              <p className="text-sm text-muted-foreground mt-1">und es werden täglich mehr.</p>
            </div>
          </BentoTile>

          {/* LIVE FEED tile — wide */}
          <BentoTile delay={0.05} className="lg:col-span-4 min-h-[320px] p-0 overflow-hidden">
            <div className="absolute inset-0 bg-sidebar text-sidebar-foreground" />
            <div className="relative h-full flex flex-col">
              {/* Window chrome */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-sidebar-border/60">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
                </div>
                <span className="text-xs text-sidebar-foreground/60 font-mono">billmonk.ai · Live Inbox</span>
                <Badge className="bg-success/20 text-success border-0 text-[10px]">
                  <span className="mr-1 h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                  Live
                </Badge>
              </div>

              <div className="flex-1 p-5 space-y-2.5 overflow-hidden">
                {liveReceipts.map((r, i) => (
                  <motion.div
                    key={r.name}
                    initial={{ opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.45, delay: 0.2 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-sidebar-accent/60 border border-sidebar-border/50"
                  >
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                      r.tone === 'success' ? 'bg-success/20 text-success' :
                      r.tone === 'primary' ? 'bg-primary/20 text-primary' :
                      'bg-sidebar-foreground/10 text-sidebar-foreground/80'
                    }`}>
                      <r.icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{r.name}</p>
                      <p className="text-xs text-sidebar-foreground/60 truncate">{r.sub}</p>
                    </div>
                    <span className="text-sm font-mono font-semibold tabular-nums">{r.amount}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </BentoTile>

          {/* Trust tile */}
          <BentoTile delay={0.15} tone="warning" className="lg:col-span-2 min-h-[320px] flex flex-col justify-between">
            <div>
              <Badge variant="outline" className="border-warning/30 text-warning bg-warning/5 mb-4">
                Made in Austria 🇦🇹
              </Badge>
              <h3 className="text-xl font-semibold text-foreground leading-snug">
                Steuerberater-ready. Bank-verbunden. DSGVO-sicher.
              </h3>
            </div>
            <div className="space-y-3 text-sm">
              {[
                { label: 'EU-Hosting & verschlüsselt' },
                { label: 'DATEV / BMD Export' },
                { label: 'Open-Banking-Anbindung' },
                { label: '7–10 Jahre Archivierung' },
              ].map((b) => (
                <div key={b.label} className="flex items-center gap-2 text-foreground/80">
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  {b.label}
                </div>
              ))}
            </div>
          </BentoTile>
        </div>
      </div>
    </section>
  );
}
