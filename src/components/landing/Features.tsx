import { 
  Brain, Mail, Camera, RefreshCw, FileCheck, FileSpreadsheet, Shield, Smartphone,
  Landmark, FileText, ClipboardList, Tags, Users, Zap, Building2, Search,
  CloudUpload, Keyboard, ReceiptText, UserCheck, Repeat, CreditCard, ArrowRightLeft
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
  planBadge?: string;
}

interface FeatureBlock {
  label: string;
  title: string;
  subtitle: string;
  accent: string;
  iconBg: string;
  borderAccent: string;
  features: Feature[];
}

const featureBlocks: FeatureBlock[] = [
  {
    label: 'Kernfunktion',
    title: 'Intelligente Belegverwaltung',
    subtitle: 'Von der Erkennung bis zum Steuerberater-Export — vollautomatisch.',
    accent: 'text-primary',
    iconBg: 'bg-primary/10 group-hover:bg-primary/20',
    borderAccent: 'border-primary/20',
    features: [
      { icon: Brain, title: 'Lernende KI-Erkennung', description: 'Extrahiert Lieferant, Betrag, MwSt und Datum — wird mit jeder Korrektur besser.' },
      { icon: Camera, title: 'Multi-Upload', description: 'PDFs, Fotos oder Kamera. Mehrseitige PDFs werden automatisch aufgeteilt.' },
      { icon: Mail, title: 'E-Mail Import', description: 'Gmail oder Outlook verbinden — Rechnungen aus Anhängen automatisch importiert.', planBadge: 'Starter' },
      { icon: RefreshCw, title: 'Duplikaterkennung', description: 'Automatische Warnung vor doppelt hochgeladenen Belegen.' },
      { icon: Keyboard, title: 'Review-Workflow', description: 'Effiziente Prüfung mit Tastatur-Navigation und direkter Korrektur.' },
      { icon: FileSpreadsheet, title: 'Flexible Exporte', description: 'CSV, Excel, PDF — mit anpassbaren Vorlagen für DATEV, BMD oder deinen Steuerberater.' },
      { icon: CloudUpload, title: 'Cloud-Backup', description: 'Automatische Sicherung nach Google Drive mit konfigurierbarem Zeitplan.', planBadge: 'Starter' },
    ],
  },
  {
    label: 'ab Starter',
    title: 'Banking & Kontoabgleich',
    subtitle: 'Bankbuchungen und Belege automatisch zusammenführen.',
    accent: 'text-success',
    iconBg: 'bg-success/10 group-hover:bg-success/20',
    borderAccent: 'border-success/20',
    features: [
      { icon: Building2, title: 'Bank-Import (CSV)', description: 'Kontoauszüge als CSV importieren und mit vorhandenen Belegen matchen.' },
      { icon: Search, title: 'Schlagwort-Automatisierung', description: 'Regelmäßige Ausgaben automatisch kategorisieren und MwSt zuordnen.' },
      { icon: Landmark, title: 'Live-Bankanbindung', description: 'Open-Banking-Anbindung für Echtzeit-Synchronisation deiner Buchungen.', planBadge: 'Pro' },
      { icon: ArrowRightLeft, title: 'Auto-Reconciliation', description: 'Belege und Bankbuchungen werden automatisch gematcht — weniger Handarbeit.' },
    ],
  },
  {
    label: 'Business',
    title: 'Rechnungen & Geschäftsdokumente',
    subtitle: 'Vom Angebot bis zur bezahlten Rechnung — der komplette Verkaufs-Workflow.',
    accent: 'text-warning',
    iconBg: 'bg-warning/10 group-hover:bg-warning/20',
    borderAccent: 'border-warning/20',
    features: [
      { icon: FileText, title: 'Ausgangsrechnungen', description: 'Professionelle Rechnungen erstellen mit automatischer Nummerierung und PDF-Versand.' },
      { icon: ClipboardList, title: 'Angebote, AB & Lieferscheine', description: 'Angebote, Auftragsbestätigungen und Lieferscheine — nahtlos ineinander umwandelbar.' },
      { icon: UserCheck, title: 'CRM & Kundenverwaltung', description: 'Kundenstammdaten, Nummernkreise, Zahlungsbedingungen und Lieferadressen.' },
      { icon: Repeat, title: 'Wiederkehrende Rechnungen', description: 'Abo-Rechnungen automatisch generieren lassen — monatlich, quartalsweise oder jährlich.' },
      { icon: CreditCard, title: 'Anzahlungs- & Teilrechnungen', description: 'Anzahlungen, Teilrechnungen und Schlussrechnungen mit automatischer Verrechnung.' },
      { icon: ReceiptText, title: 'Gutschriften & Mahnwesen', description: 'Stornobelege erstellen und überfällige Rechnungen automatisch erinnern.' },
    ],
  },
];

const crossFeatures: Feature[] = [
  { icon: Users, title: 'Lieferanten-Lernen', description: 'Die KI merkt sich Korrekturen pro Lieferant und wendet sie bei neuen Belegen an.' },
  { icon: Tags, title: 'Kategorien & Tags', description: 'Organisiere Belege und Rechnungen mit eigenen Kategorien und farbigen Tags.' },
  { icon: Smartphone, title: 'Mobile-Ready', description: 'Responsive Design für Desktop, Tablet und Smartphone — auch als PWA installierbar.' },
  { icon: Shield, title: 'DSGVO-konform', description: 'Daten sicher in der EU gespeichert, verschlüsselt übertragen, 7 Jahre archiviert.' },
  { icon: Zap, title: 'Schnelle Verarbeitung', description: 'KI-Analyse in Sekunden — keine Wartezeiten, sofortige Ergebnisse.' },
];

function FeatureBlockSection({ block, index }: { block: FeatureBlock; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="mb-16 last:mb-0"
    >
      <div className="flex items-center gap-3 mb-2">
        <h3 className={`text-2xl font-bold text-foreground`}>{block.title}</h3>
        <Badge variant="outline" className={`${block.borderAccent} ${block.accent} text-xs`}>
          {block.label}
        </Badge>
      </div>
      <p className="text-muted-foreground mb-6 max-w-2xl">{block.subtitle}</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {block.features.map((feature, fi) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: fi * 0.05, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card className="h-full border-border/50 bg-card hover:shadow-md hover:border-primary/15 transition-[box-shadow,border-color] duration-300 group">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg ${block.iconBg} flex items-center justify-center shrink-0 transition-colors`}>
                    <feature.icon className={`h-5 w-5 ${block.accent}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-foreground">{feature.title}</h4>
                      {feature.planBadge && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary shrink-0">
                          {feature.planBadge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export function Features() {
  return (
    <section id="features" className="py-20 lg:py-28 bg-secondary/30">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <Badge variant="secondary" className="mb-4">Features</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4" style={{ textWrap: 'balance' }}>
            Alles für deine Belegverwaltung — und darüber hinaus
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" style={{ textWrap: 'pretty' }}>
            Von der automatischen Erkennung über Bankabgleich bis zum kompletten Rechnungsmodul — XpenzAi wächst mit deinem Unternehmen.
          </p>
        </motion.div>

        {featureBlocks.map((block, index) => (
          <FeatureBlockSection key={block.title} block={block} index={index} />
        ))}

        {/* Cross-cutting features */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mt-16"
        >
          <h3 className="text-xl font-bold text-foreground mb-6 text-center">In allen Tarifen enthalten</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {crossFeatures.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              >
                <Card className="h-full border-border/50 bg-card hover:shadow-md transition-[box-shadow] duration-300 text-center group">
                  <CardContent className="p-4 flex flex-col items-center">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center mb-3 transition-colors">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h4 className="font-semibold text-foreground text-sm mb-1">{feature.title}</h4>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
