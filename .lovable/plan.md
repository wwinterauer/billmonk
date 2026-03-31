

# PWA Scan-App-Tipp + Installationshinweis verbessern

## Übersicht

Drei Änderungen: (1) Scan-App-Tipp in Email-Import-Einstellungen, (2) Scan-Hinweis auf Upload-Seite, (3) InstallPrompt verbessern mit iOS-Fallback und nur auf Mobilgeräten + eingeloggt.

## Änderungen

### 1. `src/components/settings/EmailImportSettings.tsx`

Nach der Import-Adresse (nach Zeile 460, nach dem `<p>` mit "Leiten Sie Rechnungs-E-Mails...") einen Collapsible-Bereich einfügen:

- Import: `Collapsible, CollapsibleTrigger, CollapsibleContent` aus `@/components/ui/collapsible`
- Import: `Smartphone, ChevronDown` Icons
- Collapsible mit Trigger "Tipp: Belege per Scan-App importieren" (mit Smartphone-Icon)
- Content: Zwei Absätze (Android Share + Email-Methode), Email-Adresse aus `emailConnection.import_email` inline anzeigen

### 2. `src/pages/Upload.tsx`

Nach dem Upload-Dropzone-Card (nach Zeile 1076, nach `</Card></motion.div>`) und vor dem Cloud Import Block:

- Import: `Smartphone` Icon, `useNavigate` (bereits vorhanden)
- Dezenter Alert/Banner in muted Farben mit Smartphone-Icon
- Text: "Du bist unterwegs? Scanne Belege mit deiner Scan-App und teile sie direkt an BillMonk."
- Link-Button "Mehr erfahren" → `navigate('/settings?tab=email-import')`

### 3. `src/components/pwa/InstallPrompt.tsx` — Erweitern

- Import `useIsMobile` und `useAuth`
- Nur anzeigen wenn: Mobile + eingeloggt + nicht standalone + nicht dismissed
- iOS-Erkennung: Wenn `installPrompt` null ist (kein `beforeinstallprompt` auf iOS), zeige Alternativtext: "Tippe auf das Teilen-Symbol und dann 'Zum Home-Bildschirm'"
- Erweiterte Beschreibung: "für schnelleren Zugriff und Beleg-Import per Teilen-Funktion"
- Landing-Page ausschließen: `useLocation()`, return null wenn `pathname === '/'`

### 4. `src/App.tsx` — Keine Änderung nötig

`InstallPrompt` ist bereits global eingebunden (Zeile 220). Die Landing-Page-Ausschlusslogik wird intern in der Komponente behandelt.

### Dateien
- `src/components/settings/EmailImportSettings.tsx`
- `src/pages/Upload.tsx`
- `src/components/pwa/InstallPrompt.tsx`

