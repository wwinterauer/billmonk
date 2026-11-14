import { describe, expect, it } from "vitest";
import { getSubscriptionDetails } from "../../supabase/functions/_shared/subscriptionDetails";

describe("Stripe subscription details", () => {
  it("reads the billing period from the item in Basil responses", () => {
    expect(getSubscriptionDetails({ items: { data: [{
      current_period_end: 1794565504,
      price: { product: "prod_pro" },
    }] } })).toEqual({ productId: "prod_pro", subscriptionEnd: "2026-11-13T10:25:04.000Z" });
  });

  it("supports older subscription-level periods", () => {
    expect(getSubscriptionDetails({ current_period_end: 1794565504, items: { data: [{
      price: { product: "prod_pro" },
    }] } }).subscriptionEnd).toBe("2026-11-13T10:25:04.000Z");
  });

  it("prefers the item period and preserves numeric zero", () => {
    expect(getSubscriptionDetails({ current_period_end: 1794565504, items: { data: [{
      current_period_end: 0,
      price: { product: { id: "prod_pro" } },
    }] } })).toEqual({ productId: "prod_pro", subscriptionEnd: "1970-01-01T00:00:00.000Z" });
  });

  it("rejects missing items instead of dereferencing undefined", () => {
    expect(() => getSubscriptionDetails({ items: { data: [] } })).toThrow("no items");
  });

  it("rejects missing or invalid billing periods before updating a profile", () => {
    for (const period of [undefined, NaN, Infinity, 1e20]) {
      expect(() => getSubscriptionDetails({ items: { data: [{
        current_period_end: period, price: { product: "prod_pro" },
      }] } })).toThrow(/billing period end/);
    }
  });

  it("rejects missing products", () => {
    expect(() => getSubscriptionDetails({ items: { data: [{
      current_period_end: 1794565504, price: { product: null },
    }] } })).toThrow("no product");
  });
});