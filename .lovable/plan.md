

# Plan: Info-Tooltips und Detail-Dialog für Steuer-Kategorien

## Überblick
Jede Steuer-Kategorie bekommt ein Info-Icon in der Tabelle. Beim Mouseover erscheint eine Kurzinfo (Tooltip), was in diese Kategorie gehört. Beim Klick auf das Icon öffnet sich ein Dialog mit der vollständigen steuerrechtlichen Beschreibung.

## 1. Daten-Mapping (im Code, kein DB-Change)

Neues konstantes Objekt `TAX_CATEGORY_INFO` in `CategoryManagement.tsx`, das pro Kategoriename eine Kurzinfo und Langinfo enthält. Basierend auf:

- **AT**: EStG, EAR-Verordnung
- **DE**: EStG §4, §9, SKR03-Kontenrahmen
- **CH**: OR, KMU-Kontenrahmen

Beispiel-Einträge:

| Kategorie | Kurzinfo (Tooltip) | Langinfo (Dialog) |
|---|---|---|
| Bewirtung 50% (AT) | Geschäftsessen, Bewirtung von Kunden/Partnern. 50% absetzbar. | Gem. §20 EStG: Bewirtungsaufwendungen aus geschäftlichem Anlass. Nur 50% absetzbar. Voraussetzung: Beleg mit Datum, Ort, Teilnehmer, geschäftlicher Anlass. Trinkgeld bis 10% angemessen. |
| Reisekosten (AT) | Fahrtkosten, Nächtigungen, Diäten bei Geschäftsreisen. | Gem. §16/§4 EStG: Kilometergeld (0,42€/km PKW), Nächtigungspauschale, Tagesdiäten (26,40€ Inland). Reise = mind. 25km, mind. 3h. |
| KFZ-Kosten (AT) | Treibstoff, Reparaturen, Versicherung, Maut, Parkgebühren. | Betriebliche KFZ-Kosten inkl. Treibstoff, Service, Reparaturen, Versicherung, Vignette, Maut, Parkgebühren. Bei gemischter Nutzung: Fahrtenbuch oder km-Pauschale. Luxustangente beachten (40.000€ Anschaffungskosten). |
| ... | ... | ... |

Insgesamt ~43 Einträge (15 AT + 15 DE + 13 CH).

## 2. UI-Änderungen in CategoryManagement.tsx

### Tabelle
- Neben dem Kategorienamen (bei System-Kategorien mit `country`): kleines Info-Icon (`Info` aus lucide-react)
- **Hover** auf das Icon → Tooltip mit Kurzinfo (via Radix Tooltip, bereits im Projekt vorhanden)
- **Klick** auf das Icon → Dialog mit vollständiger Info (Überschrift, Steuernummer, gesetzliche Grundlage, Liste erlaubter Ausgaben, Hinweise)

### Info-Dialog
- Titel: Kategoriename + Flagge
- Steuernummer als Badge
- Abschnitt "Was gehört hierher?" mit Aufzählung
- Abschnitt "Gesetzliche Grundlage" mit Paragraphen-Verweis
- Abschnitt "Hinweise" mit Absetzbarkeits-Regeln

## 3. Neue Imports

- `Info` Icon aus lucide-react
- `Tooltip, TooltipTrigger, TooltipContent, TooltipProvider` aus `@/components/ui/tooltip`

## Dateien

| Datei | Änderung |
|---|---|
| `CategoryManagement.tsx` | TAX_CATEGORY_INFO Konstante, Info-Icon mit Tooltip + Detail-Dialog |

Keine Datenbank-Änderungen nötig.

