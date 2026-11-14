# Architecture rules

- Resolve Stripe billing periods through the shared subscription-details helper, preferring item-level dates with a legacy subscription-level fallback; Basil API payloads no longer carry subscription-level periods.