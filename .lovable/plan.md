

## Plan: Support-Tickets mit Bug/Feature-Typ, Modul-Auswahl und Belohnungssystem

### Übersicht
Support-Tickets werden um Typ (Bug/Feature), Modul-Auswahl und ein Belohnungssystem erweitert. Wenn der Admin einen Bug oder Feature-Vorschlag anerkennt, bekommt der User automatisch eine Stripe-Gutschrift in Höhe eines Monatsabos.

### Belohnungs-Mechanik (Stripe Credit Balance)
Statt das Abo zu pausieren oder Coupons zu erstellen, wird beim Anerkennen eine **Gutschrift auf das Stripe-Kundenkonto** (`customer.balance`) gebucht. Das ist der einfachste und sauberste Weg:
- Stripe zieht die Gutschrift automatisch von der nächsten Rechnung ab
- Kein manuelles Abo-Management nötig
- Funktioniert für alle Tarife und Abrechnungsintervalle
- User sieht die Gutschrift im Stripe Customer Portal

### Schritte

1. **DB-Migration: `support_tickets` erweitern**
   - `ticket_type TEXT DEFAULT 'bug'` — Werte: `bug`, `feature`
   - `area TEXT` — betroffenes Modul (Dashboard, Upload, Review, etc.)
   - `reward_status TEXT DEFAULT NULL` — Werte: `null`, `approved`, `rejected`
   - `reward_applied_at TIMESTAMPTZ` — wann Gutschrift gewährt wurde

2. **SupportContactForm (User-UI) erweitern**
   - Neues Select: "Art der Meldung" → Bug / Feature-Vorschlag
   - Neues Select: "Betroffener Bereich" → Dashboard, Belege hochladen, Review, Alle Ausgaben, Kontoabgleich, Konto-Import, Angebote, Rechnungen, Berichte, Checklisten, Einstellungen, Sonstiges
   - Info-Banner: "Für anerkannte Bug-Meldungen und umgesetzte Feature-Vorschläge erhältst du 1 Monat gratis!"
   - In Ticket-Historie: Reward-Status anzeigen (Anerkannt mit grünem Badge, Abgelehnt)

3. **SupportManagement (Admin-UI) erweitern**
   - Typ-Badge (Bug/Feature) und Modul-Badge pro Ticket anzeigen
   - Filter um Typ erweitern (Alle/Bug/Feature)
   - Neue Buttons: "Anerkennen ✓" und "Ablehnen ✗" (nur bei offenen/beantworteten Tickets ohne Reward-Status)
   - "Anerkennen" ruft neue Edge Function auf und setzt `reward_status = 'approved'`

4. **Neue Edge Function `reward-support-credit`**
   - Empfängt: `ticketId`, Admin-Auth
   - Prüft Admin-Rolle
   - Liest Ticket → holt `user_id` → holt Profil (Plan + `stripe_customer_id`)
   - Ermittelt Monatspreis aus Plan (`PLAN_PRICES`)
   - Bucht negative Balance auf Stripe-Kunden: `stripe.customers.update(customerId, { balance: currentBalance - monthlyPriceInCents })`
   - Setzt `reward_status = 'approved'` und `reward_applied_at` auf dem Ticket
   - Gibt Erfolg zurück

5. **User-Kommunikation**
   - Nach Anerkennung: Ticket zeigt grünes Badge "Anerkannt — 1 Monat Gutschrift"
   - Im Ticket-Bereich des Users wird der Status sichtbar

### Technische Details

- **Stripe Customer Balance**: Negative Balance = Guthaben. Wird automatisch bei der nächsten Rechnung verrechnet. Kein Coupon/Promo-Code nötig.
- **Sicherheit**: Edge Function prüft Admin-Rolle server-seitig. Doppelte Anerkennung wird durch `reward_status`-Check verhindert.
- **Free-Plan-User**: Wenn kein Stripe-Kunde existiert, wird die Gutschrift als `reward_status = 'approved'` markiert aber kein Stripe-Call gemacht (Info-Toast im Admin).

