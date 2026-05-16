import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalize(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokensOf(s: string | null | undefined): string[] {
  return normalize(s).split(" ").filter((t) => t.length >= 4);
}

function daysBetween(a: string, b: string): number {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24));
}

interface ReceiptRow {
  id: string;
  amount_gross: number | null;
  receipt_date: string | null;
  vendor: string | null;
  invoice_number: string | null;
}

/**
 * Try to find a receipt that matches a transaction with exact amount AND a strong
 * text signal (invoice number or vendor tokens in the bank description).
 * Returns the match only if it is unambiguous.
 */
function findHighConfidenceMatch(
  tx: { transaction_date: string | null; amount: number; description: string | null },
  pool: ReceiptRow[],
  used: Set<string>,
  maxDays: number,
): ReceiptRow | null {
  if (!tx.transaction_date) return null;
  const txAmt = Math.abs(tx.amount);
  const descNorm = normalize(tx.description);
  const descNoSpace = descNorm.replace(/\s+/g, "");
  if (!descNorm) return null;

  type Scored = { r: ReceiptRow; viaInvoice: boolean; viaVendor: boolean };
  const matches: Scored[] = [];

  for (const r of pool) {
    if (used.has(r.id)) continue;
    if (r.amount_gross == null) continue;
    if (Math.abs(Number(r.amount_gross) - txAmt) >= 0.02) continue;
    if (!r.receipt_date) continue;
    if (daysBetween(r.receipt_date, tx.transaction_date) > maxDays) continue;

    let viaInvoice = false;
    if (r.invoice_number) {
      const inv = normalize(r.invoice_number).replace(/\s+/g, "");
      if (inv.length >= 4 && descNoSpace.includes(inv)) viaInvoice = true;
    }

    let viaVendor = false;
    const vendorTokens = tokensOf(r.vendor);
    if (vendorTokens.length > 0 && vendorTokens.every((t) => descNorm.includes(t))) {
      viaVendor = true;
    }

    if (viaInvoice || viaVendor) {
      matches.push({ r, viaInvoice, viaVendor });
    }
  }

  if (matches.length === 0) return null;
  // Prefer invoice-number matches — they are essentially unique
  const invMatches = matches.filter((m) => m.viaInvoice);
  if (invMatches.length === 1) return invMatches[0].r;
  if (invMatches.length > 1) return null; // ambiguous
  // Otherwise vendor-only: only accept if unique
  if (matches.length === 1) return matches[0].r;
  return null;
}

/**
 * Exact amount match within tighter date window. Only accept if unambiguous
 * (no other unused receipt with same amount in window).
 */
function findExactMatch(
  tx: { transaction_date: string | null; amount: number },
  pool: ReceiptRow[],
  used: Set<string>,
  maxDays: number,
): ReceiptRow | null {
  if (!tx.transaction_date) return null;
  const txAmt = Math.abs(tx.amount);
  const candidates = pool.filter((r) => {
    if (used.has(r.id)) return false;
    if (r.amount_gross == null || !r.receipt_date) return false;
    if (Math.abs(Number(r.amount_gross) - txAmt) >= 0.02) return false;
    return daysBetween(r.receipt_date, tx.transaction_date!) <= maxDays;
  });
  if (candidates.length === 1) return candidates[0];
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: transactions } = await supabase
      .from("bank_transactions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "unmatched");

    if (!transactions || transactions.length === 0) {
      return new Response(
        JSON.stringify({ matched_receipts: 0, matched_invoices: 0, high_confidence_matched: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let matchedReceipts = 0;
    let highConfidenceMatched = 0;
    let matchedInvoices = 0;

    const expenses = transactions.filter((t) => t.is_expense === true);
    const income = transactions.filter((t) => t.is_expense === false);

    // --- Match expenses against receipts ---
    if (expenses.length > 0) {
      const { data: receipts } = await supabase
        .from("receipts")
        .select("id, amount_gross, receipt_date, vendor, invoice_number")
        .eq("user_id", user.id)
        .is("bank_transaction_id", null)
        .in("status", ["approved", "completed", "review"]);

      const pool: ReceiptRow[] = receipts ?? [];
      const used = new Set<string>();

      const applyMatch = async (tx: any, match: ReceiptRow) => {
        const { error: e1 } = await supabase
          .from("bank_transactions")
          .update({ status: "matched", receipt_id: match.id })
          .eq("id", tx.id);
        if (e1) return false;
        const { error: e2 } = await supabase
          .from("receipts")
          .update({ bank_transaction_id: tx.id })
          .eq("id", match.id);
        if (e2) return false;
        used.add(match.id);
        return true;
      };

      if (pool.length > 0) {
        // Pass 1: high-confidence (amount + invoice-nr / vendor signal, ±60 days)
        for (const tx of expenses) {
          if (!tx.amount) continue;
          const m = findHighConfidenceMatch(tx, pool, used, 60);
          if (m && await applyMatch(tx, m)) {
            highConfidenceMatched++;
            matchedReceipts++;
          }
        }

        // Pass 2: pure exact amount, tighter window (±14 days), unambiguous only
        for (const tx of expenses) {
          if (!tx.amount) continue;
          if (tx.status === "matched") continue; // safety
          // Skip transactions we already matched in pass 1 by checking used + receipt linkage isn't trivial here;
          // since we don't reload, simply attempt — applyMatch would fail if tx already matched, but we also
          // need to avoid wasting work. Use a local in-memory set:
          if ((tx as any).__matched) continue;
          const m = findExactMatch(tx, pool, used, 14);
          if (m && await applyMatch(tx, m)) {
            (tx as any).__matched = true;
            matchedReceipts++;
          }
        }
      }
    }

    // --- Match income against invoices (unchanged from previous behavior) ---
    if (income.length > 0) {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, total, invoice_number, payment_reference, due_date, discount_percent")
        .eq("user_id", user.id)
        .is("paid_at", null)
        .in("status", ["sent", "overdue"]);

      if (invoices && invoices.length > 0) {
        for (const tx of income) {
          if (!tx.amount) continue;

          const description = (tx.description || "").toLowerCase();

          let matchedWithSkonto = false;
          const match = invoices.find((inv) => {
            if (!inv.total) return false;

            const fullAmountMatch = Math.abs(inv.total - tx.amount!) < 0.02;
            const skontoTotal = inv.discount_percent && inv.discount_percent > 0
              ? inv.total * (1 - inv.discount_percent / 100)
              : null;
            const skontoAmountMatch = skontoTotal !== null && Math.abs(skontoTotal - tx.amount!) < 0.02;

            if (!fullAmountMatch && !skontoAmountMatch) return false;

            const hasRef =
              (inv.invoice_number && description.includes(inv.invoice_number.toLowerCase())) ||
              (inv.payment_reference && description.includes(inv.payment_reference.toLowerCase()));

            if (hasRef) {
              matchedWithSkonto = !fullAmountMatch && skontoAmountMatch;
              return true;
            }

            const sameAmountCount = invoices.filter((i) => {
              if (!i.total) return false;
              if (Math.abs(i.total - tx.amount!) < 0.02) return true;
              const st = i.discount_percent && i.discount_percent > 0
                ? i.total * (1 - i.discount_percent / 100) : null;
              return st !== null && Math.abs(st - tx.amount!) < 0.02;
            }).length;

            if (sameAmountCount === 1) {
              matchedWithSkonto = !fullAmountMatch && skontoAmountMatch;
              return true;
            }
            return false;
          });

          if (match) {
            const paidWithSkonto = matchedWithSkonto;
            const discountAmount = paidWithSkonto && match.total && match.discount_percent
              ? match.total * match.discount_percent / 100
              : null;

            await supabase
              .from("bank_transactions")
              .update({ status: "matched", invoice_id: match.id })
              .eq("id", tx.id);

            const invoiceUpdate: Record<string, unknown> = {
              paid_at: new Date().toISOString(),
              status: paidWithSkonto ? "paid_with_skonto" : "paid",
            };
            if (discountAmount !== null) {
              invoiceUpdate.discount_amount = discountAmount;
            }
            await supabase
              .from("invoices")
              .update(invoiceUpdate)
              .eq("id", match.id);

            const idx = invoices.findIndex((i) => i.id === match.id);
            if (idx > -1) invoices.splice(idx, 1);

            matchedInvoices++;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        matched_receipts: matchedReceipts,
        high_confidence_matched: highConfidenceMatched,
        matched_invoices: matchedInvoices,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("auto-reconcile error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
