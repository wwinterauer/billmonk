# Belege "ohne erkannte Daten" richtig behandeln

## Was tatsächlich los ist

Die verbleibenden Belege sind keine Fehler der Analyse. Die KI hat sie korrekt als **Nicht-Belege** erkannt und das auch in den Notizen vermerkt:

- Medizinische Überweisung (Arzt → Radiologe)
- Dienstvertrag (Arbeitsvertrag)
- AirBnB Buchungsübersicht (Reservierungsliste, keine Rechnung)
- Gerichtsbeschluss / Exekutionsbewilligung

Alle vier haben Kategorie "Keine Rechnung", Konfidenz 0.50 und einen erklärenden Hinweis — aber keinen Lieferanten und keinen Betrag. Genau danach filtert das Banner, deshalb tauchen sie immer wieder als "ohne erkannte Daten" auf. Jede erneute Analyse liefert dasselbe (korrekte) Ergebnis, die Zahl sinkt also nie auf 0 — das erklärt auch, warum zwei Durchläufe nötig waren und dann Schluss war.

## Was gebaut wird

1. **Eigener Status statt Dauerschleife**
   Erkennt die KI ein Dokument als Nicht-Beleg, wird es künftig als "Kein Beleg" markiert (eigener Status) statt als normaler Review-Beleg. Bestehende vier Dokumente werden einmalig entsprechend umgestellt.

2. **Banner zählt nur echte Fehlschläge**
   Das Banner "X Belege ohne erkannte Daten" ignoriert Dokumente, die als Nicht-Beleg klassifiziert sind. Es zeigt nur noch Belege, bei denen die Analyse wirklich nichts geliefert hat (keine Notiz, keine Klassifizierung).

3. **Sichtbarer Bereich für Nicht-Belege**
   Ein eigener Filter/Tab in der Review, in dem diese Dokumente auffindbar bleiben. Pro Dokument zwei Aktionen:
   - "Doch als Rechnung behandeln" (erzwingt normale Extraktion)
   - "Verwerfen / archivieren"

   So fällt nichts unter den Tisch, blockiert aber auch nicht mehr die Review-Warteschlange.

4. **Kein wiederholtes Analysieren ohne Wirkung**
   Beim erneuten Analysieren werden Nicht-Belege übersprungen; wird ein Beleg zweimal hintereinander gleich klassifiziert, gibt es einen Hinweis statt eines weiteren stillen Durchlaufs.

## Technische Details

- `extract-receipt` Edge Function: im Zweig `is_receipt === false` Status `not_a_receipt` statt `review` setzen (Notes/Kategorie bleiben wie bisher).
- Datenbank: einmaliges Update der vier betroffenen Belege auf `not_a_receipt`.
- `src/pages/Review.tsx`: `emptyReceipts` zusätzlich um `status !== 'not_a_receipt'` und `category !== 'Keine Rechnung'` filtern; neuer Filter-Tab mit Aktionen (Retry mit `forceTreatAsReceipt`, Verwerfen).
- `useReceiptRetry`: Nicht-Belege aus Retry-Listen ausschließen, außer bei explizitem Force.
- Review-Zähler/Sidebar zählen `not_a_receipt` nicht als offene Review-Belege.
