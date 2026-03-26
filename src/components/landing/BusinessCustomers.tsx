import { Building2, Briefcase, Store, ArrowRightLeft, FileText, Landmark, Brain } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const useCases = [
  {
    icon: Store,
    persona: 'Kleinunternehmer & EPU',
    headline: 'Belege, Bank und Rechnungen in einer Oberfläche',
    description: 'Kein Jonglieren mehr zwischen Excel, E-Mail und Ordner. Importiere Bankbuchungen, gleiche sie mit Belegen ab und erstelle Rechnungen — alles an einem Ort.',
    features: ['Bankimport & Auto-Reconciliation', 'Lernende KI wird mit jeder Korrektur besser', 'Ab € 2,99/Monat'],
  },
  {
    icon: Building2,
    persona: 'KMU (bis 10 Mitarbeiter)',
    headline: 'Vom Angebot zur bezahlten Rechnung — lückenlos',
    description: 'Der komplette Dokumenten-Kreislauf: Angebote, Auftragsbestätigungen, Lieferscheine und Rechnungen nahtlos ineinander umwandeln.',
    features: ['AG → AB → LS → RE Workflow', 'Wiederkehrende Rechnungen', 'Kundenverwaltung & Artikelstamm'],
  },
  {
    icon: Briefcase,
    persona: 'Steuerberater-Zuarbeit',
    headline: 'Export-fertig vorbereitet — dein Steuerberater wird dich lieben',
    description: 'Alle Belege kategorisiert, mit MwSt-Satz, im richtigen Format. Einfach exportieren und übergeben — kein Schuhkarton mehr.',
    features: ['DATEV/BMD-kompatible Exporte', 'Monats- und Jahresberichte', 'Checklisten für Jahresabschluss'],
  },
];

export function BusinessCustomers() {
  return (
    <section className="py-20 lg:py-28 bg-secondary/30">
      <div className="container">
        <div className="text-center mb-14">
          <Badge variant="secondary" className="mb-4 bg-warning/10 text-warning border-warning/20">
            Für Unternehmen
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4" style={{ textWrap: 'balance' }}>
            Alles was ein Kleinunternehmen braucht — nichts was es nicht braucht.
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" style={{ textWrap: 'pretty' }}>
            BillMonk ersetzt keine Buchhaltungssoftware — sondern macht die Vorarbeit, die bisher niemand gerne macht. Perfekt für Einnahmen-Ausgaben-Rechner in AT, DE und CH.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {useCases.map((useCase) => (
            <Card key={useCase.persona} className="h-full border-border/50 bg-card hover:shadow-lg hover:border-warning/20 transition-all duration-300">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center mb-4">
                  <useCase.icon className="h-6 w-6 text-warning" />
                </div>
                <Badge variant="outline" className="mb-3 text-xs border-warning/30 text-warning">
                  {useCase.persona}
                </Badge>
                <h3 className="text-lg font-semibold text-foreground mb-2">{useCase.headline}</h3>
                <p className="text-sm text-muted-foreground mb-4">{useCase.description}</p>
                <ul className="space-y-2">
                  {useCase.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Brain className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
