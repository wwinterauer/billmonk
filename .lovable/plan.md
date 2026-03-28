

# Plan: Länderspezifische Kategorie-Zuordnungshilfe im KI-Prompt

## Ziel
Die automatische Kategorie-Erkennung der KI verbessern, indem länderspezifische Zuordnungsregeln (typische Lieferanten, Schlüsselwörter, Ausnahmen) direkt in den Extraction-Prompt injiziert werden.

## Problem heute
Der Prompt übergibt nur eine kommaseparierte Liste von Kategorienamen:
```
"category": "Wähle die passendste Kategorie aus dieser Liste: Bewirtung 50% (AT), Reisekosten (AT), KFZ-Kosten (AT), ..."
```
Die KI hat keinerlei Kontext, welche Ausgaben zu welcher Kategorie gehören. Bei ähnlich klingenden Kategorien (z.B. "Büromaterial" vs "Geringwertige WG") oder länderspezifischen Besonderheiten (Bewirtung 50% AT vs 70% DE) rät sie oft falsch.

## Lösung
Einen neuen Prompt-Block `KATEGORIE-ZUORDNUNGSHILFE` einfügen, der basierend auf dem User-Land (aus `profiles.country`) länderspezifische Mapping-Regeln enthält.

## Änderungen

### Datei: `supabase/functions/extract-receipt/index.ts`

**1. Neue Funktion `buildCategoryHints(country, categories)`**

Generiert einen Prompt-Block mit Zuordnungsregeln pro Kategorie:

```text
KATEGORIE-ZUORDNUNGSHILFE (Österreich):

Verwende diese Regeln um die passende Kategorie zu wählen:

- "Bewirtung 50% (AT)": Geschäftsessen, Restaurant, Gasthaus, Catering, Café-Bewirtung
  → Typische Lieferanten: Restaurants, Hotels, Caterer
  → NICHT: Mitarbeiter-Verpflegung, eigene Mahlzeiten auf Reise (→ Reisekosten)

- "Reisekosten (AT)": Bahntickets, Flüge, Hotel, Taxi, Mietwagen, Parkgebühren auf Dienstreise
  → Typische Lieferanten: ÖBB, Flixbus, Airlines, Booking.com, Hotels
  → Tagesdiäten (26,40€), Nächtigungspauschale (15€)
  → NICHT: tägliche Fahrt zum Büro (→ KFZ-Kosten)

- "KFZ-Kosten (AT)": Treibstoff, Reparatur, Service, KFZ-Versicherung, Vignette, Maut, Parkgebühren
  → Typische Lieferanten: Tankstellen (BP, Shell, OMV), Werkstätten, ASFINAG, ÖAMTC
  → Luxustangente beachten (>40.000€ Anschaffung)

- "Büromaterial (AT)": Papier, Stifte, Ordner, Druckerpatronen, Briefumschläge, Porto
  → Typische Lieferanten: Pagro, Office World, Thalia (Bürobedarf)
  → NUR Verbrauchsmaterial, NICHT Geräte (→ GWG oder AfA)

- "Geringwertige WG (AT)": Einzelne Wirtschaftsgüter unter 1.000€ netto
  → Laptop, Monitor, Drucker, Smartphone, Tastatur, Headset
  → NICHT: Software-Abos (→ Rechts-/Beratungskosten oder eigene Kategorie)

- "Telefon & Internet (AT)": Mobilfunk, Festnetz, Internet-Anschluss
  → Typische Lieferanten: A1, Magenta, Drei, Fonira

- "Versicherungen (AT)": Betriebliche Versicherungen
  → Typische Lieferanten: Generali, UNIQA, Allianz, Wiener Städtische, Zürich
  → NUR betriebliche Versicherungen, NICHT SVS (→ Sozialversicherung SVS)

- "Sozialversicherung SVS (AT)": SVS-Beiträge
  → Typische Lieferanten: SVS, Sozialversicherung der Selbständigen

- "Bankgebühren (AT)": Kontoführung, Überweisungsgebühren, Kreditkartengebühren, Zinsen
  → Typische Lieferanten: Banken (Erste Bank, Raiffeisen, BAWAG, Sparkasse)

... (analog für DE und CH mit jeweiligen Besonderheiten)
```

**2. Länderspezifische Besonderheiten eingebaut:**

| Land | Besonderheit im Prompt |
|------|----------------------|
| AT | Bewirtung 50%, GWG 1.000€, SVS, WKO-Kammerumlage, Kilometergeld 0,42€ |
| DE | Bewirtung 70%, GWG 800€, IHK-Beiträge, Homeoffice-Pauschale 1.260€, Computer AfA 1 Jahr seit 2021 |
| CH | Bewirtung ~50%, GWG 1.000 CHF, Kilometerpauschale 0,70 CHF, AHV/IV/ALV, Handelskammer |

**3. Integration in den Prompt**

Der neue Block wird zwischen der Kategorie-Liste und den bestehenden Regeln eingefügt:
```typescript
const categoryHints = buildCategoryHints(userCountry, catNames);
// Im userPrompt:
"category": "Wähle die passendste Kategorie aus dieser Liste: ${categoryList}"
// Danach:
+ categoryHints
```

**4. Typische Lieferanten-Keyword-Mappings** (Beispiele aus Recherche):

| Keyword auf Rechnung | → Kategorie |
|---------------------|-------------|
| "Google Ads", "Meta Ads", "LinkedIn" | Werbung & Marketing |
| "Booking.com", "Hotel", "ÖBB", "Flixbus" | Reisekosten |
| "Shell", "BP", "OMV", "Tankstelle" | KFZ-Kosten |
| "A1 Telekom", "Magenta", "Drei" | Telefon & Internet |
| "Amazon" (Büroartikel) | Büromaterial ODER GWG (nach Betrag) |
| "SVS", "Sozialversicherung" | Sozialversicherung |
| "WKO", "Wirtschaftskammer" | Kammerumlage WKO |
| "Steuerberater", "Rechtsanwalt" | Rechts-/Beratungskosten |

## Umfang
- Nur 1 Datei wird geändert: `supabase/functions/extract-receipt/index.ts`
- Keine DB-Änderungen nötig
- Keine Frontend-Änderungen nötig
- Der Prompt wird je nach Land um ca. 500-800 Tokens länger

## Risiken
- Längerer Prompt = minimal höhere Kosten pro Extraktion
- Token-Limit: bei 4096 max_tokens und dem längeren Input-Prompt kein Problem (Input-Tokens sind separat)

