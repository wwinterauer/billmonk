

# Vendor-Prefix bei Duplikat-Erkennung verbessern

## Problem

Kurze Vendor-Namen wie "BMW" oder "DHL" werden auf 10 Zeichen abgeschnitten und per `ilike('%BMW%')` gesucht — das matcht auch ungewollte Einträge.

## Lösung

Hilfsfunktion einführen, die basierend auf der Namenslänge die passende Query-Methode wählt:

```typescript
function applyVendorFilter(query, vendor: string) {
  if (vendor.length < 6) {
    return query.eq('vendor', vendor);
  }
  return query.ilike('vendor', `%${vendor.substring(0, 10)}%`);
}
```

### Änderungen in `src/services/duplicateDetectionService.ts`

1. **Neue Hilfsfunktion** `applyVendorFilter(query, vendor)` am Dateianfang
2. **Level 2** (Zeile 77-83): `vendorPrefix`-Variable + `.ilike()` ersetzen durch `applyVendorFilter(query, receiptData.vendor)`
3. **Level 3** (Zeile 102-109): Gleiche Änderung
4. **Level 4** (Zeile 134-142): Gleiche Änderung

Drei identische Stellen, gleicher Eingriff. Keine anderen Dateien betroffen.

### Dateien
- `src/services/duplicateDetectionService.ts`

