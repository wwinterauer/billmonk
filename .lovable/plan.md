

# Split-View Editor mit PDF-Vorschau, Versand & Druck — Aktualisierter Plan

## Überblick

Der `InvoiceEditor` wird für alle Dokumenttypen (Angebot, Auftragsbestätigung, Lieferschein, Rechnung) um ein Side-by-Side-Layout mit PDF-Vorschau erweitert. Zusätzlich wird in allen Übersichtsseiten ein PDF-Viewer-Dialog eingebaut.

## Status-Workflow

| Aktion | Neuer Status |
|---|---|
| Speichern | `draft` (Entwurf) |
| Vorschau generieren | Bleibt `draft`, PDF wird erzeugt |
| **Freigeben** | `approved` (Freigegeben) — neuer Status |
| **Versenden** | `sent` (Versendet) |
| Bezahlt markieren | `paid` |

**Neuer Status `approved`** wird in alle `STATUS_CONFIG`-Maps eingefügt (Label: "Freigegeben", Variant: `outline` mit grünem Akzent).

## Neue Komponenten

### `src/components/invoices/DocumentPreviewPanel.tsx`
- Zeigt PDF inline via `PdfViewer` (bereits vorhanden)
- Aktionsleiste: Vorschau generieren, Freigeben, Versenden, Drucken, Herunterladen
- Status-Badge zeigt aktuellen Dokumentstatus
- "Freigeben" setzt Status auf `approved`, "Versenden" öffnet SendDocumentDialog und setzt auf `sent`

### `src/components/invoices/SendDocumentDialog.tsx`
- Modal mit vorausgefüllter E-Mail (aus `customer.email`), Betreff, Nachrichtentext
- "In Mail-App öffnen" → `mailto:` Link + automatischer PDF-Download
- "Link kopieren" → Signed URL

### `src/components/invoices/PdfPreviewDialog.tsx`
- Einfacher Dialog mit `PdfViewer` zum Öffnen von PDFs aus den Übersichtsseiten
- Wird in allen vier Übersichtsseiten verwendet

## Geänderte Dateien

### `src/pages/InvoiceEditor.tsx`
- Layout: `max-w-5xl` → Grid mit zwei Spalten (links Formular ~60%, rechts `DocumentPreviewPanel` ~40%)
- Mobil: Vorschau unterhalb als aufklappbares Panel
- `handleSave` speichert als `draft`, bleibt im Editor (navigiert nicht weg)
- Neue States: `previewPdfUrl`, `currentStatus`, `savedInvoiceId`
- Bisherige Action-Buttons ("Als Entwurf speichern" / "Speichern & Versenden") werden ersetzt durch: Speichern, Vorschau, Freigeben, Versenden, Drucken

### `src/pages/Invoices.tsx`, `Quotes.tsx`, `OrderConfirmations.tsx`, `DeliveryNotes.tsx`
- `approved` Status zu `STATUS_CONFIG` hinzufügen (Label: "Freigegeben")
- PDF-Icon-Button in Tabellenzeile wenn `pdf_storage_path` vorhanden → öffnet `PdfPreviewDialog`
- Bestehende "PDF generieren" Dropdown-Aktion bleibt erhalten

### `src/hooks/useInvoices.ts`
- `updateInvoiceStatus` unterstützt bereits beliebige Status-Strings, kein Umbau nötig

## Keine DB-Migration nötig
Alle Felder (`pdf_storage_path`, `status`, `sent_at`, `sent_to_email`) existieren bereits. Der Status ist ein `text`-Feld, `approved` kann direkt verwendet werden.

## Zusammenfassung der Änderungen

| Datei | Änderung |
|---|---|
| `src/components/invoices/DocumentPreviewPanel.tsx` | **Neu** — PDF-Vorschau + Aktionen |
| `src/components/invoices/SendDocumentDialog.tsx` | **Neu** — Mail-Versand-Dialog |
| `src/components/invoices/PdfPreviewDialog.tsx` | **Neu** — PDF-Viewer-Dialog für Übersichten |
| `src/pages/InvoiceEditor.tsx` | Split-Layout, neue Workflow-Buttons |
| `src/pages/Invoices.tsx` | `approved` Status, PDF-Preview in Tabelle |
| `src/pages/Quotes.tsx` | `approved` Status, PDF-Preview in Tabelle |
| `src/pages/OrderConfirmations.tsx` | `approved` Status, PDF-Preview in Tabelle |
| `src/pages/DeliveryNotes.tsx` | `approved` Status, PDF-Preview in Tabelle |

