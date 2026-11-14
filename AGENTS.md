# Architecture rules

- Resolve Stripe billing periods through the shared subscription-details helper, preferring item-level dates with a legacy subscription-level fallback; Basil API payloads no longer carry subscription-level periods.- Single-owner private install: no signup, subscription, plan gating or invoicing UI; `usePlan` always reports full access so legacy gates stay inert. Why: app is used privately by its owner only.
- External assistants access data only through the OAuth-protected MCP server in `src/lib/mcp`; keep login for that reason. Why: the app URL stays publicly reachable.
