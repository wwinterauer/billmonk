# Stripe-Belege nachträglich zuordnen und freigeben

## Was ich in den Daten gefunden habe

Es gibt 3 Stripe-Belege in der Review (17,03 / 51,35 / 7,83 EUR), alle mit Erkennungsgenauigkeit 100 %. Der Lieferant „Stripe" ist korrekt auf Auto-Freigabe ab 80 % gestellt. Trotzdem hängen die Belege, weil bei ihnen **kein Lieferant verknüpft** ist (`vendor_id` leer) — und ohne Verknüpfung greift die Auto-Freigabe-Regel nicht.

Grund: Die KI hat den Firmennamen als „Stripe Payments Europe, Limited **Limited**" extrahiert (doppelte Rechtsform). Der hinterlegte rechtliche Name lautet „Stripe Payments Europe, Limited" — also kein Treffer. Der Markenname „Stripe" war korrekt erkannt, aber der Markennamen-Abgleich kam erst mit dem WeTi-Fix dazu und wirkt nur auf neue Analysen. Alle betroffenen Belege stammen vom 08.08. 16:56, also von vor dem Fix.

Insgesamt betrifft das 68 Belege aus diesem Upload-Lauf, die einen erkannten Lieferantennamen haben, aber keine Verknüpfung. Die 4 heute erzeugten unverknüpften Belege sind dagegen echte Neu-Lieferanten (Amazon-Marketplace-Händler), für die es noch keinen Lieferantenstamm gibt — die gehören zu Recht in die Review.

## Was gemacht wird

1. **Nachzuordnung (Backfill):** Für alle Belege in Review ohne Lieferantenverknüpfung wird die aktuelle Zuordnungslogik nachträglich angewendet — exakter Name, rechtlicher Name, normalisierter Name, Markenname, unscharfer Abgleich ab 88 % Ähnlichkeit.
2. **Auto-Freigabe nachziehen:** Wo dadurch ein Lieferant mit aktiver Auto-Freigabe zugeordnet wird und die Erkennungsgenauigkeit über dem Schwellwert liegt (und kein Duplikat / keine Aufteilung vorliegt), wird der Beleg freigegeben.
3. **Dauerhafter Abgleich statt Einmal-Aktion:** In der Review kommt eine Aktion „Lieferanten neu zuordnen", die genau diesen Abgleich für alle offenen Belege ausführt. Damit lassen sich Belege auch nach dem Anlegen oder Umbenennen eines Lieferanten nachträglich zuordnen und freigeben, ohne dass jedes Mal ein manueller Eingriff nötig ist.
4. **Doppelte Rechtsform bereinigen:** Die Namens-Normalisierung wird so erweitert, dass mehrfach angehängte Rechtsformen („… Limited Limited", „… HandelsgesmbH HandelsgesmbH") vor dem Abgleich zusammengefasst werden. Das verhindert die Ursache bei künftigen Analysen.

Hinweis: 1 Beleg (HoT Telekom) bleibt bewusst in der Review — er ist als Duplikat markiert, und Duplikate werden absichtlich nie automatisch freigegeben.

## Technische Details

- Neue Edge Function `reconcile-vendors` (bzw. Erweiterung der bestehenden Zuordnungslogik in eine geteilte Datei unter `supabase/functions/_shared/`), damit Extraktion und Nach-Abgleich exakt dieselbe Matching-Regel nutzen.
- Erweiterung von `normalizeVendorName` um Dedupe wiederholter Rechtsform-Suffixe.
- Button/Banner in `src/pages/Review.tsx`, der die Funktion für den angemeldeten Nutzer aufruft und Anzahl zugeordneter/freigegebener Belege zurückmeldet.
- Einmaliger Backfill über dieselbe Funktion, kein separates Skript.
