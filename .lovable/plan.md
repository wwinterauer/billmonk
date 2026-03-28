

# Plan: Lieferanten-Standard-Kategorie direkt im KI-Training bearbeiten

## Überblick
In der "Lieferanten-Standard-Kategorien"-Tabelle im KI-Training-Reiter wird die Kategorie-Spalte von einem statischen Badge zu einem Select-Dropdown umgebaut. Da beide Stellen (KI-Training und Lieferanten-Einstellungen) auf dasselbe DB-Feld `vendors.default_category_id` zugreifen, sind Änderungen automatisch synchron.

## Änderungen in `AILearningSettings.tsx`

1. **`useCategories` Hook importieren** — liefert die verfügbaren Kategorien für das Dropdown
2. **VendorDefaultCategory-Interface erweitern** — `vendor_id` und `default_category_id` mitspeichern
3. **Select-Dropdown pro Zeile** — ersetzt das statische Badge; zeigt alle Kategorien + Option "Keine Standard-Kategorie"
4. **Update-Handler `handleUpdateVendorCategory`** — schreibt `vendors.default_category_id` per Supabase-Update, refresht die Daten danach
5. **Toast-Feedback** bei Erfolg/Fehler

## Dateien

| Datei | Änderung |
|---|---|
| `AILearningSettings.tsx` | useCategories Import, Select-Dropdown in Vendor-Defaults-Tabelle, Update-Handler |

Keine DB-Änderungen nötig — das Feld `vendors.default_category_id` existiert bereits.

