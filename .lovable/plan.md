

## Plan: Logos einsetzen + Build-Error beheben

### 1. Logo-Asset kopieren
- `user-uploads://logo_BM_white_transparent_1200-2.png` → `src/assets/logo-billmonk.png`
- Das bisherige `_600.png` wird nicht verwendet — nur dieses hochaufgeloeste Bild

### 2. Logo an 8 Stellen einsetzen (CSS-skaliert)
Ueberall wird das aktuelle Platzhalter-Logo (gradient-div + Search-Icon + "BillMonk"-Text) durch ein `<img>` ersetzt:

| Datei | Hoehe | Kontext |
|---|---|---|
| `Header.tsx` | `h-8` (32px) | Navbar, inkl. Beta-Badge daneben |
| `Footer.tsx` | `h-7` (28px) | Footer-Branding, inkl. Beta-Badge |
| `Sidebar.tsx` | `h-8` / collapsed: `h-8 w-8 object-contain` | Dashboard-Sidebar |
| `Login.tsx` | `h-12` (48px) | Auth-Karte |
| `Register.tsx` | `h-12` | Auth-Karte |
| `ForgotPassword.tsx` | `h-12` | Auth-Karte |
| `ResetPassword.tsx` | `h-12` | Auth-Karte |
| `Hero.tsx` | `h-6` (24px) | Mock-Dashboard-Preview |

Import-Pattern:
```tsx
import logoBillmonk from "@/assets/logo-billmonk.png";
// ...
<img src={logoBillmonk} alt="BillMonk" className="h-8" />
```

Bei collapsed Sidebar: Logo wird auf Icon-Groesse beschnitten (`w-9 h-9 object-cover object-left`), sodass nur das Haekchen-Symbol sichtbar ist.

Beta-Badge bleibt neben dem Logo erhalten wo vorhanden.

### 3. Build-Error beheben
- `supabase/functions/admin-metrics/index.ts` Zeile 2:
  - Von: `import { createClient } from "npm:@supabase/supabase-js@2.57.2"`
  - Zu: `import { createClient } from "https://esm.sh/@supabase/supabase-js@2"` (wie alle anderen Edge Functions)

### Aenderungen gesamt
- 1 Asset-Datei kopiert
- 8 TSX-Dateien aktualisiert (Logo-Ersetzung)
- 1 Edge-Function-Import korrigiert

