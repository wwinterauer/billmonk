

# Vendor-Statistiken serverseitig berechnen

## Übersicht

Die aktuelle Implementierung lädt alle Belege des Users (`receipts` mit `vendor_id, amount_gross`) und berechnet COUNT/SUM per JavaScript-Schleife. Bei vielen Belegen skaliert das nicht. Lösung: Eine Database Function (RPC) `get_vendor_stats` die das per SQL erledigt.

## Änderungen

### 1. Database Migration — RPC-Funktion erstellen

```sql
CREATE OR REPLACE FUNCTION public.get_vendor_stats(p_user_id uuid)
RETURNS TABLE(vendor_id uuid, receipt_count bigint, total_amount numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.vendor_id, COUNT(*) AS receipt_count, COALESCE(SUM(r.amount_gross), 0) AS total_amount
  FROM public.receipts r
  WHERE r.user_id = p_user_id AND r.vendor_id IS NOT NULL
  GROUP BY r.vendor_id
$$;
```

### 2. `src/hooks/useVendors.ts` — Client-seitige Berechnung ersetzen

Zeilen 76-98 (Fetch aller Receipts + JS-Schleife) ersetzen durch einen RPC-Aufruf:

```typescript
const { data: statsData } = await supabase.rpc('get_vendor_stats', { p_user_id: user.id });

const statsMap = new Map<string, { count: number; total: number }>();
if (statsData) {
  for (const row of statsData) {
    statsMap.set(row.vendor_id, {
      count: Number(row.receipt_count),
      total: Number(row.total_amount),
    });
  }
}
```

### Dateien
- Migration: neue RPC-Funktion `get_vendor_stats`
- `src/hooks/useVendors.ts` — RPC-Aufruf statt Receipts-Fetch

