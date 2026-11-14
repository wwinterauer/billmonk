# BillMonk als private Ausgaben-Plattform

## Ziel
BillMonk wird zu deinem rein privaten Werkzeug für Ausgaben. Alles für fremde Nutzer und Verkauf wird ausgeblendet. Die Daten bleiben gespeichert und lassen sich später wiederherstellen.

## Wichtiger Hinweis zur Anmeldung
Die App ist weiterhin über billmonk.ai und die lovable.app-Adresse im Internet erreichbar. Auch ohne „Veröffentlichen“ bleibt die zuletzt veröffentlichte Version online. Ohne Anmeldung könnte jeder mit dem Link deine Belege sehen.
Auch der Zugriff für Claude/Grok (MCP) braucht eine Anmeldung: Das Assistenten-Programm meldet sich einmal mit deinem Konto an und sieht dann nur deine Daten.

Daher der Vorschlag:
- Keine Registrierung, kein Beta-Code, keine Abos, keine Werbeseiten.
- Nur eine schlichte Anmeldemaske für dein Konto. Du bleibst dauerhaft angemeldet und siehst sie praktisch nie.
- Eine echte „Kein Login“-Variante setze ich nicht um, weil deine Belege sonst öffentlich wären.

## Was bleibt
- Dashboard (öffnet sich direkt als Startseite)
- Upload, Review, Ausgaben, Lieferanten
- Bank-Import und Kontoabgleich
- E-Mail-Import von Belegen
- Cloud-Backup (Google Drive)
- Checklisten und Berichte/Export
- Einstellungen (nur Bereiche, die zu Ausgaben gehören)

## Was ausgeblendet wird
- Angebote, Auftragsbestätigungen, Lieferscheine, Ausgangsrechnungen, Artikel
- Kunden, CRM, Mitglieder, Newsletter
- Firmen-/Rechnungseinstellungen (Briefpapier, Nummernkreise, Mahnungen)
- Startseite, Preise, Beta-Seite, Registrierung, Passwort vergessen, Onboarding
- Abo, Tarife, Credits, Upgrade-Hinweise, gesperrte Funktionen (alles freigeschaltet)
- Admin-Bereich, Support-Tickets, Datenschutz- und Abmeldeseiten
- Willkommens-Mail bei Registrierung

## Zugriff für Claude/Grok (MCP)
- Bestehender Zugang bleibt, Name „BillMonk“.
- Kunden- und Rechnungs-Werkzeuge werden entfernt.
- Behalten: Belege auflisten, Lieferanten, Ausgabenübersicht.
- Neu: Beleg im Detail lesen, Belege nach Lieferant/Betrag/Zeitraum suchen, Kontobewegungen und offene Abgleiche auflisten.
- Claude unterstützt das direkt. Bei Grok ist nicht sicher, ob es MCP mit Anmeldung unterstützt; das kann ich nicht garantieren.
- Damit der Zugang funktioniert, muss die App einmal veröffentlicht werden. Das macht sie nicht für andere nutzbar, weil Registrierung entfällt.

## Technische Details
- Routen in `App.tsx` entfernen; `/` leitet auf `/dashboard`, unbekannte Routen ebenfalls. `BetaGate`, Onboarding-Pflicht und Admin-Route entfernen.
- `Login.tsx` vereinfachen (E-Mail/Passwort, keine Links auf Registrierung/Beta). OAuth-Consent-Route und `next`-Weiterleitung bleiben für MCP.
- Sidebar und Einstellungs-Tabs auf die verbleibenden Bereiche reduzieren.
- `usePlan` liefert immer vollen Zugriff; Upgrade-/Lock-UI und Credit-Zähler im Frontend entfernen. Edge Functions mit Plan-Prüfung (z. B. Extraktion) so anpassen, dass keine Credit-Limits mehr blockieren.
- Seiten-/Komponentendateien der entfernten Module löschen; Datenbanktabellen, Daten und Speicher bleiben unverändert.
- Trigger `on_profile_created_send_welcome` deaktivieren; Signups in der Auth-Konfiguration abschalten.
- Stripe-/Abo-Functions (check-subscription, checkout, webhook) entfernen bzw. nicht mehr aufrufen; Secrets bleiben vorerst bestehen.
- MCP: `list-customers.ts`, `list-invoices.ts` entfernen, neue Lese-Tools ergänzen, Manifest neu erzeugen.
- Vorhandene Tests anpassen, `AGENTS.md` und Projektgedächtnis (private Nutzung, keine Abos) aktualisieren.
