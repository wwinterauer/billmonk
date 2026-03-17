

## Plan: Newsletter-Einstellungen zum Account-Bereich hinzufügen

Der Newsletter-Opt-in wird aktuell nur beim Onboarding gesetzt. Er soll auch in der Account-Seite änderbar sein.

### Änderung

In `src/pages/Account.tsx` (die neue Account-Seite, die im vorherigen Plan beschrieben wurde) wird im **Profil-Tab** ein zusätzlicher Abschnitt "Newsletter" ergänzt:

- Switch/Checkbox für `newsletter_opt_in` mit Label "XpenzAI Newsletter erhalten (Tipps, Updates, Angebote)"
- Wird beim Laden des Profils aus `profiles.newsletter_opt_in` gelesen
- Wird beim Speichern zusammen mit den anderen Profildaten persistiert

Kein DB-Schema-Change nötig -- `newsletter_opt_in` existiert bereits in der `profiles`-Tabelle.

### Einordnung

Dies wird als Teil des Profil-Tabs der Account-Seite implementiert, zusammen mit den anderen persönlichen Einstellungen (Name, Telefon, Profilbild). Es ist ein einfacher Switch unterhalb der Kontaktdaten.

