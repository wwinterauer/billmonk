

# Lieferanten-spezifische "Nur Ausgaben"-Regel

## Uebersicht

Statt einer globalen Prompt-Regel wird ein lieferantenspezifisches Flag eingefuehrt: **"Nur Ausgaben extrahieren"**. Damit werden bei Plattform-Abrechnungen (z.B. Monta) nur Kosten-Positionen erfasst und Einnahmen/Gutschriften ignoriert.

Der Nutzer kann diese Regel:
1. Beim **Lieferanten fest hinterlegen** (Einstellungen > Lieferanten)
2. In der **Review-Seite** oder **Einzelbeleg-Bearbeitung** direkt aktivieren und eine Neuanalyse anstoessen

---

## Aenderungen

### 1. Datenbank: Neues Feld auf `vendors`

Neue Spalte `expenses_only_extraction` (boolean, default `false`) auf der `vendors`-Tabelle.

```text
ALTER TABLE vendors ADD COLUMN expenses_only_extraction boolean NOT NULL DEFAULT false;
```

### 2. Edge Function (`supabase/functions/extract-receipt/index.ts`)

**Vendor-Lookup erweitern** (Zeile ~780-813):
- Wenn ein Vendor gefunden wird, zusaetzlich `expenses_only_extraction` abfragen
- Falls `true`: zusaetzliche Prompt-Regel an den `userPrompt` anhaengen

**Zusaetzliche Prompt-Regel** (nur wenn Flag aktiv):
```text
WICHTIGE REGEL - NUR AUSGABEN EXTRAHIEREN:
Diese Rechnung stammt von einem Lieferanten mit gemischten Abrechnungen.
- Erfasse NUR AUSGABEN/KOSTEN (Gebuehren, Abos, Transaktionskosten)
- IGNORIERE Einnahmen, Erloese, Gutschriften, Auszahlungen
- amount_gross = Summe NUR der Kosten-Positionen
- Beschreibung: nur Kosten-Positionen auflisten
```

**Body-Parameter**: Die Edge Function akzeptiert auch einen neuen optionalen Parameter `expensesOnly: boolean` fuer Ad-hoc-Aufrufe aus der UI (wenn der Nutzer die Regel fuer einen einzelnen Beleg anstoesst, ohne sie dauerhaft zu speichern).

### 3. Lieferanten-Verwaltung (`src/components/settings/VendorManagement.tsx`)

**Bearbeitungs-Dialog erweitern**:
- Neuer Switch/Checkbox: "Nur Ausgaben extrahieren (Einnahmen ignorieren)"
- Erklaerungstext: "Aktivieren fuer Plattform-Abrechnungen die Kosten und Einnahmen mischen (z.B. Monta, Marketplace-Anbieter)"
- Wird ueber `updateVendor()` gespeichert

### 4. Vendor-Hook (`src/hooks/useVendors.ts`)

**Vendor-Interface erweitern**:
- Neues Feld `expenses_only_extraction: boolean` im `Vendor` Interface
- Feld in `fetchVendors()` laden und in `updateVendor()` speichern

### 5. Review-Seite (`src/pages/Review.tsx`)

**Neuer Hinweis-Banner** (nach dem Vendor-Feld):
- Wenn der aktuelle Beleg einem Vendor mit `expenses_only_extraction = true` zugeordnet ist: Info-Badge "Nur Ausgaben" anzeigen
- Button: "Nur Ausgaben neu analysieren" -- ruft `extract-receipt` mit `expensesOnly: true` auf

**Neuer Quick-Action im KI-Analyse-Menue**:
- Falls Vendor bekannt aber Flag nicht gesetzt: Option "Nur Ausgaben extrahieren (einmalig)" -- fuehrt Neuanalyse mit dem Flag durch
- Falls gewuenscht: "Und fuer diesen Lieferanten merken" -- setzt zusaetzlich das Flag auf dem Vendor

### 6. Beleg-Detail-Panel (`src/components/receipts/ReceiptDetailPanel.tsx`)

**Gleiche Logik wie Review**:
- Info-Badge wenn Vendor `expenses_only_extraction = true` hat
- Option fuer einmalige Neuanalyse mit "Nur Ausgaben"
- Option das Flag dauerhaft am Lieferanten zu speichern

### 7. ReanalyzeOptions erweitern (`src/components/receipts/ReanalyzeOptions.tsx`)

**Neuer Menuepunkt** im KI-Analyse-Dropdown:
- Separator + neuer Abschnitt "Spezial-Analyse"
- Menuepunkt: "Nur Ausgaben extrahieren" mit Euro-Icon und Erklaerungstext
- Ruft die Edge Function mit `expensesOnly: true` auf
- Optional: Sub-Option "Fuer Lieferant merken" (setzt `expenses_only_extraction` auf dem Vendor)

**Props erweitern**:
- `vendorId?: string` und `vendorExpensesOnly?: boolean` als neue Props
- Callback `onVendorSettingChange?: (setting: string, value: boolean) => void`

---

## Ablauf aus Nutzersicht

```text
Szenario A: Einmalig in der Review
1. Nutzer sieht Monta-Rechnung mit falschen Betraegen
2. Klickt auf "KI-Analyse" > "Nur Ausgaben extrahieren"
3. KI analysiert neu und erfasst nur Gebuehren + Abo
4. Optional: Checkbox "Fuer diesen Lieferanten merken" -> setzt Flag

Szenario B: Dauerhaft beim Lieferanten
1. Nutzer geht zu Einstellungen > Lieferanten > Monta
2. Aktiviert "Nur Ausgaben extrahieren"
3. Alle kuenftigen Monta-Belege werden automatisch nur mit Ausgaben analysiert
```

---

## Betroffene Dateien

| Datei | Aenderungen |
|-------|------------|
| Datenbank (Migration) | `expenses_only_extraction` Spalte auf `vendors` |
| `supabase/functions/extract-receipt/index.ts` | Vendor-Flag laden, Prompt erweitern, `expensesOnly` Body-Parameter |
| `src/hooks/useVendors.ts` | Interface + fetch/update erweitern |
| `src/components/settings/VendorManagement.tsx` | Switch im Bearbeitungs-Dialog |
| `src/components/receipts/ReanalyzeOptions.tsx` | Neuer "Nur Ausgaben" Menuepunkt + Vendor-Merken-Option |
| `src/pages/Review.tsx` | Info-Badge, Vendor-Flag weiterreichen an ReanalyzeOptions |
| `src/components/receipts/ReceiptDetailPanel.tsx` | Info-Badge, Vendor-Flag weiterreichen |
