import {
  Brain, Mail, Camera, RefreshCw, FileSpreadsheet, Shield, Smartphone,
  Landmark, FileText, Tags, Zap, Search, CloudUpload,
  Repeat, ArrowRightLeft, Scissors, CheckCheck, BarChart3,
  Percent, Download, Wifi, Inbox, Globe, Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BentoTile } from './BentoTile';
import { motion } from 'framer-motion';

// --- Hero feature: KI ---
function AIFeatureTile() {
  return (
    <BentoTile tone="primary" glow className="lg:col-span-3 lg:row-span-2 min-h-[360px] overflow-hidden flex flex-col justify-between">
      <div>
        <Badge className="bg-primary/15 text-primary border-primary/20 mb-4">
          <Sparkles className="h-3 w-3 mr-1" />
          Kernfunktion
        </Badge>
        <h3 className="text-3xl lg:text-4xl font-bold text-foreground leading-tight">
          Lernende KI-Erkennung
        </h3>
        <p className="mt-3 text-muted-foreground max-w-md">
          Extrahiert Lieferant, Betrag, MwSt-Satz, Datum & Rechnungsnummer in Sekunden — und wird mit jeder Korrektur klüger (Vendor-Learning).
        </p>
      </div>

      {/* Animated extraction preview */}
      <div className="relative mt-6 rounded-2xl border border-primary/15 bg-card/80 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
          <Brain className="h-4 w-4 text-primary" />
          <span className="font-mono">extracting…</span>
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        </div>
        <div className="space-y-2">
          {[
            { k: 'Lieferant', v: 'BILLA AG' },
            { k: 'Betrag', v: '€ 47,32' },
            { k: 'MwSt', v: '10 % / 20 %' },
            { k: 'Datum', v: '14.05.2026' },
          ].map((row, i) => (
            <motion.div
              key={row.k}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + i * 0.12, duration: 0.4 }}
              className="flex items-center justify-between text-sm font-mono"
            >
              <span className="text-muted-foreground">{row.k}</span>
              <span className="font-semibold text-foreground">{row.v}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </BentoTile>
  );
}

// --- Smaller feature tile factory ---
interface MiniFeature {
  icon: React.ElementType;
  title: string;
  description: string;
  tone?: 'default' | 'primary' | 'success' | 'warning';
  badge?: string;
  span?: string;
}

const miniFeatures: MiniFeature[] = [
  { icon: Inbox, title: 'E-Mail-Import', description: 'Eigene Import-Adresse. Belege per Weiterleitung empfangen — Gmail, Outlook, IMAP.', tone: 'default' },
  { icon: Landmark, title: 'Live-Bankanbindung', description: 'Open Banking — Bankbuchungen in Echtzeit synchronisieren.', tone: 'success', badge: 'Pro' },
  { icon: ArrowRightLeft, title: 'Auto-Reconciliation', description: 'KI matcht Belege ↔ Bank per Betrag, Datum und Lieferant.', tone: 'default' },
  { icon: FileText, title: 'Verkaufs-Workflow', description: 'Angebot → AB → Lieferschein → Rechnung. Nahtlos umwandelbar.', tone: 'warning', badge: 'Business' },
  { icon: Repeat, title: 'Wiederkehrend', description: 'Abo-Rechnungen monatlich, quartalsweise, jährlich automatisch.', tone: 'default', badge: 'Business' },
  { icon: Download, title: 'DATEV / BMD', description: 'Steuerberater-kompatible Exporte mit einem Klick.', tone: 'default', badge: 'Business' },
  { icon: Scissors, title: 'PDF-Splitting', description: 'Mehrseitige PDFs automatisch in einzelne Belege aufteilen.' },
  { icon: RefreshCw, title: 'Duplikat-Schutz', description: 'File-Hash erkennt doppelte Uploads sofort.' },
  { icon: CheckCheck, title: 'Auto-Approval', description: 'Hohe Confidence-Scores → automatische Freigabe.' },
  { icon: Tags, title: 'Tags & Kategorien', description: 'Farbige Tags und Kategorien für flexible Organisation.' },
  { icon: Search, title: 'Bank-Schlagwörter', description: 'Wiederkehrende Ausgaben per Schlagwort automatisch zuordnen.' },
  { icon: BarChart3, title: 'KPI-Dashboard', description: 'Ausgaben nach Monat, Kategorie & Status mit Trends.' },
];

const crossFeatures = [
  { icon: Shield, label: 'DSGVO-konform', sub: 'EU-Hosting' },
  { icon: Smartphone, label: 'PWA-App', sub: 'Offline-fähig' },
  { icon: Globe, label: 'Responsive', sub: 'Desktop · Tablet · Phone' },
  { icon: FileSpreadsheet, label: 'CSV/Excel/PDF', sub: 'Flexible Exporte' },
  { icon: CloudUpload, label: 'Cloud-Backup', sub: 'Drive · OneDrive', badge: 'Pro' },
  { icon: Zap, label: 'Onboarding', sub: 'Geführte Einrichtung' },
  { icon: Percent, label: 'Skonto & Rabatt', sub: 'Pro Kunde' },
  { icon: Wifi, label: 'IMAP-Sync', sub: 'Beliebiger Provider' },
];

export function FeaturesBento() {
  return (
    <section id="features" className="py-20 lg:py-28 bg-secondary/30">
      <div className="container">
        <div className="text-center mb-14 max-w-2xl mx-auto">
          <Badge variant="secondary" className="mb-4">Features</Badge>
          <h2 className="text-3xl sm:text-5xl font-bold text-foreground mb-4" style={{ textWrap: 'balance' }}>
            Was Monk alles kann.
          </h2>
          <p className="text-lg text-muted-foreground">
            Von KI-Erkennung über Bankabgleich und CRM bis zum kompletten Rechnungsmodul — BillMonk wächst mit deinem Unternehmen.
          </p>
        </div>

        {/* Main bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 lg:gap-5">
          <AIFeatureTile />

          {miniFeatures.map((f, i) => (
            <BentoTile
              key={f.title}
              tone={f.tone ?? 'default'}
              delay={0.05 + (i % 6) * 0.04}
              glow
              className="lg:col-span-3 xl:col-span-2 min-h-[180px] flex flex-col"
            >
              <div className="flex items-start gap-3 mb-2">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                  f.tone === 'success' ? 'bg-success/15 text-success' :
                  f.tone === 'warning' ? 'bg-warning/15 text-warning' :
                  f.tone === 'primary' ? 'bg-primary/15 text-primary' :
                  'bg-primary/10 text-primary'
                }`}>
                  <f.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-foreground">{f.title}</h4>
                    {f.badge && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                        {f.badge}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{f.description}</p>
            </BentoTile>
          ))}
        </div>

        {/* Cross-cutting */}
        <div className="mt-10">
          <p className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-5">
            In allen Tarifen enthalten
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {crossFeatures.map((c, i) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.04 }}
                className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-card/60"
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <c.icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-foreground truncate">{c.label}</p>
                    {c.badge && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-primary/30 text-primary">{c.badge}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{c.sub}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
