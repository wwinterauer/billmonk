/** Effective paid gross after a manual Skonto (mirrors src/lib/skonto.ts). */
export function paidGross(r: { amount_gross: number | null; skonto_amount?: number | null; skonto_percent?: number | null }): number | null {
  if (r.amount_gross == null) return null;
  const g = Number(r.amount_gross);
  let s = 0;
  if (r.skonto_amount != null && Number(r.skonto_amount) > 0) s = Math.min(Number(r.skonto_amount), Math.abs(g));
  else if (r.skonto_percent != null && Number(r.skonto_percent) > 0) s = Math.abs(g) * Number(r.skonto_percent) / 100;
  if (!s) return g;
  return Math.round((g - Math.sign(g) * s) * 100) / 100;
}
