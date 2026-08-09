export type AmountQuery =
  | { kind: 'exact'; min: number; max: number }
  | { kind: 'gt'; value: number }
  | { kind: 'lt'; value: number }
  | { kind: 'range'; min: number; max: number };

const EPS = 0.005;

/** Parses "1.234,50" / "1234.50" / "1234,5" into a number (absolute value kept). */
function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, '').replace(/^[+-]/, '');
  if (!s || !/^[\d.,]+$/.test(s)) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let normalized: string;

  if (lastComma > -1 && lastDot > -1) {
    // The later separator is the decimal separator
    if (lastComma > lastDot) normalized = s.replace(/\./g, '').replace(',', '.');
    else normalized = s.replace(/,/g, '');
  } else if (lastComma > -1) {
    const decimals = s.length - lastComma - 1;
    // "1,234" with exactly 3 decimals is treated as a thousands separator
    normalized = decimals === 3 && s.indexOf(',') === lastComma && s.length > 4
      ? s.replace(/,/g, '')
      : s.replace(',', '.');
  } else if (lastDot > -1) {
    const decimals = s.length - lastDot - 1;
    normalized = decimals === 3 && s.indexOf('.') === lastDot && s.length > 4
      ? s.replace(/\./g, '')
      : s;
  } else {
    normalized = s;
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/**
 * Interprets a search input as an amount query.
 * Returns null when the input is not amount-like (plain text search).
 */
export function parseAmountQuery(input: string): AmountQuery | null {
  const q = input.trim();
  if (!q) return null;

  const opMatch = q.match(/^(>=|<=|>|<)\s*(.+)$/);
  if (opMatch) {
    const value = parseNumber(opMatch[2]);
    if (value === null) return null;
    const op = opMatch[1];
    if (op === '>' || op === '>=') return { kind: 'gt', value: op === '>' ? value + EPS : value - EPS };
    return { kind: 'lt', value: op === '<' ? value - EPS : value + EPS };
  }

  const rangeMatch = q.match(/^([\d.,]+)\s*(?:\.\.|--|–|-)\s*([\d.,]+)$/);
  if (rangeMatch) {
    const a = parseNumber(rangeMatch[1]);
    const b = parseNumber(rangeMatch[2]);
    if (a === null || b === null) return null;
    return { kind: 'range', min: Math.min(a, b) - EPS, max: Math.max(a, b) + EPS };
  }

  if (!/^[+-]?[\d.,]+$/.test(q)) return null;
  const value = parseNumber(q);
  if (value === null) return null;
  return { kind: 'exact', min: value - EPS, max: value + EPS };
}

/**
 * Builds a PostgREST `or(...)` filter matching the amount in both signs
 * (incoming and outgoing bookings).
 */
export function buildAmountOrFilter(aq: AmountQuery): string {
  const parts: string[] = [];
  const round = (n: number) => Number(n.toFixed(4));

  if (aq.kind === 'exact' || aq.kind === 'range') {
    parts.push(`and(amount.gte.${round(aq.min)},amount.lte.${round(aq.max)})`);
    parts.push(`and(amount.gte.${round(-aq.max)},amount.lte.${round(-aq.min)})`);
  } else if (aq.kind === 'gt') {
    parts.push(`amount.gte.${round(aq.value)}`);
    parts.push(`amount.lte.${round(-aq.value)}`);
  } else {
    parts.push(`and(amount.gte.0,amount.lte.${round(aq.value)})`);
    parts.push(`and(amount.gte.${round(-aq.value)},amount.lte.0)`);
  }

  return parts.join(',');
}

export function describeAmountQuery(aq: AmountQuery): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      Math.round(n * 100) / 100,
    );
  switch (aq.kind) {
    case 'exact':
      return `Betrag ${fmt((aq.min + aq.max) / 2)} €`;
    case 'gt':
      return `Betrag über ${fmt(aq.value - EPS)} €`;
    case 'lt':
      return `Betrag unter ${fmt(aq.value + EPS)} €`;
    case 'range':
      return `Betrag ${fmt(aq.min + EPS)} – ${fmt(aq.max - EPS)} €`;
  }
}
