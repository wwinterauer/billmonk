

# useReceipts.ts in drei Hooks aufteilen

## Übersicht

Die 1027 Zeilen von `useReceipts.ts` werden in drei spezialisierte Hooks aufgeteilt. Der bestehende `useReceipts()` wird zur Fassade, die alle drei importiert und re-exportiert.

## Aufteilung

### 1. `src/hooks/useReceiptUpload.ts` (~300 Zeilen)
Enthält die Upload-Pipeline und Hilfsfunktionen:
- Constants: `ALLOWED_TYPES`, `MAX_FILE_SIZE`, `MAX_FILES`
- `validateFile()`, `validateFiles()`
- `getFileExtension()`, `generateStoragePath()`
- `checkExactDuplicate()`
- `fileToBase64()`, `isConvertibleImage()`, `convertImageToPdf()`
- `uploadReceipt()` (Zeilen 249-345)
- `uploadAndProcessReceipt()` (Zeilen 697-774) — ruft intern `processReceiptWithAI` auf, das als Parameter übergeben wird
- `uploadMultipleReceipts()` (Zeilen 776-814)
- State: `uploading`
- Exportiert `useReceiptUpload()` Hook

**Abhängigkeit**: `uploadAndProcessReceipt` und `uploadMultipleReceipts` brauchen `processReceiptWithAI` und `updateReceipt`. Diese werden als Parameter an den Hook übergeben, damit keine zirkulären Abhängigkeiten entstehen.

### 2. `src/hooks/useReceiptProcessing.ts` (~280 Zeilen)
Enthält AI-Verarbeitung und Vendor-Logik:
- `processReceiptWithAI()` (Zeilen 347-572)
- `createVendorForReceipt()` (Zeilen 574-611)
- `finalizeReceiptWithVendor()` (Zeilen 613-695)
- Exportiert `useReceiptProcessing(updateReceipt)` — nimmt `updateReceipt` als Parameter

### 3. `src/hooks/useReceiptCrud.ts` (~200 Zeilen)
Enthält alle Datenbank-Operationen:
- `getReceipts()` (Zeilen 816-858)
- `getReceipt()` (Zeilen 860-877)
- `updateReceipt()` (Zeilen 879-900)
- `rejectReceipt()` (Zeilen 906-951)
- `deleteReceipt()` (Zeilen 953-987)
- `getReceiptFileUrl()` (Zeilen 989-1003)
- Exportiert `useReceiptCrud()` Hook

### 4. `src/hooks/useReceipts.ts` — Fassade (~60 Zeilen)
- Importiert alle drei Hooks
- Typen und Interfaces bleiben hier (werden re-exportiert)
- `useReceipts()` ruft die drei Hooks auf, verdrahtet die Abhängigkeiten und gibt ein einziges Objekt zurück
- **Bestehende Imports in der gesamten App brechen nicht**

```typescript
export function useReceipts() {
  const crud = useReceiptCrud();
  const processing = useReceiptProcessing(crud.updateReceipt);
  const upload = useReceiptUpload(processing.processReceiptWithAI, crud.updateReceipt);
  
  return {
    ...crud,
    ...processing,
    ...upload,
    // Constants
    ALLOWED_TYPES, MAX_FILE_SIZE, MAX_FILES,
  };
}
```

## Abhängigkeitsgraph

```text
useReceipts (Fassade)
  ├── useReceiptCrud        (eigenständig)
  ├── useReceiptProcessing  (braucht: updateReceipt)
  └── useReceiptUpload      (braucht: processReceiptWithAI, updateReceipt)
```

## Dateien
- Neu: `src/hooks/useReceiptUpload.ts`
- Neu: `src/hooks/useReceiptProcessing.ts`
- Neu: `src/hooks/useReceiptCrud.ts`
- Geändert: `src/hooks/useReceipts.ts` — wird zur Fassade (Types + Re-Export)

