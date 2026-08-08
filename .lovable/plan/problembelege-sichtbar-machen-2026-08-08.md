# Problembelege sichtbar machen

Heute sind 13 Teilbelege still auf `error` gelandet (Credit-Limit). Sichtbar war das nur in der Datenbank — im UI verschwinden Belege mit Status `error`, `pending` oder `processing` komplett aus dem Review-Zähler. Das wird behoben.

## 1. Neuer Bereich "Problembelege" im Review

Die Review-Seite bekommt zwei Tabs:
- **Zu prüfen** (wie bisher, Status `review`)
- **Problembelege** — alle Belege mit `error`, sowie `pending`/`processing`, die älter als 10 Minuten sind (also hängengeblieben)

In der Problem-Liste pro Beleg: Dateiname, Datum, Statusbadge, verständlicher Fehlergrund (z. B. "KI-Limit erreicht", "Datei nicht lesbar"), Vorschau öffnen, sowie Aktionen **Erneut analysieren**, **Manuell erfassen** und **Löschen**. Oben Sammelaktion "Alle erneut analysieren" mit Fortschrittsanzeige (Logik existiert bereits in den Einstellungen und wird wiederverwendet).

## 2. Dauerhafte Warnung, die man nicht übersieht

- Sidebar: Menüpunkt "Review" bekommt zusätzlich ein rotes Warn-Badge, wenn Problembelege existieren.
- Dashboard: Warnbanner "X Belege konnten nicht verarbeitet werden" mit Direktlink in den neuen Tab.
- Direkt nach dem Upload: Die Upload-Tagesübersicht zeigt eine eigene Kachel "Verarbeitung fehlgeschlagen" mit Link.

## 3. Verständliche Fehlergründe statt Technik

Fehlermeldungen werden auf klare deutsche Texte gemappt (Credit-/Limit-Fehler, Zeitüberschreitung, unlesbare Datei, unbekannter Fehler) inklusive Hinweis, was der Nutzer tun kann. Beim Limit-Fehler zusätzlich der Hinweis auf das Credit-Limit.

## Technische Umsetzung

- `src/pages/Review.tsx`: Tab-Umbau, zweite Query auf `receipts` mit `status in ('error','pending','processing')`; Stale-Filter über `updated_at < now()-10min`.
- Neue Komponente `src/components/receipts/ProblemReceiptsPanel.tsx` mit Liste + Bulk-Retry (Aufruf der Edge Function `extract-receipt` pro Beleg, Batchgröße 3).
- Retry-Logik aus `src/components/settings/ProcessingRetry.tsx` in einen gemeinsamen Hook `src/hooks/useReceiptRetry.ts` extrahieren; Einstellungen nutzen ihn weiter.
- `src/components/dashboard/Sidebar.tsx`: zusätzlicher `problemCount` (Realtime + Polling wie beim Review-Zähler), rotes Badge.
- `src/lib/uploadReasons.ts` um Mapping für Verarbeitungsfehler (`notes`-Feld) erweitern.
- Dashboard-Banner in `src/pages/Dashboard.tsx`.
- Keine Datenbankänderungen nötig.
