import * as XLSX from 'xlsx';

/** Gebietsschema-unabhängiges Datumsformat */
export const DATE_FMT = 'DD.MM.YYYY';

/** Excel-Formatvorlage "Buchhaltung" mit 2 Dezimalstellen und €-Symbol */
export const ACCOUNTING_FMT = '_-* #,##0.00\\ "€"_-;\\-* #,##0.00\\ "€"_-;_-* "-"??\\ "€"_-;_-@_-';

/** Wandelt einen Datumswert in ein Date-Objekt um. Ungültig/leer => '' */
export function toExcelDate(value: unknown): Date | '' {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) return isNaN(value.getTime()) ? '' : value;
  const str = String(value);
  // ISO (YYYY-MM-DD) bevorzugt, ohne Zeitzonen-Verschiebung
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return isNaN(d.getTime()) ? '' : d;
  }
  const de = str.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (de) {
    const d = new Date(Number(de[3]), Number(de[2]) - 1, Number(de[1]));
    return isNaN(d.getTime()) ? '' : d;
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? '' : parsed;
}

/**
 * Setzt ein Zahlenformat (cell.z) auf alle Zellen einer Spalte.
 * Leere Zellen und Text bleiben unberührt.
 */
export function applyColumnFormat(
  worksheet: XLSX.WorkSheet,
  colIndex: number,
  fmt: string,
  startRow = 0,
): void {
  const ref = worksheet['!ref'];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  for (let r = Math.max(range.s.r, startRow); r <= range.e.r; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: colIndex });
    const cell = worksheet[addr] as XLSX.CellObject | undefined;
    if (!cell) continue;
    if (cell.t === 'n' || cell.t === 'd') {
      cell.z = fmt;
    }
  }
}
