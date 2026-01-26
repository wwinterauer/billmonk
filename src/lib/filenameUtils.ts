import { format as formatDateFns } from 'date-fns';

export interface NamingSettings {
  template: string;
  replaceUmlauts: boolean;
  replaceSpaces: boolean;
  removeSpecialChars: boolean;
  lowercase: boolean;
  dateFormat: string;
  emptyFieldHandling: 'remove' | 'keep' | 'placeholder';
}

export const DEFAULT_NAMING_SETTINGS: NamingSettings = {
  template: '{datum}_{lieferant}_{betrag}',
  replaceUmlauts: true,
  replaceSpaces: true,
  removeSpecialChars: true,
  lowercase: false,
  dateFormat: 'YYYY-MM-DD',
  emptyFieldHandling: 'remove',
};

export interface ReceiptData {
  vendor?: string | null;
  vendor_brand?: string | null;
  receipt_date?: string | Date | null;
  amount_gross?: number | null;
  category?: string | null;
  invoice_number?: string | null;
  payment_method?: string | null;
  file_name?: string | null;
  custom_filename?: string | null;
}

function formatDate(dateStr: string | Date | null | undefined, dateFormat: string): string {
  if (!dateStr) return '';
  
  try {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(date.getTime())) return '';
    
    // Map custom format to date-fns format
    let fnsFormat = dateFormat
      .replace('YYYY', 'yyyy')
      .replace('YY', 'yy')
      .replace('MM', 'MM')
      .replace('DD', 'dd');
    
    return formatDateFns(date, fnsFormat);
  } catch {
    return '';
  }
}

function getDateParts(dateStr: string | Date | null | undefined): { year: string; year2: string; month: string; day: string } {
  const empty = { year: '', year2: '', month: '', day: '' };
  if (!dateStr) return empty;
  
  try {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(date.getTime())) return empty;
    
    return {
      year: formatDateFns(date, 'yyyy'),
      year2: formatDateFns(date, 'yy'),
      month: formatDateFns(date, 'MM'),
      day: formatDateFns(date, 'dd'),
    };
  } catch {
    return empty;
  }
}

function applyTransformations(text: string, settings: NamingSettings): string {
  let result = text;

  if (settings.replaceUmlauts) {
    result = result
      .replace(/ä/g, 'ae')
      .replace(/Ä/g, 'Ae')
      .replace(/ö/g, 'oe')
      .replace(/Ö/g, 'Oe')
      .replace(/ü/g, 'ue')
      .replace(/Ü/g, 'Ue')
      .replace(/ß/g, 'ss');
  }

  if (settings.replaceSpaces) {
    result = result.replace(/\s+/g, '_');
  }

  if (settings.removeSpecialChars) {
    result = result.replace(/[^a-zA-Z0-9_\-.]/g, '');
  }

  if (settings.lowercase) {
    result = result.toLowerCase();
  }

  // Clean up multiple underscores
  result = result.replace(/_+/g, '_').replace(/^_|_$/g, '');

  return result;
}

export function getFileExtension(fileName?: string | null): string {
  if (!fileName) return 'pdf';
  const match = fileName.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : 'pdf';
}

function getFileNameWithoutExtension(fileName?: string | null): string {
  if (!fileName) return 'beleg';
  return fileName.replace(/\.[^/.]+$/, '');
}

function handleEmptyField(value: string | null | undefined, settings: NamingSettings, placeholder: string = ''): string {
  if (!value || value.trim() === '') {
    switch (settings.emptyFieldHandling) {
      case 'keep':
        return placeholder;
      case 'placeholder':
        return 'unbekannt';
      case 'remove':
      default:
        return '';
    }
  }
  return value.trim();
}

/**
 * Generate a filename based on receipt data and naming settings
 */
export function generateFileName(
  receipt: ReceiptData,
  settings: NamingSettings,
  index: number = 1
): string {
  let name = settings.template;

  // Date placeholders
  const formattedDate = formatDate(receipt.receipt_date, settings.dateFormat);
  const dateParts = getDateParts(receipt.receipt_date);
  
  name = name.replace(/{datum}/g, formattedDate);
  name = name.replace(/{jahr}/g, dateParts.year);
  name = name.replace(/{jahr2}/g, dateParts.year2);
  name = name.replace(/{monat}/g, dateParts.month);
  name = name.replace(/{tag}/g, dateParts.day);

  // Beleg-Info placeholders - prefer vendor_brand if available for lieferant
  const vendorDisplay = receipt.vendor_brand || receipt.vendor;
  name = name.replace(/{lieferant}/g, handleEmptyField(vendorDisplay, settings));
  name = name.replace(/{betrag}/g, receipt.amount_gross?.toFixed(2) || '0');
  name = name.replace(/{betrag_int}/g, receipt.amount_gross ? Math.round(receipt.amount_gross * 100).toString() : '0');
  name = name.replace(/{kategorie}/g, handleEmptyField(receipt.category, settings));
  name = name.replace(/{rechnungsnummer}/g, handleEmptyField(receipt.invoice_number, settings));
  name = name.replace(/{zahlungsart}/g, handleEmptyField(receipt.payment_method, settings));

  // System placeholders
  name = name.replace(/{nummer}/g, String(index).padStart(3, '0'));
  name = name.replace(/{original}/g, getFileNameWithoutExtension(receipt.file_name));

  // Apply transformations
  name = applyTransformations(name, settings);

  // Add file extension
  const extension = getFileExtension(receipt.file_name);
  return name + '.' + extension;
}

/**
 * Get the export filename for a receipt (custom or generated)
 */
export function getExportFilename(
  receipt: ReceiptData,
  settings: NamingSettings,
  index: number = 1
): string {
  // If custom_filename is set, use it with proper extension
  if (receipt.custom_filename) {
    const extension = getFileExtension(receipt.file_name);
    return receipt.custom_filename + '.' + extension;
  }
  
  // Otherwise generate from template
  return generateFileName(receipt, settings, index);
}

/**
 * Parse naming settings from database JSON
 */
export function parseNamingSettings(data: Record<string, unknown> | null): NamingSettings {
  if (!data) return DEFAULT_NAMING_SETTINGS;
  
  return {
    template: (data.template as string) || DEFAULT_NAMING_SETTINGS.template,
    replaceUmlauts: data.replaceUmlauts !== undefined ? Boolean(data.replaceUmlauts) : DEFAULT_NAMING_SETTINGS.replaceUmlauts,
    replaceSpaces: data.replaceSpaces !== undefined ? Boolean(data.replaceSpaces) : DEFAULT_NAMING_SETTINGS.replaceSpaces,
    removeSpecialChars: data.removeSpecialChars !== undefined ? Boolean(data.removeSpecialChars) : DEFAULT_NAMING_SETTINGS.removeSpecialChars,
    lowercase: data.lowercase !== undefined ? Boolean(data.lowercase) : DEFAULT_NAMING_SETTINGS.lowercase,
    dateFormat: (data.dateFormat as string) || DEFAULT_NAMING_SETTINGS.dateFormat,
    emptyFieldHandling: (data.emptyFieldHandling as NamingSettings['emptyFieldHandling']) || DEFAULT_NAMING_SETTINGS.emptyFieldHandling,
  };
}
