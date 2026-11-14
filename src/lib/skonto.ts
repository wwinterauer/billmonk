/** Manual cash discount (Skonto). Original invoice amounts stay stored; the
 *  effective (paid) amounts are derived here — net/VAT are reduced pro rata. */
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface SkontoInput {
  amount_gross?: number | null;
  amount_net?: number | null;
  vat_amount?: number | null;
  skonto_amount?: number | null;
  skonto_percent?: number | null;
}

/** Resolve the skonto amount in € (amount wins over percent). */
export function skontoAmountOf(r: SkontoInput): number {
  const gross = r.amount_gross ?? 0;
  if (r.skonto_amount != null && r.skonto_amount > 0) return r2(Math.min(r.skonto_amount, Math.abs(gross)));
  if (r.skonto_percent != null && r.skonto_percent > 0) return r2(Math.abs(gross) * r.skonto_percent / 100);
  return 0;
}

export function percentFromAmount(gross: number, amount: number): number {
  return gross ? Math.round((amount / gross) * 10000) / 100 : 0;
}
export function amountFromPercent(gross: number, percent: number): number {
  return r2(gross * percent / 100);
}

/** Reduction factor applied to any part of the invoice (lines, tax rates). */
export function skontoFactor(r: SkontoInput): number {
  const gross = Math.abs(r.amount_gross ?? 0);
  const s = skontoAmountOf(r);
  return gross > 0 && s > 0 ? (gross - s) / gross : 1;
}

export function applySkonto<T extends SkontoInput>(r: T) {
  const skonto = skontoAmountOf(r);
  const f = skontoFactor(r);
  const gross = r.amount_gross ?? null;
  const net = r.amount_net ?? null;
  const vat = r.vat_amount ?? null;
  const paidGross = gross == null ? null : r2(gross - Math.sign(gross || 1) * skonto);
  const paidNet = net == null ? null : r2(net * f);
  // Keep gross = net + vat exactly
  const paidVat = vat == null ? null : (paidGross != null && paidNet != null && net != null && gross != null && Math.abs(gross - net - vat) < 0.02 ? r2(paidGross - paidNet) : r2(vat * f));
  return { skonto, factor: f, gross: paidGross, net: paidNet, vat: paidVat };
}

/** Effective paid gross (used for bank matching and totals). */
export const paidGross = (r: SkontoInput) => applySkonto(r).gross;

/** Returns a copy with gross/net/vat replaced by the paid amounts.
 *  Original invoice gross kept as `invoice_gross`, discount as `skonto`. */
export function withSkontoApplied<T extends SkontoInput>(r: T): T & { invoice_gross: number | null; skonto: number } {
  const e = applySkonto(r);
  if (e.skonto === 0) return { ...r, invoice_gross: r.amount_gross ?? null, skonto: 0 };
  return { ...r, amount_gross: e.gross, amount_net: e.net, vat_amount: e.vat, invoice_gross: r.amount_gross ?? null, skonto: e.skonto };
}

/** Scale a split/line amount by the receipt's skonto factor. */
export function scaleLine<L extends { amount_gross?: number | null; amount_net?: number | null; vat_amount?: number | null }>(line: L, factor: number): L {
  if (factor === 1) return line;
  const s = (n: number | null | undefined) => (n == null ? n : r2(n * factor));
  return { ...line, amount_gross: s(line.amount_gross), amount_net: s(line.amount_net), vat_amount: s(line.vat_amount) };
}
