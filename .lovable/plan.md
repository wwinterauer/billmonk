# Tag-Filter in Ausgabenübersicht als offene Mehrfachauswahl

## Ziel
Der Tag-Filter in `/expenses` soll mehrere Tags in einem einzigen geöffneten Dropdown auswählbar machen, ohne dass sich das Menü nach jedem Klick schließt. Zusätzlich wird die Auswahl übersichtlicher und per URL teilbar.

## Ist-Zustand
- `src/pages/Expenses.tsx` enthält bereits einen Tag-Filter mit `DropdownMenuCheckboxItem`.
- Die State-Variable `tagFilter` ist bereits ein `string[]`, die Filterlogik unterstützt also technisch mehrere Tags.
- Das Dropdown schließt sich aber nach jedem Klick, weil `onSelect` nicht verhindert wird.

## Lösung
1. **Dropdown beim Tag-Auswählen offenhalten**
   - Allen `DropdownMenuCheckboxItem`s im Tag-Filter `onSelect={(e) => e.preventDefault()}` geben.
   - Das Menü schließt nur noch bei Klick außerhalb, Escape oder über einen dedizierten "Schließen"-Button.

2. **Bessere Steuerung im Dropdown**
   - "Alle auswählen" / "Alle abwählen" oberhalb der Tag-Liste ergänzen.
   - "Ohne Tags" bleibt als Option erhalten und schließt sich gegenseitig aus (wählt man "Ohne Tags", werden andere Tags entfernt; wählt man einen Tag, wird "Ohne Tags" entfernt).

3. **Auswahl visuell im Trigger darstellen**
   - Im Filter-Button werden die ausgewählten Tags als kleine farbige Badges/Chips angezeigt.
   - Bei vielen Tags wird abgeschnitten und die Anzahl ergänzt (z. B. "3 Tags").

4. **Tag-Filter in URL persistieren**
   - Ausgewählte Tag-IDs werden als `tags=id1,id2` in die URL geschrieben.
   - "Ohne Tags" wird als `noTags=1` gespeichert.
   - Beim Öffnen der Seite wird der Filter aus den URL-Parametern wiederhergestellt.

5. **Filterlogik beibehalten**
   - Mehrere Tags werden weiterhin als **ODER** interpretiert: ein Beleg wird angezeigt, wenn er mindestens einen der gewählten Tags besitzt.
   - "Ohne Tags" zeigt ausschließlich Belege ohne zugewiesene Tags.

## Technische Umsetzung
- Datei: `src/pages/Expenses.tsx`
  - Tag-Filter-Block (ca. Zeile 2108–2177) durch eine verbesserte Variante ersetzen.
  - `useEffect` für URL-Sync um `tagFilter` erweitern.
  - Initialwert von `tagFilter` aus `searchParams.get('tags')` / `searchParams.get('noTags')` befüllen.
- Optional: kleine interne Komponente `TagFilterDropdown` im selben File, um den Filter-Block lesbar zu halten.
- Keine Backend-/Datenbank-Änderungen nötig.

## Akzeptanzkriterien
- Ich kann im Tag-Dropdown mehrere Tags nacheinander anklicken, ohne dass es sich schließt.
- Die gewählten Tags werden als farbige Chips im Filter-Button angezeigt.
- "Alle auswählen" / "Alle abwählen" funktionieren.
- Nach Seiten-Reload bleibt die Tag-Auswahl erhalten.
