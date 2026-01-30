import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Database, Brain, Mail, Lock, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';

export default function Datenschutz() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 py-12">
        <div className="container max-w-4xl">
          <div className="mb-8">
            <Link to="/">
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Zurück zur Startseite
              </Button>
            </Link>
            <h1 className="text-4xl font-bold text-foreground mb-2">Datenschutzerklärung</h1>
            <p className="text-muted-foreground">Zuletzt aktualisiert: Januar 2025</p>
          </div>

          <div className="space-y-8">
            {/* Verantwortlicher */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  1. Verantwortlicher
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-muted-foreground">
                <p>Verantwortlicher für die Datenverarbeitung auf dieser Website:</p>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="font-medium text-foreground">Wilfried Winterauer</p>
                  <p>Gschwandt 48</p>
                  <p>4822 Bad Goisern, Österreich</p>
                  <p className="mt-2">
                    E-Mail: <a href="mailto:w.winterauer@gmail.com" className="text-primary hover:underline">w.winterauer@gmail.com</a>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Erhobene Daten */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  2. Welche Daten wir erheben
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground">
                <div>
                  <h4 className="font-medium text-foreground mb-2">Accountdaten</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>E-Mail-Adresse (für Login und Benachrichtigungen)</li>
                    <li>Name (optional, für Personalisierung)</li>
                    <li>Firmenname (optional, für Belege)</li>
                  </ul>
                </div>
                <Separator />
                <div>
                  <h4 className="font-medium text-foreground mb-2">Belegdaten</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Hochgeladene Belege (Bilder, PDFs)</li>
                    <li>Extrahierte Daten: Lieferant, Beträge, Datum, MwSt, Kategorie</li>
                    <li>Zahlungsmethode und Rechnungsnummern</li>
                    <li>Von Ihnen hinzugefügte Notizen und Tags</li>
                  </ul>
                </div>
                <Separator />
                <div>
                  <h4 className="font-medium text-foreground mb-2">Bankdaten (optional)</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Importierte Kontoumsätze (CSV-Upload)</li>
                    <li>IBAN und Kontoname (zur Zuordnung)</li>
                  </ul>
                </div>
                <Separator />
                <div>
                  <h4 className="font-medium text-foreground mb-2">E-Mail-Import (optional)</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>E-Mail-Anhänge mit Belegen</li>
                    <li>IMAP-Zugangsdaten (verschlüsselt gespeichert)</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Zweck der Verarbeitung */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  3. Zweck der Verarbeitung
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground">
                <div>
                  <h4 className="font-medium text-foreground mb-2">Hauptzwecke</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Bereitstellung der Belegverwaltungs-Dienste</li>
                    <li>KI-gestützte Extraktion von Belegdaten</li>
                    <li>Erstellung von Auswertungen und Exporten</li>
                    <li>Abgleich mit Bankumsätzen</li>
                  </ul>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
                  <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">KI-Verarbeitung</h4>
                  <p className="text-amber-700 dark:text-amber-300 text-sm">
                    Zur Extraktion von Belegdaten verwenden wir KI-Modelle (Google Gemini) über die Lovable Cloud. 
                    Die Bilddaten werden zur Analyse an diese Dienste übermittelt. Lovable ist DSGVO-konform 
                    und hat seinen Sitz in der EU (Stockholm, Schweden).
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Rechtsgrundlagen */}
            <Card>
              <CardHeader>
                <CardTitle>4. Rechtsgrundlagen (Art. 6 DSGVO)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-muted-foreground">
                <div className="flex gap-3">
                  <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-1 rounded h-fit">Art. 6 Abs. 1 lit. b</span>
                  <p>Vertragserfüllung – Bereitstellung der Dienste, die Sie nutzen</p>
                </div>
                <div className="flex gap-3">
                  <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-1 rounded h-fit">Art. 6 Abs. 1 lit. f</span>
                  <p>Berechtigtes Interesse – Verbesserung unserer Dienste, Betrugsprävention</p>
                </div>
                <div className="flex gap-3">
                  <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-1 rounded h-fit">Art. 6 Abs. 1 lit. c</span>
                  <p>Rechtliche Verpflichtung – Aufbewahrungspflichten für Buchhaltungsbelege</p>
                </div>
              </CardContent>
            </Card>

            {/* Datenspeicherung */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  5. Datenspeicherung und Sicherheit
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground">
                <div>
                  <h4 className="font-medium text-foreground mb-2">Speicherort</h4>
                  <p>
                    Alle Daten werden auf Servern der Lovable Cloud (basierend auf Supabase) gespeichert. 
                    Lovable hat seinen Hauptsitz in Stockholm, Schweden und ist vollständig DSGVO-konform.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">Sicherheitsmaßnahmen</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Verschlüsselte Übertragung (TLS/HTTPS)</li>
                    <li>Verschlüsselte Speicherung sensibler Daten (AES-GCM)</li>
                    <li>Row-Level Security für Datenzugriff</li>
                    <li>Regelmäßige Sicherheits-Updates</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">Speicherdauer</h4>
                  <p>
                    Ihre Daten werden gespeichert, solange Ihr Account aktiv ist. Nach Kontolöschung werden 
                    alle Daten innerhalb von 30 Tagen gelöscht. Ausnahme: Gesetzliche Aufbewahrungspflichten 
                    (z.B. 7 Jahre für Buchhaltungsbelege in AT/DE).
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Auftragsverarbeiter */}
            <Card>
              <CardHeader>
                <CardTitle>6. Auftragsverarbeiter</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground">
                <p>Wir arbeiten mit folgenden Dienstleistern zusammen:</p>
                <div className="space-y-3">
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="font-medium text-foreground">Lovable AB</p>
                    <p className="text-sm">Stockholm, Schweden</p>
                    <p className="text-sm">Zweck: Hosting, Datenspeicherung, KI-Verarbeitung</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="font-medium text-foreground">Google LLC (Gemini AI)</p>
                    <p className="text-sm">Zweck: KI-gestützte Belegextraktion</p>
                    <p className="text-sm">Hinweis: Verarbeitung über Lovable Cloud (EU)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ihre Rechte */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-primary" />
                  7. Ihre Rechte
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground">
                <p>Nach der DSGVO haben Sie folgende Rechte:</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="font-medium text-foreground text-sm">Auskunftsrecht</p>
                    <p className="text-xs">Welche Daten wir über Sie speichern</p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="font-medium text-foreground text-sm">Berichtigungsrecht</p>
                    <p className="text-xs">Korrektur unrichtiger Daten</p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="font-medium text-foreground text-sm">Löschungsrecht</p>
                    <p className="text-xs">"Recht auf Vergessenwerden"</p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="font-medium text-foreground text-sm">Datenübertragbarkeit</p>
                    <p className="text-xs">Export Ihrer Daten (CSV/Excel)</p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="font-medium text-foreground text-sm">Widerspruchsrecht</p>
                    <p className="text-xs">Gegen bestimmte Verarbeitungen</p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="font-medium text-foreground text-sm">Beschwerderecht</p>
                    <p className="text-xs">Bei der Datenschutzbehörde</p>
                  </div>
                </div>
                <p className="text-sm">
                  Kontaktieren Sie uns unter{' '}
                  <a href="mailto:w.winterauer@gmail.com" className="text-primary hover:underline">
                    w.winterauer@gmail.com
                  </a>{' '}
                  zur Ausübung Ihrer Rechte.
                </p>
              </CardContent>
            </Card>

            {/* Datenlöschung */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-primary" />
                  8. Datenlöschung
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground">
                <p>Sie können Ihre Daten jederzeit selbst löschen:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Einzelne Belege:</strong> In der Belegübersicht löschen</li>
                  <li><strong>Alle Belege:</strong> Über die Einstellungen</li>
                  <li><strong>Komplettes Konto:</strong> Kontaktieren Sie uns für die Löschung</li>
                </ul>
                <p className="text-sm bg-muted/50 p-3 rounded-lg">
                  <strong>Hinweis:</strong> Nach Löschung Ihres Kontos werden alle Daten innerhalb von 30 Tagen 
                  unwiderruflich gelöscht, sofern keine gesetzlichen Aufbewahrungspflichten bestehen.
                </p>
              </CardContent>
            </Card>

            {/* KI-Training Opt-Out */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  9. KI-Datennutzung und Opt-Out
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground">
                <p>
                  Die Lovable Cloud kann anonymisierte Daten zur Verbesserung der KI-Modelle verwenden. 
                  Sie können dies abwählen:
                </p>
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Opt-Out Möglichkeiten</h4>
                  <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300 text-sm">
                    <li>Kontaktieren Sie den Lovable Support unter support@lovable.dev</li>
                    <li>Business/Enterprise: Aktivieren Sie "Data collection opt out" in den Einstellungen</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Cookies */}
            <Card>
              <CardHeader>
                <CardTitle>10. Cookies und lokale Speicherung</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground">
                <p>Diese Website verwendet:</p>
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-foreground">Technisch notwendige Cookies</h4>
                    <p className="text-sm">Für Login-Sessions und Authentifizierung. Ohne diese funktioniert die App nicht.</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Lokale Speicherung (localStorage)</h4>
                    <p className="text-sm">Für Benutzereinstellungen wie Theme-Präferenzen und Filter-Einstellungen.</p>
                  </div>
                </div>
                <p className="text-sm bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 rounded-lg text-green-700 dark:text-green-300">
                  <strong>Keine Tracking-Cookies:</strong> Wir verwenden keine Analyse- oder Werbe-Cookies.
                </p>
              </CardContent>
            </Card>

            {/* Änderungen */}
            <Card>
              <CardHeader>
                <CardTitle>11. Änderungen dieser Erklärung</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                <p>
                  Wir behalten uns vor, diese Datenschutzerklärung bei Bedarf anzupassen, um sie an geänderte 
                  Rechtslagen oder bei Änderungen unserer Dienste anzupassen. Die aktuelle Version finden Sie 
                  immer auf dieser Seite.
                </p>
              </CardContent>
            </Card>

            {/* Kontakt */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  12. Kontakt für Datenschutzanfragen
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                <p className="mb-4">Bei Fragen zum Datenschutz erreichen Sie uns unter:</p>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="font-medium text-foreground">Wilfried Winterauer</p>
                  <p>E-Mail: <a href="mailto:w.winterauer@gmail.com" className="text-primary hover:underline">w.winterauer@gmail.com</a></p>
                </div>
                <p className="mt-4 text-sm">
                  <strong>Aufsichtsbehörde:</strong> Österreichische Datenschutzbehörde, Barichgasse 40-42, 1030 Wien
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
