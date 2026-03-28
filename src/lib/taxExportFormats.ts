import { format } from 'date-fns';
import { saveAs } from 'file-saver';

// ── Types ──────────────────────────────────────────────

export type TaxExportFormat = 'datev' | 'bmd';
export type BookingType = 'expenses' | 'income' | 'both';

export interface TaxExportConfig {
  format: TaxExportFormat;
  bookingType: BookingType;
  dateFrom: Date;
  dateTo: Date;
  // DATEV specific
  beraterNr?: string;
  mandantenNr?: string;
  sachkontenLaenge?: number;
  wjBeginn?: string; // MM format, e.g. "01"
  // BMD specific
  // Common
  defaultExpenseAccount?: string; // e.g. "5000"
  defaultIncomeAccount?: string;  // e.g. "4000"
  bankAccount?: string;           // e.g. "2800"
}

interface BookingRow {
  amount: number;
  isExpense: boolean;
  account: string;
  counterAccount: string;
  buKey: string;
  date: string; // ddMM format for DATEV, dd.MM.yyyy for BMD
  text: string;
  invoiceNumber: string;
  vatRate: number | null;
  currency: string;
}

// ── BU-Key Mapping ────────────────────────────────────

const DATEV_BU_KEYS: Record<number, string> = {
  20: '9',
  19: '9',
  10: '8',
  13: '7',
  7: '2',
  5: '5',
  0: '40',
};

const BMD_TAX_CODES: Record<number, string> = {
  20: '020',
  19: '019',
  10: '010',
  13: '013',
  7: '007',
  5: '005',
  0: '000',
};

function getBUKey(vatRate: number | null): string {
  if (vatRate === null || vatRate === undefined) return '';
  const rounded = Math.round(vatRate);
  return DATEV_BU_KEYS[rounded] || '';
}

function getBMDTaxCode(vatRate: number | null): string {
  if (vatRate === null || vatRate === undefined) return '000';
  const rounded = Math.round(vatRate);
  return BMD_TAX_CODES[rounded] || '000';
}

// ── Formatting helpers ────────────────────────────────

function formatDecimalDE(num: number): string {
  return num.toFixed(2).replace('.', ',');
}

function escapeCSVField(val: string): string {
  if (val.includes(';') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

// ── Convert receipts/invoices to BookingRows ──────────

export interface ReceiptForExport {
  id?: string;
  receipt_date: string | null;
  amount_gross: number | null;
  amount_net: number | null;
  vat_rate: number | null;
  vat_amount: number | null;
  vendor: string | null;
  vendor_brand: string | null;
  description: string | null;
  invoice_number: string | null;
  category: string | null;
  currency: string | null;
  is_split_booking?: boolean;
}

export interface SplitLineForExport {
  receipt_id: string;
  description: string | null;
  category: string | null;
  amount_gross: number;
  amount_net: number;
  vat_rate: number;
  vat_amount: number;
  is_private: boolean;
  sort_order: number;
}

export interface InvoiceForExport {
  invoice_date: string | null;
  total: number | null;
  subtotal: number | null;
  vat_total: number | null;
  invoice_number: string;
  customer_name: string;
  currency: string | null;
}

function receiptToRow(r: ReceiptForExport, config: TaxExportConfig): BookingRow {
  const d = r.receipt_date ? new Date(r.receipt_date) : new Date();
  return {
    amount: Math.abs(r.amount_gross || 0),
    isExpense: true,
    account: config.defaultExpenseAccount || '5000',
    counterAccount: config.bankAccount || '2800',
    buKey: getBUKey(r.vat_rate),
    date: format(d, 'ddMM'),
    text: (r.vendor_brand || r.vendor || r.description || 'Beleg').substring(0, 60),
    invoiceNumber: r.invoice_number || '',
    vatRate: r.vat_rate,
    currency: r.currency || 'EUR',
  };
}

function splitLineToRow(
  line: SplitLineForExport, 
  receipt: ReceiptForExport, 
  config: TaxExportConfig
): BookingRow {
  const d = receipt.receipt_date ? new Date(receipt.receipt_date) : new Date();
  const text = [
    receipt.vendor_brand || receipt.vendor || '',
    line.description || line.category || '',
  ].filter(Boolean).join(' - ').substring(0, 60) || 'Split-Position';
  
  return {
    amount: Math.abs(line.amount_gross),
    isExpense: true,
    account: config.defaultExpenseAccount || '5000',
    counterAccount: config.bankAccount || '2800',
    buKey: getBUKey(line.vat_rate),
    date: format(d, 'ddMM'),
    text,
    invoiceNumber: receipt.invoice_number || '',
    vatRate: line.vat_rate,
    currency: receipt.currency || 'EUR',
  };
}

function invoiceToRow(inv: InvoiceForExport, config: TaxExportConfig): BookingRow {
  const d = inv.invoice_date ? new Date(inv.invoice_date) : new Date();
  const effectiveRate = inv.subtotal && inv.subtotal > 0
    ? Math.round((inv.vat_total || 0) / inv.subtotal * 100)
    : 0;
  return {
    amount: Math.abs(inv.total || 0),
    isExpense: false,
    account: config.defaultIncomeAccount || '4000',
    counterAccount: config.bankAccount || '2800',
    buKey: getBUKey(effectiveRate),
    date: format(d, 'ddMM'),
    text: (inv.customer_name || 'Rechnung').substring(0, 60),
    invoiceNumber: inv.invoice_number || '',
    vatRate: effectiveRate,
    currency: inv.currency || 'EUR',
  };
}

// ── DATEV Export ───────────────────────────────────────

function generateDATEVHeader(config: TaxExportConfig): string {
  const now = new Date();
  const wjBeginn = config.wjBeginn || '01';
  const wjYear = now.getFullYear();
  const dateFromStr = format(config.dateFrom, 'yyyyMMdd');
  const dateToStr = format(config.dateTo, 'yyyyMMdd');
  const berater = config.beraterNr || '0';
  const mandant = config.mandantenNr || '0';
  const skl = config.sachkontenLaenge || 4;
  const created = format(now, 'yyyyMMddHHmmss') + '000';

  // EXTF header line
  const headerLine = [
    '"EXTF"', '700', '21', '"Buchungsstapel"', '12', created,
    '', '', '"XP"', '', berater, mandant,
    `${wjYear}${wjBeginn}01`, skl.toString(), dateFromStr, dateToStr,
    '""', '""', '1', '0', '0', '"EUR"', '', '', '', '',
  ].join(';');

  // Column header line
  const columns = [
    'Umsatz (ohne Soll/Haben-Kz)', 'Soll/Haben-Kennzeichen',
    'WKZ Umsatz', 'Kurs', 'Basis-Umsatz', 'WKZ Basis-Umsatz',
    'Konto', 'Gegenkonto (ohne BU-Schlüssel)', 'BU-Schlüssel',
    'Belegdatum', 'Belegfeld 1', 'Belegfeld 2',
    'Skonto', 'Buchungstext', 'Postensperre', 'Diverse Adressnummer',
    'Geschäftspartnerbank', 'Sachverhalt', 'Zinssperre',
    'Beleglink', 'Beleginfo - Art 1', 'Beleginfo - Inhalt 1',
    'Beleginfo - Art 2', 'Beleginfo - Inhalt 2',
    'Beleginfo - Art 3', 'Beleginfo - Inhalt 3',
    'Beleginfo - Art 4', 'Beleginfo - Inhalt 4',
    'Beleginfo - Art 5', 'Beleginfo - Inhalt 5',
    'Beleginfo - Art 6', 'Beleginfo - Inhalt 6',
    'Beleginfo - Art 7', 'Beleginfo - Inhalt 7',
    'Beleginfo - Art 8', 'Beleginfo - Inhalt 8',
    'KOST1 - Kostenstelle', 'KOST2 - Kostenstelle', 'Kost-Menge',
    'EU-Land u. UStID', 'EU-Steuersatz',
    'Abw. Versteuerungsart', 'Sachverhalt L+L', 'Funktionsergänzung L+L',
    'BU 49 Hauptfunktionstyp', 'BU 49 Hauptfunktionsnummer',
    'BU 49 Funktionsergänzung', 'Zusatzinformation - Art 1',
    'Zusatzinformation - Inhalt 1', 'Zusatzinformation - Art 2',
    'Zusatzinformation - Inhalt 2', 'Zusatzinformation - Art 3',
    'Zusatzinformation - Inhalt 3', 'Zusatzinformation - Art 4',
    'Zusatzinformation - Inhalt 4', 'Zusatzinformation - Art 5',
    'Zusatzinformation - Inhalt 5', 'Zusatzinformation - Art 6',
    'Zusatzinformation - Inhalt 6', 'Zusatzinformation - Art 7',
    'Zusatzinformation - Inhalt 7', 'Zusatzinformation - Art 8',
    'Zusatzinformation - Inhalt 8', 'Zusatzinformation - Art 9',
    'Zusatzinformation - Inhalt 9', 'Zusatzinformation - Art 10',
    'Zusatzinformation - Inhalt 10', 'Zusatzinformation - Art 11',
    'Zusatzinformation - Inhalt 11', 'Zusatzinformation - Art 12',
    'Zusatzinformation - Inhalt 12', 'Zusatzinformation - Art 13',
    'Zusatzinformation - Inhalt 13', 'Zusatzinformation - Art 14',
    'Zusatzinformation - Inhalt 14', 'Zusatzinformation - Art 15',
    'Zusatzinformation - Inhalt 15', 'Zusatzinformation - Art 16',
    'Zusatzinformation - Inhalt 16', 'Zusatzinformation - Art 17',
    'Zusatzinformation - Inhalt 17', 'Zusatzinformation - Art 18',
    'Zusatzinformation - Inhalt 18', 'Zusatzinformation - Art 19',
    'Zusatzinformation - Inhalt 19', 'Zusatzinformation - Art 20',
    'Zusatzinformation - Inhalt 20', 'Stück', 'Gewicht',
    'Zahlweise', 'Forderungsart', 'Veranlagungsjahr', 'Zugeordnete Fälligkeit',
    'Skontotyp', 'Auftragsnummer', 'Buchungstyp', 'USt-Schlüssel (Anzahlungen)',
    'EU-Land (Anzahlungen)', 'Sachverhalt L+L (Anzahlungen)',
    'EU-Steuersatz (Anzahlungen)', 'Erlöskonto (Anzahlungen)',
    'Herkunft-Kz', 'Buchungs GUID', 'KOST-Datum',
    'SEPA-Mandatsreferenz', 'Skontosperre', 'Gesellschaftername',
    'Beteiligtennummer', 'Identifikationsnummer', 'Zeichnernummer',
    'Postensperre bis', 'Bezeichnung SoBil-Sachverhalt',
    'Kennzeichen SoBil-Buchung', 'Festschreibung',
    'Leistungsdatum', 'Datum Zuord. Steuerperiode',
    'Fälligkeit', 'Generalumkehr (GU)', 'Steuersatz',
    'Land',
  ].join(';');

  return headerLine + '\n' + columns;
}

function rowToDATEV(row: BookingRow): string {
  const sollHaben = row.isExpense ? 'S' : 'H';
  const fields = [
    formatDecimalDE(row.amount),    // Umsatz
    sollHaben,                       // S/H
    row.currency,                   // WKZ
    '', '', '',                     // Kurs, Basis-Umsatz, WKZ Basis
    row.account,                    // Konto
    row.counterAccount,             // Gegenkonto
    row.buKey,                      // BU-Schlüssel
    row.date,                       // Belegdatum (ddMM)
    escapeCSVField(row.invoiceNumber), // Belegfeld 1
    '',                             // Belegfeld 2
    '',                             // Skonto
    escapeCSVField(row.text),       // Buchungstext
  ];
  // Pad remaining fields with empty values (DATEV expects ~116 columns)
  while (fields.length < 116) fields.push('');
  return fields.join(';');
}

// ── BMD Export ────────────────────────────────────────

function rowToBMD(row: BookingRow, isExpense: boolean): string {
  const buchungsSymbol = isExpense ? 'ER' : 'AR';
  const d = row.date; // ddMM format, convert to dd.MM.yyyy
  const dateForBMD = row.date.length === 4
    ? `${d.substring(0, 2)}.${d.substring(2, 4)}.${new Date().getFullYear()}`
    : row.date;

  const fields = [
    buchungsSymbol,
    row.account,
    row.counterAccount,
    formatDecimalDE(row.amount),
    getBMDTaxCode(row.vatRate),
    dateForBMD,
    escapeCSVField(row.invoiceNumber),
    escapeCSVField(row.text),
    row.currency,
  ];
  return fields.join(';');
}

function generateBMDHeader(): string {
  return ['Satzart', 'Konto', 'Gegenkonto', 'Betrag', 'Steuercode', 'Datum', 'Belegnummer', 'Text', 'Währung'].join(';');
}

// ── Main Export Function ──────────────────────────────

export function generateTaxExport(
  config: TaxExportConfig,
  receipts: ReceiptForExport[],
  invoices: InvoiceForExport[],
): void {
  const rows: string[] = [];
  const bookingRows: BookingRow[] = [];

  if (config.bookingType === 'expenses' || config.bookingType === 'both') {
    receipts.forEach(r => bookingRows.push(receiptToRow(r, config)));
  }
  if (config.bookingType === 'income' || config.bookingType === 'both') {
    invoices.forEach(inv => bookingRows.push(invoiceToRow(inv, config)));
  }

  if (config.format === 'datev') {
    rows.push(generateDATEVHeader(config));
    bookingRows.forEach(row => rows.push(rowToDATEV(row)));

    const csv = rows.join('\n');
    const bom = '\ufeff';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
    const fileName = `EXTF_Buchungsstapel_${format(config.dateFrom, 'yyyy-MM-dd')}_${format(config.dateTo, 'yyyy-MM-dd')}.csv`;
    saveAs(blob, fileName);
  } else {
    // BMD
    rows.push(generateBMDHeader());
    bookingRows.forEach(row => rows.push(rowToBMD(row, row.isExpense)));

    const csv = rows.join('\n');
    const bom = '\ufeff';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
    const prefix = config.bookingType === 'income' ? 'AR' : config.bookingType === 'expenses' ? 'ER' : 'ER-AR';
    const fileName = `${prefix}-Buchungen_${format(config.dateFrom, 'yyyy-MM-dd')}_${format(config.dateTo, 'yyyy-MM-dd')}.csv`;
    saveAs(blob, fileName);
  }
}
