# Belege ohne Lieferantenzuordnung anzeigen

## Was heute passiert

In der Review erscheint eine Hinweiskarte "4 Belege ohne Lieferantenzuordnung" mit nur einer Aktion: "Lieferanten neu zuordnen". Die betroffenen Belege selbst lassen sich nicht gezielt öffnen — sie sind in der normalen Durchblätter-Liste verstreut.

## Was gebaut wird

1. **Button "Anzeigen" auf der Hinweiskarte**
   Klick filtert die Review sofort auf genau diese Belege (Status "review", kein verknüpfter Lieferant, aber ein erkannter Lieferantenname). Der Zähler oben zeigt dann z. B. "Beleg 1 von 4".

2. **Sichtbarer Filter-Zustand mit Aufheben**
   Ist der Filter aktiv, erscheint ein kleiner Hinweis-Chip ("Nur Belege ohne Lieferantenzuordnung") mit einem X zum Zurücksetzen. Der Filter wird in der URL gemerkt (`?filter=unlinked`), damit man ihn teilen und neu laden kann.

3. **Zusammenspiel mit der Lieferantensuche**
   Filter und Textsuche wirken kombiniert. Findet der Filter keine Belege mehr (z. B. nachdem der Abgleich alle zugeordnet hat), wird er automatisch aufgehoben und die normale Liste erscheint wieder.

4. **Nach dem Abgleich frisch laden**
   Läuft "Lieferanten neu zuordnen" durch, wird die Liste neu geladen und der Zähler auf der Karte aktualisiert sich; verbleibende Belege bleiben über "Anzeigen" erreichbar.

## Technische Details

- `src/pages/Review.tsx`: neuer State `unlinkedOnly` (initial aus `searchParams.get('filter') === 'unlinked'`), Synchronisierung in den bestehenden URL-Effekt. `filteredReceipts` zusätzlich um das Prädikat aus `unlinkedVendorCount` erweitern (`status === 'review' && !vendor_id && (vendor || vendor_brand)`). Auto-Reset, wenn `unlinkedOnly` aktiv und Ergebnis leer.
- `src/components/receipts/ReconcileVendorsCard.tsx`: zusätzliche Props `onShowUnlinked` und `active`; Button "Anzeigen" bzw. "Filter aufheben" neben der bestehenden Abgleich-Aktion.
- Keine Datenbank- oder Edge-Function-Änderungen nötig.
