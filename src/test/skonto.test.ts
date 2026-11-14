import { describe, it, expect } from 'vitest';
import { applySkonto, amountFromPercent, percentFromAmount, skontoFactor } from '@/lib/skonto';

describe('skonto', () => {
  it('2% on 120 gross reduces net and vat pro rata', () => {
    const r = applySkonto({ amount_gross: 120, amount_net: 100, vat_amount: 20, skonto_percent: 2 });
    expect(r).toMatchObject({ skonto: 2.4, gross: 117.6, net: 98, vat: 19.6 });
  });
  it('amount input works the same', () => {
    expect(applySkonto({ amount_gross: 120, amount_net: 100, vat_amount: 20, skonto_amount: 2.4 }).net).toBe(98);
  });
  it('percent <-> amount', () => {
    expect(amountFromPercent(120, 3)).toBe(3.6);
    expect(percentFromAmount(120, 3.6)).toBe(3);
  });
  it('mixed rates: same factor for each part', () => {
    const f = skontoFactor({ amount_gross: 200, skonto_amount: 4 });
    expect(Math.round(110 * f * 100) / 100).toBe(107.8);
  });
  it('no skonto leaves amounts and keeps 0', () => {
    expect(applySkonto({ amount_gross: 50, amount_net: 0, vat_amount: 0 })).toMatchObject({ skonto: 0, gross: 50, net: 0, vat: 0 });
  });
});
