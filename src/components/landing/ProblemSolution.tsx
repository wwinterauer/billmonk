import { X, Check, Clock, AlertTriangle, FileWarning, FolderSearch, Brain, Zap, Shield, TrendingUp, FileX, Unplug } from 'lucide-react';

const problems = [
  { icon: Clock, text: 'Stundenlang Belege abtippen' },
  { icon: FileWarning, text: 'Belege verloren oder unleserlich' },
  { icon: FolderSearch, text: 'Keine Übersicht über Ausgaben' },
  { icon: AlertTriangle, text: 'Steuerberater-Panik vor dem Jahresende' },
  { icon: FileX, text: 'Angebote in Word, Rechnungen in Excel' },
  { icon: Unplug, text: 'Kein Zusammenhang zwischen Bank und Belegen' },
];

const solutions = [
  { icon: Zap, text: 'KI erkennt alles in Sekunden' },
  { icon: Shield, text: 'Sicher archiviert in der Cloud' },
  { icon: TrendingUp, text: 'Echtzeit-Überblick über alle Ausgaben' },
  { icon: Brain, text: 'Export-fertig für den Steuerberater' },
  { icon: Check, text: 'Kompletter Verkaufs-Workflow in einer Plattform' },
  { icon: Check, text: 'Bankabgleich und Auto-Reconciliation' },
];

export function ProblemSolution() {
  return (
    <section className="py-20 lg:py-28 bg-background">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4" style={{ textWrap: 'balance' }}>
            Schluss mit dem Belegchaos
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" style={{ textWrap: 'pretty' }}>
            Manuelle Belegverwaltung und Insellösungen kosten Zeit und Nerven. XpenzAi bringt alles in eine Plattform.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
          {/* Problems */}
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 lg:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <X className="h-5 w-5 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Ohne XpenzAi</h3>
            </div>
            <ul className="space-y-4">
              {problems.map((item) => (
                <li key={item.text} className="flex items-start gap-3">
                  <item.icon className="h-5 w-5 text-destructive/70 mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Solutions */}
          <div className="rounded-2xl border border-success/20 bg-success/5 p-6 lg:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <Check className="h-5 w-5 text-success" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Mit XpenzAi</h3>
            </div>
            <ul className="space-y-4">
              {solutions.map((item) => (
                <li key={item.text} className="flex items-start gap-3">
                  <item.icon className="h-5 w-5 text-success mt-0.5 shrink-0" />
                  <span className="text-foreground">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
