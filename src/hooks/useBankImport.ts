import { useState } from 'react';

// ============= Interfaces =============

export interface ParsedTransaction {
  date: Date;
  valueDate?: Date;
  description: string;
  amount: number;
  isExpense: boolean;
  rawData: Record<string, string>;
}

export interface ParseResult {
  success: boolean;
  transactions: ParsedTransaction[];
  totalRows: number;
  expenses: number;
  income: number;
  errors: string[];
}

export interface BankConfig {
  delimiter: string;
  dateColumn: string[];
  valueDateColumn?: string[];
  amountColumn: string[];
  descriptionColumn: string[];
  decimalSeparator: string;
  thousandSeparator: string;
  skipRows: number;
  encoding: string;
}

// ============= Bank Configurations =============

export const bankConfigs: Record<string, BankConfig> = {
  'erste-sparkasse': {
    delimiter: 'auto',
    dateColumn: ['Buchungsdatum', 'Datum', 'Buchungstag', 'Umsatztag'],
    valueDateColumn: ['Valutadatum', 'Wertstellung', 'Valuta'],
    amountColumn: ['Betrag', 'Umsatz', 'Umsatzbetrag', 'Betrag in EUR'],
    descriptionColumn: ['Buchungstext', 'Verwendungszweck', 'Umsatzbezeichnung', 'Auftraggeber/Empfänger', 'Text'],
    decimalSeparator: 'auto',
    thousandSeparator: 'auto',
    skipRows: 0,
    encoding: 'iso-8859-1'
  },
  'raiffeisen': {
    delimiter: 'auto',
    dateColumn: ['Buchungstag', 'Buchungsdatum', 'Datum', 'Umsatztag'],
    valueDateColumn: ['Valuta', 'Wertstellung', 'Valutadatum'],
    amountColumn: ['Betrag', 'Umsatz', 'Umsatzbetrag', 'Betrag in EUR'],
    descriptionColumn: ['Buchungstext', 'Umsatzbezeichnung', 'Verwendungszweck', 'Auftraggeber/Empfänger', 'Text'],
    decimalSeparator: 'auto',
    thousandSeparator: 'auto',
    skipRows: 0,
    encoding: 'iso-8859-1'
  },
  'bank-austria': {
    delimiter: 'auto',
    dateColumn: ['Buchungsdatum', 'Datum', 'Buchungstag'],
    valueDateColumn: ['Valutadatum', 'Wertstellung', 'Valuta'],
    amountColumn: ['Betrag', 'Umsatz', 'Betrag in EUR'],
    descriptionColumn: ['Zahlungsreferenz', 'Buchungstext', 'Umsatzbezeichnung', 'Verwendungszweck', 'Auftraggeber/Empfänger'],
    decimalSeparator: 'auto',
    thousandSeparator: 'auto',
    skipRows: 0,
    encoding: 'iso-8859-1'
  },
  'bawag': {
    delimiter: 'auto',
    dateColumn: ['Buchungsdatum', 'Datum', 'Buchungstag'],
    valueDateColumn: ['Valutadatum', 'Wertstellung', 'Valuta'],
    amountColumn: ['Betrag', 'Umsatz', 'Betrag in EUR'],
    descriptionColumn: ['Buchungstext', 'Verwendungszweck', 'Umsatzbezeichnung', 'Auftraggeber/Empfänger'],
    decimalSeparator: 'auto',
    thousandSeparator: 'auto',
    skipRows: 0,
    encoding: 'iso-8859-1'
  },
  'easybank': {
    delimiter: 'auto',
    dateColumn: ['Buchungsdatum', 'Datum', 'Buchungstag'],
    valueDateColumn: ['Valutadatum', 'Wertstellung', 'Valuta'],
    amountColumn: ['Betrag', 'Umsatz', 'Betrag in EUR'],
    descriptionColumn: ['Buchungstext', 'Verwendungszweck', 'Umsatzbezeichnung', 'Auftraggeber/Empfänger'],
    decimalSeparator: 'auto',
    thousandSeparator: 'auto',
    skipRows: 0,
    encoding: 'iso-8859-1'
  },
  'n26': {
    delimiter: 'auto',
    dateColumn: ['Datum', 'Date', 'Booking Date', 'Buchungsdatum'],
    valueDateColumn: ['Wertstellung', 'Value Date', 'Valutadatum'],
    amountColumn: ['Betrag (EUR)', 'Amount (EUR)', 'Betrag', 'Amount'],
    descriptionColumn: ['Empfänger', 'Verwendungszweck', 'Partner Name', 'Payment reference', 'Buchungstext'],
    decimalSeparator: 'auto',
    thousandSeparator: 'auto',
    skipRows: 0,
    encoding: 'utf-8'
  },
  'other': {
    delimiter: 'auto',
    dateColumn: ['datum', 'date', 'buchungsdatum', 'buchungstag', 'umsatztag', 'posting date', 'booking date', 'buchungs-/wertstellungsdatum'],
    amountColumn: ['betrag', 'amount', 'summe', 'umsatz', 'umsatzbetrag', 'betrag in eur'],
    descriptionColumn: ['beschreibung', 'text', 'buchungstext', 'verwendungszweck', 'umsatzbezeichnung', 'auftraggeber/empfänger', 'memo', 'partner name', 'empfänger'],
    decimalSeparator: 'auto',
    thousandSeparator: 'auto',
    skipRows: 0,
    encoding: 'utf-8'
  }
};

// Soll/Haben column pairs (debit + credit) — used when no single amount column is found
const DEBIT_CREDIT_PAIRS: Array<[string[], string[]]> = [
  [['soll', 'belastung', 'ausgang', 'debit'], ['haben', 'gutschrift', 'eingang', 'credit']],
];

// Keywords used by the auto-header detector
const HEADER_KEYWORDS = [
  'datum', 'date', 'buchung', 'valuta', 'wertstellung', 'umsatztag',
  'betrag', 'amount', 'umsatz', 'soll', 'haben', 'belastung', 'gutschrift',
  'verwendungszweck', 'buchungstext', 'beschreibung', 'empfänger', 'auftraggeber',
];

// ============= Helper Functions =============

/**
 * Detect the most likely delimiter in CSV content
 */
function detectDelimiter(content: string): string {
  const firstLines = content.split('\n').slice(0, 5).join('\n');
  const semicolonCount = (firstLines.match(/;/g) || []).length;
  const commaCount = (firstLines.match(/,/g) || []).length;
  const tabCount = (firstLines.match(/\t/g) || []).length;
  
  if (tabCount > semicolonCount && tabCount > commaCount) return '\t';
  if (semicolonCount > commaCount) return ';';
  return ',';
}

/**
 * Detect decimal separator based on amount patterns
 */
function detectDecimalSeparator(content: string): string {
  // Look for patterns like "1.234,56" (German) or "1,234.56" (English)
  const germanPattern = /\d+\.\d{3},\d{2}/;
  const englishPattern = /\d+,\d{3}\.\d{2}/;
  
  if (germanPattern.test(content)) return ',';
  if (englishPattern.test(content)) return '.';
  
  // Default to German format for Austrian banks
  return ',';
}

/**
 * Find column index by checking multiple possible column names
 */
function normalizeHeader(s: string): string {
  return (s || '')
    .replace(/\uFEFF/g, '')
    .toLowerCase()
    .replace(/["']/g, '')
    .replace(/[\s_\-./()\\]+/g, '')
    .trim();
}

function findColumn(headers: string[], possibleNames: string[]): number {
  const normalizedHeaders = headers.map(normalizeHeader);

  for (const name of possibleNames) {
    const target = normalizeHeader(name);
    if (!target) continue;
    const index = normalizedHeaders.indexOf(target);
    if (index !== -1) return index;
  }

  for (const name of possibleNames) {
    const target = normalizeHeader(name);
    if (!target) continue;
    const index = normalizedHeaders.findIndex(h => h && (h.includes(target) || target.includes(h)));
    if (index !== -1) return index;
  }

  return -1;
}

/** Find the first matching column from any of the candidate name lists. */
function findAnyColumn(headers: string[], lists: string[][]): number {
  for (const list of lists) {
    const idx = findColumn(headers, list);
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Parse amount string to number based on bank config
 */
function parseAmount(value: string, config: BankConfig): number {
  if (!value || value.trim() === '') return 0;
  
  let cleanValue = value.trim();
  
  // Remove currency symbols and whitespace
  cleanValue = cleanValue.replace(/[€$£\s]/g, '');
  
  // Handle auto-detection
  let decimalSep = config.decimalSeparator;
  let thousandSep = config.thousandSeparator;
  
  if (decimalSep === 'auto') {
    // Try to detect based on pattern
    if (/\d+\.\d{3},\d+/.test(cleanValue)) {
      decimalSep = ',';
      thousandSep = '.';
    } else if (/\d+,\d{3}\.\d+/.test(cleanValue)) {
      decimalSep = '.';
      thousandSep = ',';
    } else if (cleanValue.includes(',')) {
      decimalSep = ',';
      thousandSep = '.';
    } else {
      decimalSep = '.';
      thousandSep = ',';
    }
  }
  
  // Remove thousand separators
  if (thousandSep === '.') {
    cleanValue = cleanValue.replace(/\./g, '');
  } else if (thousandSep === ',') {
    cleanValue = cleanValue.replace(/,/g, '');
  }
  
  // Replace decimal separator with dot
  if (decimalSep === ',') {
    cleanValue = cleanValue.replace(',', '.');
  }
  
  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Parse date string to Date object
 * Supports: DD.MM.YYYY, YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY
 */
function parseDate(value: string): Date | null {
  if (!value || value.trim() === '') return null;

  const cleanValue = value.trim().replace(/\uFEFF/g, '');

  // DD.MM.YYYY or DD.MM.YY
  const germanMatch = cleanValue.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (germanMatch) {
    const [, day, month, yearRaw] = germanMatch;
    const year = yearRaw.length === 2 ? 2000 + parseInt(yearRaw) : parseInt(yearRaw);
    return new Date(year, parseInt(month) - 1, parseInt(day));
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = cleanValue.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // DD/MM/YYYY or DD-MM-YYYY (European, day-first)
  const slashMatch = cleanValue.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (slashMatch) {
    const [, day, month, yearRaw] = slashMatch;
    const year = yearRaw.length === 2 ? 2000 + parseInt(yearRaw) : parseInt(yearRaw);
    return new Date(year, parseInt(month) - 1, parseInt(day));
  }

  // Excel serial number (e.g. 45234)
  if (/^\d{4,6}$/.test(cleanValue)) {
    const serial = parseInt(cleanValue);
    if (serial > 20000 && serial < 80000) {
      // Excel epoch: 1899-12-30 (accounts for the Lotus 1900 leap year bug)
      const ms = (serial - 25569) * 86400 * 1000;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) return d;
    }
  }

  const parsed = new Date(cleanValue);
  if (!isNaN(parsed.getTime())) return parsed;

  return null;
}

/**
 * Parse CSV content into rows
 */
function parseCsvContent(content: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];
    
    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(cell => cell !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
        if (char === '\r') i++; // Skip \n after \r
      } else if (char !== '\r') {
        currentCell += char;
      }
    }
  }
  
  // Don't forget the last cell/row
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(cell => cell !== '')) {
      rows.push(currentRow);
    }
  }
  
  return rows;
}

/**
 * Read file content with proper encoding
 */
async function readFileContent(file: File, encoding: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      if (event.target?.result) {
        resolve(event.target.result as string);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    
    reader.onerror = () => reject(new Error('File reading failed'));
    
    // Try to read with specified encoding
    if (encoding === 'iso-8859-1' || encoding === 'latin1') {
      reader.readAsText(file, 'ISO-8859-1');
    } else {
      reader.readAsText(file, 'UTF-8');
    }
  });
}

// ============= Main Parse Function =============

export async function parseCsvFile(file: File, bankType: string): Promise<ParseResult> {
  const errors: string[] = [];
  const transactions: ParsedTransaction[] = [];
  
  try {
    // Get bank config
    const config = bankConfigs[bankType] || bankConfigs['other'];
    
    // Read file content
    let content: string;
    try {
      content = await readFileContent(file, config.encoding);
    } catch {
      // Fallback to UTF-8 if encoding fails
      content = await readFileContent(file, 'utf-8');
    }
    
    // Strip BOM
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }

    if (!content || content.trim() === '') {
      return {
        success: false,
        transactions: [],
        totalRows: 0,
        expenses: 0,
        income: 0,
        errors: ['Die Datei ist leer.']
      };
    }

    // Detect delimiter if auto
    const delimiter = config.delimiter === 'auto'
      ? detectDelimiter(content)
      : config.delimiter;

    // Update decimal separator detection if auto
    if (config.decimalSeparator === 'auto') {
      config.decimalSeparator = detectDecimalSeparator(content);
      config.thousandSeparator = config.decimalSeparator === ',' ? '.' : ',';
    }

    // Parse CSV
    const rows = parseCsvContent(content, delimiter);

    if (rows.length < 2) {
      return {
        success: false,
        transactions: [],
        totalRows: 0,
        expenses: 0,
        income: 0,
        errors: ['Die Datei enthält keine Daten.']
      };
    }

    // Auto-detect header row: scan first ~25 rows for one that contains a date/amount keyword
    // and has at least 3 mostly-textual cells. Falls back to config.skipRows.
    const looksLikeHeader = (row: string[]): boolean => {
      if (!row || row.length < 2) return false;
      const cells = row.map(c => normalizeHeader(c)).filter(Boolean);
      if (cells.length < 2) return false;
      const matches = cells.filter(c => HEADER_KEYWORDS.some(k => c.includes(k))).length;
      return matches >= 2;
    };

    let dataStartIndex = config.skipRows;
    const scanLimit = Math.min(rows.length, dataStartIndex + 25);
    for (let i = dataStartIndex; i < scanLimit; i++) {
      if (looksLikeHeader(rows[i])) {
        dataStartIndex = i;
        break;
      }
    }

    const headers = rows[dataStartIndex] || [];

    // Find column indices
    const dateColIndex = findColumn(headers, config.dateColumn);
    let amountColIndex = findColumn(headers, config.amountColumn);
    const descriptionColIndex = findColumn(headers, config.descriptionColumn);
    const valueDateColIndex = config.valueDateColumn
      ? findColumn(headers, config.valueDateColumn)
      : -1;

    // Soll/Haben fallback (debit + credit columns)
    let debitColIndex = -1;
    let creditColIndex = -1;
    if (amountColIndex === -1) {
      for (const [debitNames, creditNames] of DEBIT_CREDIT_PAIRS) {
        const d = findColumn(headers, debitNames);
        const c = findColumn(headers, creditNames);
        if (d !== -1 && c !== -1) {
          debitColIndex = d;
          creditColIndex = c;
          break;
        }
      }
    }

    const headersHint = headers.filter(h => h && h.trim()).join(', ') || '(keine Kopfzeile erkannt)';

    if (dateColIndex === -1) {
      errors.push(
        `Datumsspalte nicht gefunden. Erwartet z. B.: ${config.dateColumn.join(', ')}. ` +
        `Gefundene Spalten: ${headersHint}`
      );
    }
    if (amountColIndex === -1 && debitColIndex === -1) {
      errors.push(
        `Betragsspalte nicht gefunden. Erwartet z. B.: ${config.amountColumn.join(', ')} ` +
        `oder Soll/Haben. Gefundene Spalten: ${headersHint}`
      );
    }
    if (descriptionColIndex === -1) {
      errors.push(`Beschreibungsspalte nicht gefunden. Erwartet z. B.: ${config.descriptionColumn.join(', ')}`);
    }

    if (dateColIndex === -1 || (amountColIndex === -1 && debitColIndex === -1)) {
      return {
        success: false,
        transactions: [],
        totalRows: rows.length - dataStartIndex - 1,
        expenses: 0,
        income: 0,
        errors
      };
    }

    // Process data rows
    for (let i = dataStartIndex + 1; i < rows.length; i++) {
      const row = rows[i];

      // Skip empty rows
      if (!row || row.every(cell => !cell || cell.trim() === '')) {
        continue;
      }

      try {
        const date = parseDate(row[dateColIndex] || '');
        let amount: number;
        if (amountColIndex !== -1) {
          amount = parseAmount(row[amountColIndex] || '', config);
        } else {
          const debit = parseAmount(row[debitColIndex] || '', config);
          const credit = parseAmount(row[creditColIndex] || '', config);
          amount = credit - debit;
        }
        const description = descriptionColIndex !== -1
          ? row[descriptionColIndex] || ''
          : '';
        const valueDate = valueDateColIndex !== -1
          ? parseDate(row[valueDateColIndex] || '')
          : undefined;

        if (!date) {
          errors.push(`Zeile ${i + 1}: Ungültiges Datum "${row[dateColIndex]}"`);
          continue;
        }

        if (amount === 0) {
          continue;
        }

        const rawData: Record<string, string> = {};
        headers.forEach((header, index) => {
          if (header && row[index] !== undefined) {
            rawData[header] = row[index];
          }
        });

        transactions.push({
          date,
          valueDate: valueDate || undefined,
          description: description.trim(),
          amount: Math.abs(amount),
          isExpense: amount < 0,
          rawData
        });
      } catch (err) {
        errors.push(`Zeile ${i + 1}: Fehler beim Parsen`);
      }
    }
    
    // Calculate statistics
    const expenses = transactions.filter(t => t.isExpense).length;
    const income = transactions.filter(t => !t.isExpense).length;
    
    return {
      success: transactions.length > 0,
      transactions,
      totalRows: rows.length - dataStartIndex - 1,
      expenses,
      income,
      errors
    };
    
  } catch (err) {
    return {
      success: false,
      transactions: [],
      totalRows: 0,
      expenses: 0,
      income: 0,
      errors: [`Fehler beim Parsen: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`]
    };
  }
}

// ============= React Hook =============

export function useBankImport() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const processFile = async (file: File, bankType: string): Promise<ParseResult> => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const parseResult = await parseCsvFile(file, bankType);
      setResult(parseResult);
      return parseResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setError(errorMessage);
      return {
        success: false,
        transactions: [],
        totalRows: 0,
        expenses: 0,
        income: 0,
        errors: [errorMessage]
      };
    } finally {
      setIsProcessing(false);
    }
  };
  
  const reset = () => {
    setResult(null);
    setError(null);
  };
  
  return {
    processFile,
    isProcessing,
    result,
    error,
    reset,
    bankConfigs
  };
}

export default useBankImport;
