import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { FileText, Inbox, ArrowLeftRight } from 'lucide-react';

/** Vorher/Nachher Slider — left: chaos, right: structured dashboard. */
export function BeforeAfter() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [isCoarse, setIsCoarse] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    setIsCoarse(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  // Mobile auto-animation
  useEffect(() => {
    if (!isCoarse || reduced) return;
    let raf = 0;
    let start = performance.now();
    const loop = (t: number) => {
      const dt = (t - start) / 1000;
      // 8s loop, oscillate 25% → 75%
      const v = 50 + Math.sin(dt * (Math.PI / 4)) * 25;
      setPos(v);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isCoarse, reduced]);

  const update = (clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const v = ((clientX - r.left) / r.width) * 100;
    setPos(Math.max(4, Math.min(96, v)));
  };

  return (
    <section aria-label="Vorher und Nachher" className="py-20 lg:py-28">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary mb-4">
            <ArrowLeftRight className="h-3.5 w-3.5" /> Vorher · Nachher
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground" style={{ textWrap: 'balance' }}>
            Vom Beleg-Chaos zum aufgeräumten Cockpit.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Zieh den Schieberegler — links der gewohnte Wahnsinn, rechts dein BillMonk.
          </p>
        </div>

        <div
          ref={wrapRef}
          className="relative mx-auto aspect-[16/9] max-w-6xl overflow-hidden rounded-3xl border border-border shadow-xl select-none"
          onPointerDown={(e) => {
            if (isCoarse) return;
            setDragging(true);
            update(e.clientX);
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => dragging && update(e.clientX)}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
        >
          {/* BEFORE (full width) */}
          <BeforeScene />

          {/* AFTER (clipped to pos%) */}
          <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
            <AfterScene />
          </div>

          {/* Labels */}
          <span className="absolute left-5 top-5 rounded-full bg-foreground/80 px-3 py-1 text-xs font-semibold text-background backdrop-blur">
            Vorher
          </span>
          <span className="absolute right-5 top-5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
            Mit BillMonk
          </span>

          {/* Slider handle */}
          <motion.div
            className="absolute inset-y-0 w-1 bg-primary"
            style={{ left: `${pos}%` }}
            initial={false}
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 flex h-12 w-12 cursor-ew-resize items-center justify-center rounded-full bg-primary text-primary-foreground shadow-primary ring-4 ring-card">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function BeforeScene() {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-warning/10 via-card to-warning/5">
      <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)', backgroundSize: '20px 20px' }} />
      {/* Scattered receipts */}
      {[
        { x: 8, y: 12, r: -14, w: 16, h: 22 },
        { x: 24, y: 8, r: 10, w: 14, h: 19 },
        { x: 42, y: 18, r: -6, w: 17, h: 23 },
        { x: 60, y: 6, r: 18, w: 15, h: 20 },
        { x: 78, y: 14, r: -20, w: 16, h: 21 },
        { x: 14, y: 48, r: 22, w: 15, h: 20 },
        { x: 36, y: 54, r: -10, w: 17, h: 23 },
        { x: 58, y: 50, r: 14, w: 14, h: 19 },
        { x: 80, y: 56, r: -18, w: 16, h: 22 },
      ].map((r, i) => (
        <div
          key={i}
          className="absolute bg-card shadow-md"
          style={{
            left: `${r.x}%`,
            top: `${r.y}%`,
            width: `${r.w}%`,
            height: `${r.h}%`,
            transform: `rotate(${r.r}deg)`,
            borderRadius: 4,
            padding: '6%',
          }}
        >
          <div className="h-1.5 w-2/3 bg-muted rounded mb-1.5" />
          {Array.from({ length: 4 }).map((_, k) => (
            <div key={k} className="h-1 bg-muted/60 rounded mb-1" style={{ width: `${50 + ((i * 7 + k * 13) % 40)}%` }} />
          ))}
        </div>
      ))}
      <div className="absolute bottom-4 left-4 text-sm font-semibold text-warning flex items-center gap-2">
        <FileText className="h-4 w-4" /> 247 Belege · ungeordnet · 6 h Suchzeit
      </div>
    </div>
  );
}

function AfterScene() {
  return (
    <div className="absolute inset-0 bg-card">
      {/* Sidebar */}
      <div className="absolute inset-y-0 left-0 w-[18%] bg-sidebar p-3 flex flex-col gap-2">
        <div className="h-6 w-2/3 rounded bg-sidebar-foreground/20" />
        {['Dashboard', 'Belege', 'Rechnungen', 'Bank', 'Export'].map((l) => (
          <div key={l} className="h-7 rounded flex items-center px-2 text-[10px] font-medium text-sidebar-foreground/80 bg-sidebar-accent/40">
            {l}
          </div>
        ))}
      </div>
      {/* Content */}
      <div className="absolute inset-y-0 left-[18%] right-0 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="h-3 w-32 rounded bg-foreground/20 mb-1.5" />
            <div className="h-2 w-48 rounded bg-muted" />
          </div>
          <div className="flex gap-2">
            <div className="h-7 w-20 rounded bg-primary/20" />
            <div className="h-7 w-7 rounded-full bg-primary" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { l: 'Ausgaben Mai', v: '€ 4.218', tone: 'primary' },
            { l: 'Vorsteuer', v: '€ 703', tone: 'success' },
            { l: 'Offen', v: '€ 892', tone: 'warning' },
          ].map((s) => (
            <div key={s.l} className="rounded-lg border border-border bg-card p-3">
              <div className="text-[10px] text-muted-foreground">{s.l}</div>
              <div className={`text-base font-bold ${s.tone === 'primary' ? 'text-primary' : s.tone === 'success' ? 'text-success' : 'text-warning'}`}>
                {s.v}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {[
            { v: 'BILLA', c: 'Lebensmittel', a: '€ 47,32', ok: true },
            { v: 'Amazon', c: 'Büromaterial', a: '€ 89,99', ok: true },
            { v: 'A1', c: 'Mobilfunk', a: '€ 29,90', ok: true },
            { v: 'Hofer', c: 'Lebensmittel', a: '€ 18,45', ok: true },
            { v: 'Spar', c: 'Lebensmittel', a: '€ 24,17', ok: true },
          ].map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr,1fr,auto,auto] items-center gap-3 px-3 py-2 border-t border-border first:border-t-0 text-[11px]">
              <span className="font-semibold text-foreground">{row.v}</span>
              <span className="text-muted-foreground">{row.c}</span>
              <span className="font-mono font-semibold tabular-nums text-foreground">{row.a}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-4 right-4 text-sm font-semibold text-primary flex items-center gap-2">
        <Inbox className="h-4 w-4" /> 247 Belege · sortiert · 0 min Suchzeit
      </div>
    </div>
  );
}
