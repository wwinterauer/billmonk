import { User, Home, Receipt, Camera, Tags, FileSpreadsheet, Shield, Brain } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const useCases = [
  {
    icon: User,
    persona: 'Freelancer & EPU',
    headline: 'Belege laufend erfassen statt Jahresend-Stress',
    description: 'Fotografiere Belege unterwegs, lass die KI den Rest machen. Am Jahresende ist alles schon sortiert und exportfertig für den Steuerberater.',
    features: ['Kamera-Upload per PWA', 'KI-Erkennung von Betrag & MwSt', 'CSV/Excel-Export für den Steuerberater'],
  },
  {
    icon: Home,
    persona: 'Private Vermieter',
    headline: 'Handwerker, Hausverwaltung, Versicherung — alles an einem Ort',
    description: 'Sammle alle Belege rund um deine Immobilie, ordne sie nach Objekt und Kategorie und hab beim Steuererklärung-Termin alles parat.',
    features: ['Tags pro Objekt/Wohnung', 'Jahresübersicht mit Kategorien', 'Sichere Cloud-Archivierung'],
  },
  {
    icon: Receipt,
    persona: 'Privatpersonen',
    headline: 'Garantiebelege, Versicherungen & Co. digital archivieren',
    description: 'Nie wieder Kassenzettel suchen wenn die Garantie greift. Scanne Belege ein und finde sie per Suche in Sekunden wieder.',
    features: ['Kostenlos starten (10 Belege/Monat)', 'Volltextsuche über alle Belege', 'DSGVO-konform in der EU gehostet'],
  },
];

export function PrivateCustomers() {
  return (
    <section className="py-20 lg:py-28 bg-background">
      <div className="container">
        <div className="text-center mb-14">
          <Badge variant="secondary" className="mb-4 bg-primary/10 text-primary border-primary/20">
            Für Privatpersonen & Freelancer
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4" style={{ textWrap: 'balance' }}>
            Ordnung ohne Aufwand — auch ohne Buchhaltungswissen.
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" style={{ textWrap: 'pretty' }}>
            Egal ob du als Freelancer Belege sammelst, Mieteinnahmen dokumentierst oder einfach deine Kassenzettel archivieren willst — BillMonk macht's einfach.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {useCases.map((useCase) => (
            <Card key={useCase.persona} className="h-full border-border/50 bg-card hover:shadow-lg hover:border-primary/20 transition-all duration-300">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <useCase.icon className="h-6 w-6 text-primary" />
                </div>
                <Badge variant="outline" className="mb-3 text-xs border-primary/30 text-primary">
                  {useCase.persona}
                </Badge>
                <h3 className="text-lg font-semibold text-foreground mb-2">{useCase.headline}</h3>
                <p className="text-sm text-muted-foreground mb-4">{useCase.description}</p>
                <ul className="space-y-2">
                  {useCase.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Brain className="h-4 w-4 text-primary mt-0.5 shrink-0" />
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
