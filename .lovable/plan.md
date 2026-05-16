## Änderung in `src/pages/Review.tsx` (Funktion `handleVendorSelect`, Zeile ~365–382)

Aktuell überschreibt die Auswahl eines Rechtsnamens aus dem Dropdown immer das Feld `vendor_brand` mit `vendorData.display_name`.

**Neu:** `vendor_brand` nur dann setzen, wenn das Feld aktuell leer ist. Andernfalls den vom User getippten/erkannten Markennamen unangetastet lassen.

```ts
vendor_brand: prev.vendor_brand?.trim() ? prev.vendor_brand : vendorData.display_name,
```

Sonst keine Änderungen. Die "Verheiraten"-Logik in `handleSave` bleibt unberührt — sie übernimmt beim Speichern weiterhin das, was im Brand-Feld steht (egal ob leer, gleich oder abweichend vom display_name).
