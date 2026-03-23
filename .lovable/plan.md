

# User-Detail-Ansicht im Admin Dashboard

## Überblick

Die User-Tabelle wird erweitert um mehr Spalten, Filter und eine klickbare Detail-Ansicht (Dialog) pro User. Der Admin sieht auf einen Blick alle relevanten Infos und kann per Klick auf eine Zeile das vollständige Profil öffnen.

## Backend: Edge Function `admin-users` erweitern

Die bestehende SELECT-Query wird erweitert um alle Profil-Felder + aggregierte Daten:

**Zusätzliche Profil-Felder laden:**
- `street, zip, city, country, phone, account_type, company_name, uid_number, onboarding_completed, newsletter_opt_in, subscription_status, subscription_end_date, stripe_product_id, avatar_url, receipt_credit, monthly_document_count, document_credit, admin_view_plan`

**Aggregierte Daten pro User** (separate Queries mit Service Role):
- `receipts`: Gesamtanzahl Belege + Summe `amount_gross` (= Umsatz/Ausgaben)
- `invoices`: Gesamtanzahl Rechnungen + Summe `total`
- `support_tickets`: Offene Tickets count

Diese werden als zusätzliche Maps zurückgegeben und im Frontend zusammengeführt.

## Frontend: `UserManagement.tsx` überarbeiten

### Tabelle erweitern
Neue sichtbare Spalten:
- **Kontotyp** (Privat/Firma/Verein)
- **Abo-Status** (active/trialing/canceled/—)
- **Onboarding** (✓/✗)
- **Belege gesamt** (Gesamtanzahl, nicht nur monatlich)
- **Umsatz** (Summe aller Beleg-Beträge, formatiert als EUR)

Neue Filter:
- **Abo-Status** (alle/aktiv/trial/gekündigt/keins)
- **Kontotyp** (alle/privat/firma/verein)
- **Onboarding** (alle/abgeschlossen/offen)

### User-Detail-Dialog
Klick auf eine Tabellenzeile öffnet einen `Dialog` mit allen Informationen in Sektionen:

1. **Persönliche Daten**: Name, E-Mail, Telefon, Avatar, Adresse (Straße, PLZ, Stadt, Land)
2. **Unternehmen**: Kontotyp, Firmenname, UID-Nummer
3. **Abonnement**: Plan, Abo-Status, Stripe-ID, Abo-Ende, Produkt-ID
4. **Nutzung**: Belege diesen Monat, Belege gesamt, Beleg-Credits, Dokumente, Umsatz gesamt
5. **Sonstiges**: Registriert am, Onboarding abgeschlossen, Newsletter, Offene Support-Tickets

Innerhalb des Dialogs kann der Plan weiterhin per Select geändert werden.

### CSV-Export erweitern
Alle neuen Felder werden im CSV-Export berücksichtigt.

## Änderungen

| Datei | Änderung |
|---|---|
| `supabase/functions/admin-users/index.ts` | Erweiterte SELECT + Aggregations-Queries |
| `src/components/admin/UserManagement.tsx` | Neue Spalten, Filter, Detail-Dialog |

Keine DB-Migration nötig — alle Felder existieren bereits.

