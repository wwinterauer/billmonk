

## Plan: E-Mail-Versand mit PDF-Anhang über Gmail/IMAP

### Übersicht
Dokumente werden direkt über das hinterlegte E-Mail-Konto des Users versendet — mit dem PDF als echtem Anhang. Kein Download-Link, kein externer E-Mail-Dienst.

### Schritte

1. **Gmail-Scope erweitern**
   - `gmail.send` Scope zu `oauth-start` und `src/types/email.ts` hinzufügen
   - Bereits verbundene Gmail-User müssen sich einmalig neu verbinden (Hinweis im UI)

2. **Neue Edge Function `send-document-email`**
   - Empfängt: `accountId`, `recipientEmail`, `subject`, `body`, `pdfStoragePath`, `invoiceId`
   - Lädt PDF aus Supabase Storage (`invoices` Bucket) via Service Role
   - Baut MIME-Nachricht (`multipart/mixed`): Text-Body + Base64-kodiertes PDF als Anhang
   - **Gmail**: Sendet via `POST gmail.googleapis.com/gmail/v1/users/me/messages/send` (Base64url-kodierte MIME-Nachricht)
   - **SMTP**: Verbindet via TLS (Port 587), `EHLO → STARTTLS → AUTH LOGIN → DATA` mit der fertigen MIME-Nachricht
   - Setzt Invoice-Status auf `sent` und `sent_at`
   - Token-Refresh für Gmail wird aus `sync-gmail` übernommen

3. **SendDocumentDialog erweitern**
   - Dropdown "Senden über" mit den hinterlegten E-Mail-Konten des Users (Query auf `email_accounts`)
   - Neuer primärer Button "Direkt versenden"
   - Ladeindikator + Erfolgsmeldung
   - Bisheriger "In Mail-App öffnen" bleibt als Fallback

4. **DocumentPreviewPanel & InvoiceEditor anpassen**
   - `pdfStoragePath` an SendDocumentDialog durchreichen

5. **Config aktualisieren**
   - `send-document-email` mit `verify_jwt = false` in `supabase/config.toml`

### Technische Details

**MIME-Aufbau:**
```text
Content-Type: multipart/mixed; boundary="boundary123"

--boundary123
Content-Type: text/plain; charset=utf-8

[Nachrichtentext]

--boundary123
Content-Type: application/pdf
Content-Disposition: attachment; filename="RE-2024-001.pdf"
Content-Transfer-Encoding: base64

[Base64-kodiertes PDF]
--boundary123--
```

**Gmail API:** Die fertige MIME-Nachricht wird Base64url-kodiert und als `{ raw: "..." }` an die Gmail API gesendet.

**SMTP:** Gleicher MIME-Body, gesendet über eine TLS-Verbindung mit den gespeicherten IMAP-Zugangsdaten (Host/Port werden auf SMTP-Äquivalent umgemappt, z.B. `imap.gmail.com` → `smtp.gmail.com`).

