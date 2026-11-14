import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, ok } from "./_shared";

export default defineTool({
  name: "list_bank_transactions",
  title: "List bank transactions",
  description:
    "List imported bank transactions like the Kontoabgleich page: filter by status (unmatched, matched, ignored), date range or text, page with offset. Each row includes account, source, and for matched rows the linked receipt (vendor, amount, date, invoice number, status) or split line. Output is compact JSON.",
  inputSchema: {
    status: z.enum(["unmatched", "matched", "ignored"]).optional().describe("Only transactions with this status. Omit for all."),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Start date YYYY-MM-DD."),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("End date YYYY-MM-DD."),
    search: z.string().min(1).optional().describe("Text contained in the booking description."),
    unmatched_only: z.boolean().default(false).describe("Deprecated, same as status=unmatched."),
    limit: z.number().int().min(1).max(200).default(50).describe("Maximum rows."),
    offset: z.number().int().min(0).default(0).describe("Rows to skip for paging."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, from, to, search, unmatched_only, limit, offset }, ctx) => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const lim = limit ?? 50;
    const off = offset ?? 0;
    let q = supabaseForUser(ctx)
      .from("bank_transactions")
      .select(
        "id, transaction_date, value_date, description, amount, is_expense, status, source, receipt_id, receipt_split_line_id, created_at, account:bank_account_id(bank_name, account_name, iban), receipt:receipt_id(vendor, amount_gross, receipt_date, invoice_number, status, is_no_receipt_entry, source), split_line:receipt_split_line_id(description, amount_gross)",
        { count: "exact" },
      )
      .order("transaction_date", { ascending: false })
      .range(off, off + lim - 1);
    const st = status ?? (unmatched_only ? "unmatched" : undefined);
    if (st) q = q.eq("status", st);
    if (from) q = q.gte("transaction_date", from);
    if (to) q = q.lte("transaction_date", to);
    if (search) q = q.ilike("description", `%${search}%`);
    const { data, error, count } = await q;
    if (error) return fail(error.message);
    const rows = (data ?? []).map((t) => {
      const a = t.account as { bank_name: string | null; account_name: string | null; iban: string | null } | null;
      const r = t.receipt as { vendor: string | null; amount_gross: number | null; receipt_date: string | null; invoice_number: string | null; status: string | null; is_no_receipt_entry: boolean | null; source: string | null } | null;
      const l = t.split_line as { description: string | null; amount_gross: number | null } | null;
      return {
        id: t.id,
        date: t.transaction_date,
        value_date: t.value_date,
        amount: t.amount,
        is_expense: t.is_expense,
        status: t.status,
        source: t.source,
        account: a ? [a.bank_name, a.account_name, a.iban].filter(Boolean).join(" ") || null : null,
        description: t.description,
        imported_at: t.created_at,
        receipt_id: t.receipt_id,
        receipt: r
          ? { vendor: r.vendor, amount: r.amount_gross, date: r.receipt_date, invoice_number: r.invoice_number, status: r.status, without_file: r.is_no_receipt_entry, source: r.source }
          : null,
        split_line: t.receipt_split_line_id && l ? { id: t.receipt_split_line_id, description: l.description, amount: l.amount_gross } : null,
      };
    });
    const result = { total: count ?? rows.length, offset: off, returned: rows.length, transactions: rows };
    return ok(JSON.stringify(result), result);
  },
});
