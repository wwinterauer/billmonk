
# PDF-Vorschau auf volle Hoehe der rechten Spalte erweitern

## Uebersicht

Die linke Spalte (Dokumentvorschau) im Review-Layout wird so angepasst, dass sie die gesamte Hoehe der rechten Spalte (bis einschliesslich "Ueberspringen"-Button) ausfuellt, anstatt auf `h-[60vh]` begrenzt zu sein.

## Aenderung

### Datei: `src/pages/Review.tsx`

1. **Grid-Container (Zeile 708)**: Das `grid`-Layout erhaelt `items-stretch`, damit beide Spalten gleich hoch werden.

2. **Linke Spalte / sticky-Wrapper (Zeile 711)**: Der `sticky top-6`-Wrapper wird so angepasst, dass er die volle verfuegbare Hoehe nutzt (`h-full flex flex-col`).

3. **Preview-Container (Zeile 713-719)**: Die feste Hoehe `min-h-[500px] h-[60vh]` wird durch `flex-1 min-h-0` ersetzt, sodass der Vorschaubereich den gesamten verbleibenden Platz einnimmt (abzueglich Dateiname und Buttons darunter).

4. **Fuer Bilder** bleibt `aspect-[3/4]` erhalten, da Bilder eine feste Proportion benoetigen. Nur der PDF-Fall wird auf `flex-1` umgestellt.

## Technische Details

### Konkrete CSS-Aenderungen

| Zeile | Vorher | Nachher |
|-------|--------|---------|
| 708 | `grid lg:grid-cols-2 gap-8` | `grid lg:grid-cols-2 gap-8 items-stretch` |
| 711 | `sticky top-6` | `sticky top-6 h-full flex flex-col` |
| 718 (PDF) | `min-h-[500px] h-[60vh]` | `flex-1 min-h-[400px]` |

### Betroffene Datei

| Datei | Aenderung |
|-------|-----------|
| `src/pages/Review.tsx` | Grid `items-stretch`, sticky-Wrapper `h-full flex flex-col`, PDF-Container `flex-1` |
