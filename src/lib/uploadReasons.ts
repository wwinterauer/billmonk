// Maps machine reason codes from `upload_file_events` to plain German text
// shown in the upload overview.

export type UploadOutcome = 'pending' | 'uploaded' | 'duplicate' | 'rejected' | 'failed';

export interface UploadEventRow {
  id: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  phase: string | null;
  outcome: UploadOutcome | string | null;
  reason_code: string | null;
  error_message: string | null;
  updated_at: string;
}

const REASONS: Record<string, string> = {
  unsupported_type: 'Dateityp wird nicht unterstützt (erlaubt: PDF, JPG, PNG, WebP)',
  file_too_large: 'Datei zu groß (max. 10 MB)',
  batch_limit: 'Über dem Stapel-Limit von 500 Dateien',
  active_upload_limit: 'Zu viele gleichzeitig aktive Uploads',
  duplicate_in_selection: 'Doppelt in dieser Auswahl (identische Datei)',
  existing_duplicate_skipped: 'Bereits vorhanden — von dir übersprungen',
  existing_duplicate_uploaded: 'Bereits vorhanden — trotzdem hochgeladen',
  content_duplicate: 'Inhaltsgleich zu einem bestehenden Beleg',
  race_duplicate_preinsert: 'Beim Speichern als bereits vorhanden erkannt',
  upload_or_processing_failed: 'Upload oder Verarbeitung fehlgeschlagen',
  duplicate_check_failed: 'Duplikat-Prüfung fehlgeschlagen',
};

export function describeReason(row: UploadEventRow): string {
  const base = row.reason_code ? REASONS[row.reason_code] : undefined;
  if (base && row.error_message) return `${base} — ${row.error_message}`;
  if (base) return base;
  if (row.error_message) return row.error_message;
  if (row.outcome === 'pending') {
    if (row.phase === 'storage-upload') return 'Wird gerade hochgeladen';
    if (row.phase === 'selected') return 'Noch nicht gestartet';
    return 'In Bearbeitung';
  }
  return 'Erfolgreich verarbeitet';
}

export function hintForReason(reasonCode: string | null): string | null {
  switch (reasonCode) {
    case 'unsupported_type':
      return 'Datei ggf. ohne Endung gespeichert — als .pdf neu speichern und erneut hochladen.';
    case 'file_too_large':
      return 'Datei komprimieren oder in mehrere PDFs aufteilen.';
    case 'batch_limit':
    case 'active_upload_limit':
      return 'Diese Dateien in einem zweiten Durchgang hochladen.';
    default:
      return null;
  }
}

export function eventsToCsv(rows: UploadEventRow[]): string {
  const header = ['Datei', 'Größe (Bytes)', 'Typ', 'Ergebnis', 'Phase', 'Grund'];
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = rows.map(row =>
    [
      row.file_name ?? '',
      String(row.file_size ?? ''),
      row.mime_type ?? '',
      String(row.outcome ?? ''),
      row.phase ?? '',
      describeReason(row),
    ]
      .map(escape)
      .join(';'),
  );
  return [header.map(escape).join(';'), ...lines].join('\n');
}

// ---------------------------------------------------------------------------
// Processing errors (receipts.status = 'error' / stuck in pending|processing)
// ---------------------------------------------------------------------------

export interface ProcessingProblem {
  title: string;
  hint: string | null;
}

export function describeProcessingProblem(
  status: string,
  notes: string | null,
): ProcessingProblem {
  const text = (notes ?? '').toLowerCase();

  if (status === 'pending') {
    return {
      title: 'Verarbeitung nie gestartet',
      hint: 'Vermutlich wurde der Tab während des Uploads geschlossen. Einfach erneut analysieren.',
    };
  }
  if (status === 'processing') {
    return {
      title: 'In Verarbeitung stecken geblieben',
      hint: 'Die KI-Analyse wurde unterbrochen. Erneut analysieren startet sie neu.',
    };
  }
  if (text.includes('credit') || text.includes('limit') || text.includes('402') || text.includes('403')) {
    return {
      title: 'KI-Limit erreicht',
      hint: 'Das Guthaben-/Nutzungslimit war aufgebraucht. Nach Aufstocken erneut analysieren.',
    };
  }
  if (text.includes('429') || text.includes('rate')) {
    return {
      title: 'Zu viele Anfragen gleichzeitig',
      hint: 'Kurz warten und erneut analysieren.',
    };
  }
  if (text.includes('timeout') || text.includes('zeit')) {
    return { title: 'Zeitüberschreitung bei der Analyse', hint: 'Erneut analysieren.' };
  }
  if (text.includes('pdf') || text.includes('lesbar') || text.includes('parse') || text.includes('convert')) {
    return {
      title: 'Datei konnte nicht gelesen werden',
      hint: 'Datei prüfen (Passwortschutz, Scanqualität) oder Daten manuell erfassen.',
    };
  }
  if (notes) return { title: 'Analyse fehlgeschlagen', hint: notes };
  return { title: 'Unbekannter Fehler bei der Analyse', hint: 'Erneut analysieren oder manuell erfassen.' };
}
