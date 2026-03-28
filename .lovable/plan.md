

# Plan: Länderspezifische Steuer-Kategorien mit Steuernummern

## Überblick
Vordefinierte steuerliche Ausgabenkategorien für AT, DE, CH mit optionaler Anzeige der jeweiligen Steuer-Kontonummern (z.B. SKR03/SKR04 für DE, EAR-Kennzahl für AT, Kontenrahmen KMU für CH).

## 1. Datenbank-Migration

Neue Spalten in `categories`:
- `country` (text, nullable) — Länderzuordnung (AT/DE/CH)
- `tax_code` (text, nullable) — Steuer-Kontonummer (z.B. "4650" für SKR03)

Seed-Daten: ~15-20 Kategorien pro Land mit korrekten Steuernummern:

**Österreich (EAR-Kennzahlen):**
| Kategorie | Kennzahl |
|---|---|
| Bewirtung (50%) | KZ 9230 |
| Reisekosten | KZ 9200 |
| KFZ-Kosten | KZ 9160 |
| Büromaterial | KZ 9110 |
| Telefon & Internet | KZ 9130 |
| Versicherungen | KZ 9220 |
| Miete & Betriebskosten | KZ 9100 |
| Werbung & Marketing | KZ 9140 |
| Rechts-/Beratungskosten | KZ 9150 |
| Fortbildung | KZ 9170 |
| AfA | KZ 9180 |
| SVS | KZ 9225 |
| Kammerumlage (WKO) | KZ 9226 |
| Bankgebühren | KZ 9210 |
| GWG | KZ 9185 |

**Deutschland (SKR03 / SKR04):**
| Kategorie | SKR03 | SKR04 |
|---|---|---|
| Bewirtung (70%) | 4650 | 6640 |
| Reisekosten | 4660 | 6650 |
| KFZ-Kosten | 4510 | 6520 |
| Bürobedarf | 4930 | 6815 |
| Telekommunikation | 4920 | 6805 |
| Versicherungen | 4360 | 6400 |
| Raumkosten/Miete | 4210 | 6310 |
| Werbekosten | 4600 | 6600 |
| Rechts-/Beratungskosten | 4950 | 6825 |
| Fortbildung | 4945 | 6821 |
| AfA | 4830 | 6220 |
| Geschenke (§4 Abs.5) | 4630 | 6620 |
| GWG | 4855 | 6260 |
| Leasingkosten | 4570 | 6560 |
| IHK-Beiträge | 4380 | 6420 |

**Schweiz (Kontenrahmen KMU):**
| Kategorie | Konto |
|---|---|
| Bewirtung | 6640 |
| Reisekosten | 6530 |
| Fahrzeugkosten | 6200 |
| Büromaterial | 6500 |
| Telekommunikation | 6510 |
| Versicherungsprämien | 6300 |
| Mietaufwand | 6000 |
| Werbeaufwand | 6600 |
| Beratungskosten | 6550 |
| Weiterbildung | 6540 |
| Abschreibungen | 6800 |
| AHV/IV/EO | 5700 |
| BVG | 5720 |

Alle mit `is_system = true`, `is_hidden = true` (User blendet sie bewusst ein).

## 2. UI-Änderungen in CategoryManagement.tsx

- **Neuer Abschnitt oben**: Land-Auswahl (AT/DE/CH) vorbelegt aus `profiles.country`
- **Buttons**: "Steuer-Kategorien einblenden" / "Steuer-Kategorien ausblenden" für gewähltes Land
- **Toggle "Steuernummern anzeigen"**: Switch der eine zusätzliche Spalte "Steuernr." in der Tabelle ein-/ausblendet
- **Länder-Badges** (🇦🇹/🇩🇪/🇨🇭) bei Steuer-Kategorien in der Tabelle
- Die `tax_code` wird in der Tabelle als kleine graue Monospace-Badge angezeigt, wenn der Toggle aktiv ist

## 3. Category-Interface erweitern

```typescript
interface Category {
  // ... bestehende Felder
  country: string | null;
  tax_code: string | null;
}
```

## Dateien

| Datei | Änderung |
|---|---|
| Neue Migration | `country` + `tax_code` Spalten, INSERT Seed-Daten |
| `CategoryManagement.tsx` | Land-Filter, Steuernummer-Toggle, Badges |
| `useCategories.ts` | `country` + `tax_code` im Interface |

