

## EPC QR-Code (GiroCode) auf Ausgangsrechnungen

### Zusammenfassung
Auf jeder generierten Rechnung wird ein EPC QR-Code (GiroCode) eingefügt, der SEPA-Zahlungsdaten enthält. Kunden können den Code mit ihrer Banking-App scannen und die Zahlung direkt ausführen.

### EPC QR-Code Format
Der europäische Standard (EPC069-12) codiert folgende Daten:
```text
BCD
002
1
SCT
[BIC]
[Empfänger-Name]
[IBAN]
EUR[Betrag]


[Verwendungszweck/Rechnungsnummer]
```

### Technische Umsetzung

**1. Edge Function erweitern (`supabase/functions/generate-invoice-pdf/index.ts`)**

- QR-Code-Bibliothek importieren: `npm:qrcode-generator` (leichtgewichtig, Deno-kompatibel, kein Canvas nötig)
- EPC-Payload aus Firmendaten (IBAN, BIC, Name) und Rechnungsdaten (Betrag, Rechnungsnummer) zusammenbauen
- QR-Code als PNG-Bytes generieren und via `pdfDoc.embedPng()` einbetten
- Platzierung: rechts neben den Bankverbindungsdaten (ca. 80x80pt), nur wenn IBAN vorhanden und kein Lieferschein
- Beschriftung unter dem QR-Code: "Jetzt scannen & bezahlen" (klein, grau)

**2. Bedingungen**
- Nur bei Rechnungen/Gutschriften (nicht bei Angeboten, AB, Lieferscheinen)
- Nur wenn IBAN in den Firmendaten hinterlegt ist
- Betrag muss > 0 sein

**3. Vorschau aktualisieren (`InvoiceLayoutPreview.tsx`)**
- Kleinen QR-Code-Platzhalter in der Mini-Vorschau neben der Bankverbindung anzeigen

### Dateien
| Datei | Änderung |
|-------|----------|
| `supabase/functions/generate-invoice-pdf/index.ts` | QR-Code generieren und im PDF platzieren |
| `src/components/settings/InvoiceLayoutPreview.tsx` | QR-Platzhalter in der Vorschau |

