import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

type Row = {
  amount_gross: number | null;
  amount_net: number | null;
  vat_amount: number | null;
  category: string | null;
  vendor: string | null;
  currency: string | null;
};

export default defineTool({
  name: "expense_summary",
  title: "Expense summary",
  description:
    "Aggregate the signed-in user's expenses for a period: totals plus breakdown by category and vendor.",
  inputSchema: {
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Start receipt date (YYYY-MM-DD)."),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("End receipt date (YYYY-MM-DD)."),
    group_by: z.enum(["category", "vendor"]).default("category").describe("Breakdown dimension."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, group_by }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { data, error } = await supabaseForUser(ctx)
      .from("receipts")
      .select("amount_gross, amount_net, vat_amount, category, vendor, currency")
      .gte("receipt_date", from)
      .lte("receipt_date", to)
      .limit(5000);

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = (data ?? []) as Row[];
    const key = group_by === "vendor" ? "vendor" : "category";
    const groups: Record<string, { gross: number; net: number; vat: number; count: number }> = {};
    let gross = 0;
    let net = 0;
    let vat = 0;

    for (const row of rows) {
      const g = Number(row.amount_gross ?? 0);
      const n = Number(row.amount_net ?? 0);
      const v = Number(row.vat_amount ?? 0);
      gross += g;
      net += n;
      vat += v;
      const label = (row[key] ?? "Ohne Zuordnung") as string;
      const bucket = (groups[label] ??= { gross: 0, net: 0, vat: 0, count: 0 });
      bucket.gross += g;
      bucket.net += n;
      bucket.vat += v;
      bucket.count += 1;
    }

    const round = (x: number) => Math.round(x * 100) / 100;
    const breakdown = Object.entries(groups)
      .map(([label, b]) => ({ label, gross: round(b.gross), net: round(b.net), vat: round(b.vat), count: b.count }))
      .sort((a, b) => b.gross - a.gross);

    const summary = {
      from,
      to,
      group_by: key,
      receipt_count: rows.length,
      total_gross: round(gross),
      total_net: round(net),
      total_vat: round(vat),
      breakdown,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});
