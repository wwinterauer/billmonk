import { 
  Brain, Mail, Camera, RefreshCw, FileSpreadsheet, Shield, Smartphone,
  Landmark, FileText, ClipboardList, Tags, Users, Zap, Building2, Search,
  CloudUpload, Keyboard, ReceiptText, UserCheck, Repeat, CreditCard, ArrowRightLeft,
  Scissors, CheckCheck, Filter, Ban, BarChart3, PenLine, Hash, Palette,
  Percent, Package, Briefcase, Timer, Download, Wifi, BookOpen,
  Inbox, Globe, FileDown
} from 'lucide-react';
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
    subtitle: 'Von der Erkennung bis zum Export — KI-gestützt und lernfähig.',
    accent: 'text-primary',
    iconBg: 'bg-primary/10 group-hover:bg-primary/20',
    borderAccent: 'border-primary/20',
    features: [
      { icon: Brain, title: 'Lernende KI-Erkennung', description: 'Extrahiert Lieferant, Betrag, MwSt und Datum — wird mit jeder Korrektur besser (Vendor-Learning).' },
      { icon: Camera, title: 'Multi-Upload & Kamera', description: 'PDFs, Fotos oder Kamera-Scan direkt per PWA. Mehrseitige PDFs werden erkannt.' },
      { icon: Scissors, title: 'PDF-Splitting', description: 'Mehrseitige PDFs automatisch in einzelne Belege aufteilen — mit Vorschau.' },
      { icon: RefreshCw, title: 'Duplikaterkennung', description: 'Automatische Warnung vor doppelt hochgeladenen Belegen per File-Hash.' },
      { icon: Keyboard, title: 'Review-Workflow', description: 'Effiziente Prüfung mit Tastatur-Navigation, Inline-Korrektur und Status-System.' },
      { icon: CheckCheck, title: 'Auto-Approval', description: 'Belege mit hohem Confidence-Score werden automatisch freigegeben.' },
      { icon: PenLine, title: 'Manuelle Einträge', description: 'Barbelege und Ausgaben ohne Beleg als "Kein-Beleg"-Eintrag erfassen.' },
      { icon: FileDown, title: 'Dateinamen & Beschreibungen', description: 'Individuelle Dateinamen-Muster und Beschreibungsvorlagen pro Beleg.' },
      { icon: Tags, title: 'Tags & Kategorien', description: 'Farbige Tags und Kategorien für flexible Organisation deiner Belege.' },
    ],
  },
  {
    label: 'ab Starter',
    title: 'Import-Kanäle',
    subtitle: 'Belege kommen automatisch rein — per E-Mail, Bank oder direkt vom Konto.',
    accent: 'text-chart-2',
    iconBg: 'bg-chart-2/10 group-hover:bg-chart-2/20',
    borderAccent: 'border-chart-2/20',
    features: [
      { icon: Inbox, title: 'E-Mail-Import (Webhook)', description: 'Eigene Import-Adresse generieren — Belege per Weiterleitung empfangen.' },
      { icon: Mail, title: 'Gmail & Outlook Sync', description: 'OAuth-basierte Anbindung an Gmail und Microsoft 365 für automatischen Abruf.' },
      { icon: Wifi, title: 'IMAP-Import', description: 'Beliebigen E-Mail-Provider per IMAP verbinden — mit Ordner- und Intervall-Konfiguration.' },
      { icon: Building2, title: 'CSV-Bankimport', description: 'Kontoauszüge als CSV importieren und Buchungen mit Belegen matchen.' },
      { icon: Landmark, title: 'Live-Bankanbindung', description: 'Open-Banking-Anbindung für Echtzeit-Synchronisation deiner Konten.', planBadge: 'Pro' },
      { icon: Filter, title: 'Absender-Filter', description: 'Nur Belege von bestimmten Absendern importieren — mit Stichwort-Filtern.' },
      
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
      { icon: ArrowRightLeft, title: 'Automatisches Matching', description: 'Beleg-↔-Bank Zuordnung per Betrag, Datum und Lieferantenname.' },
      { icon: Zap, title: 'Auto-Reconciliation', description: 'KI-basiertes Matching — weniger manuelle Zuordnung, mehr Übersicht.' },
      { icon: Search, title: 'Bank-Schlagwörter', description: 'Regelmäßige Ausgaben per Schlagwort automatisch kategorisieren und MwSt zuordnen.' },
      { icon: BarChart3, title: 'KPI-Dashboard', description: 'Ausgaben nach Monat, Kategorie und Status — mit Diagrammen und Trends.' },
    ],
  },
  {
    label: 'Business',
    title: 'Rechnungen & Verkaufs-Workflow',
    subtitle: 'Vom Angebot bis zur bezahlten Rechnung — der komplette Dokumenten-Kreislauf.',
    accent: 'text-warning',
    iconBg: 'bg-warning/10 group-hover:bg-warning/20',
    borderAccent: 'border-warning/20',
    features: [
      { icon: FileText, title: 'Ausgangsrechnungen', description: 'Professionelle Rechnungen mit automatischer Nummerierung und PDF-Generierung.' },
      { icon: ClipboardList, title: 'AG → AB → LS → RE', description: 'Angebote, Auftragsbestätigungen und Lieferscheine — nahtlos ineinander umwandelbar.' },
      { icon: CreditCard, title: 'Teilrechnungen', description: 'Anzahlungs-, Teil- und Schlussrechnungen mit automatischer Verrechnung.' },
      { icon: Repeat, title: 'Wiederkehrende Rechnungen', description: 'Abo-Rechnungen automatisch generieren — monatlich, quartalsweise oder jährlich.' },
      { icon: ReceiptText, title: 'Gutschriften', description: 'Stornobelege mit Referenz zur Originalrechnung erstellen.' },
      { icon: Hash, title: 'Nummernkreise', description: 'Konfigurierbare Präfixe und Formate für Rechnungs-, Angebots- und Kundennummern.' },
      { icon: Palette, title: 'PDF-Layout & Logo', description: 'Eigenes Logo, Layout-Varianten und Fußzeilen für professionelle Dokumente.' },
      { icon: Percent, title: 'Skonto & Rabatt', description: 'Skonto-Tage, Rabatt-Prozent und individuelle Zahlungsbedingungen pro Kunde.' },
      { icon: Package, title: 'Artikelgruppen', description: 'Positionen in Gruppen organisieren — mit Zwischensummen und optionalen Bildern.' },
    ],
  },
  {
    label: 'Business',
    title: 'CRM & Stammdaten',
    subtitle: 'Kunden, Artikel und Firmendaten zentral verwalten.',
    accent: 'text-chart-4',
    iconBg: 'bg-chart-4/10 group-hover:bg-chart-4/20',
    borderAccent: 'border-chart-4/20',
    features: [
      { icon: UserCheck, title: 'Kundenverwaltung', description: 'Kontaktdaten, UID-Nummer, Zahlungsbedingungen und abweichende Lieferadressen.' },
      { icon: BookOpen, title: 'Artikelvorlagen', description: 'Wiederverwendbare Artikel mit Preis, Einheit, USt-Satz und optionalem Bild.' },
      { icon: Briefcase, title: 'Firmendaten', description: 'Eigene Firmendaten für Rechnungskopf, Bankverbindung und Kleinunternehmer-Regelung.' },
    ],
  },
];

const crossFeatures: Feature[] = [
  { icon: Users, title: 'Lieferanten-Lernen', description: 'Korrekturen merken und bei neuen Belegen anwenden.' },
  { icon: Shield, title: 'DSGVO-konform', description: 'EU-Hosting, verschlüsselt, 7–10 Jahre archiviert.' },
  { icon: Smartphone, title: 'PWA-App', description: 'Installierbar auf Handy & Desktop, offline-fähig.' },
  { icon: Globe, title: 'Responsive Design', description: 'Optimiert für Desktop, Tablet und Smartphone.' },
  { icon: FileSpreadsheet, title: 'Flexible Exporte', description: 'CSV, Excel, PDF und ZIP-Download.' },
  { icon: Download, title: 'DATEV / BMD Export', description: 'Steuerberater-kompatible Formate.', planBadge: 'Business' },
  { icon: CloudUpload, title: 'Cloud-Backup', description: 'Google Drive mit konfigurierbarem Zeitplan.', planBadge: 'Pro' },
  { icon: Timer, title: 'Onboarding-Assistent', description: 'Geführte Einrichtung für schnellen Start.' },
];

function FeatureBlockSection({ block, index }: { block: FeatureBlock; index: number }) {
  return (
    <div className="mb-16 last:mb-0">
      <div className="flex items-center gap-3 mb-2">
        <h3 className="text-2xl font-bold text-foreground">{block.title}</h3>
        <Badge variant="outline" className={`${block.borderAccent} ${block.accent} text-xs`}>
          {block.label}
        </Badge>
      </div>
      <p className="text-muted-foreground mb-6 max-w-2xl">{block.subtitle}</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {block.features.map((feature) => (
          <Card key={feature.title} className="h-full border-border/50 bg-card hover:shadow-md hover:border-primary/15 transition-[box-shadow,border-color] duration-300 group">
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
        ))}
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section id="features" className="py-20 lg:py-28 bg-secondary/30">
      <div className="container">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">Features</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4" style={{ textWrap: 'balance' }}>
            Was Monk alles kann.
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" style={{ textWrap: 'pretty' }}>
            Von der KI-Erkennung über Bankabgleich und CRM bis zum kompletten Rechnungsmodul — BillMonk wächst mit deinem Unternehmen.
          </p>
        </div>

        {featureBlocks.map((block, index) => (
          <FeatureBlockSection key={block.title} block={block} index={index} />
        ))}

        {/* Cross-cutting features */}
        <div className="mt-16">
          <h3 className="text-xl font-bold text-foreground mb-6 text-center">In allen Tarifen enthalten</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {crossFeatures.map((feature) => (
              <Card key={feature.title} className="h-full border-border/50 bg-card hover:shadow-md transition-[box-shadow] duration-300 text-center group">
                <CardContent className="p-4 flex flex-col items-center">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center mb-3 transition-colors">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <h4 className="font-semibold text-foreground text-sm">{feature.title}</h4>
                    {feature.planBadge && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                        {feature.planBadge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
