

# Base64-Konvertierung optimieren

## Problem

Identischer O(n²) Base64-Konvertierungscode (String-Konkatenation in Schleife) in `extract-receipt` und `run-ab-test`.

## Lösung

### 1. Neue Datei: `supabase/functions/_shared/base64.ts`

```typescript
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const binChars = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    binChars[i] = String.fromCharCode(bytes[i]);
  }
  return btoa(binChars.join(''));
}
```

Array-basiert statt String-Konkatenation: `join('')` am Ende statt `+=` in der Schleife → O(n) statt O(n²).

### 2. `supabase/functions/extract-receipt/index.ts`

- Import: `import { uint8ArrayToBase64 } from "../_shared/base64.ts";`
- Zeilen 419-427 ersetzen: `const imageBase64 = uint8ArrayToBase64(new Uint8Array(await fileData.arrayBuffer()));`

### 3. `supabase/functions/run-ab-test/index.ts`

- Import: `import { uint8ArrayToBase64 } from "../_shared/base64.ts";`
- Zeilen 198-206 ersetzen: `const imageBase64 = uint8ArrayToBase64(new Uint8Array(await fileData.arrayBuffer()));`

### Dateien
- Neu: `supabase/functions/_shared/base64.ts`
- Geändert: `supabase/functions/extract-receipt/index.ts`
- Geändert: `supabase/functions/run-ab-test/index.ts`

