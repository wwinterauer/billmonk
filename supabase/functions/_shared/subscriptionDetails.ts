type SubscriptionItem = {
  current_period_end?: number | null;
  price: { product: string | { id: string } | null };
};

type SubscriptionDetails = {
  current_period_end?: number | null;
  items: { data: SubscriptionItem[] };
};

// Stripe Basil moved billing periods from subscriptions to subscription items.
// Keep the legacy fallback for older API payloads, but never fabricate a date.
export function getSubscriptionDetails(subscription: SubscriptionDetails) {
  const item = subscription.items.data[0];
  if (!item) throw new Error("Stripe subscription has no items");

  const product = item.price.product;
  const productId = typeof product === "string" ? product : product?.id;
  if (!productId) throw new Error("Stripe subscription has no product");

  const periodEnd = item.current_period_end ?? subscription.current_period_end;
  if (typeof periodEnd !== "number" || !Number.isFinite(periodEnd)) {
    throw new Error("Stripe subscription has no valid billing period end");
  }
  const endDate = new Date(periodEnd * 1000);
  if (!Number.isFinite(endDate.getTime())) {
    throw new Error("Stripe subscription billing period end is out of range");
  }

  return { productId, subscriptionEnd: endDate.toISOString() };
}