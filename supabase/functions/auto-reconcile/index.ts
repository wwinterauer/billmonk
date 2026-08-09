import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildGroupPairs, isProcessorTransaction } from "../_shared/reconcileHelpers.ts";

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

interface Candidate {
  // unique key for "used" tracking
  key: string;
  receipt_id: string;
  split_line_id: string | null;
  amount_gross: number | null;
  receipt_date: string | null;
  vendor: string | null;
  invoice_number: string | null;
  // extra text tokens (split line description) merged into vendor token check
  extra_text: string | null;
}

function findHighConfidenceMatch(
  tx: { transaction_date: string | null; amount: number; description: string | null },
  pool: Candidate[],
  used: Set<string>,
  maxDays: number,
): Candidate | null {
  if (!tx.transaction_date) return null;
  const txAmt = Math.abs(tx.amount);
  const descNorm = normalize(tx.description);
  const descNoSpace = descNorm.replace(/\s+/g, "");
  if (!descNorm) return null;

  type Scored = { c: Candidate; viaInvoice: boolean; viaVendor: boolean };
  const matches: Scored[] = [];

  for (const c of pool) {
    if (used.has(c.key)) continue;
    if (c.amount_gross == null) continue;
    if (Math.abs(Number(c.amount_gross) - txAmt) >= 0.02) continue;
    if (!c.receipt_date) continue;
    if (daysBetween(c.receipt_date, tx.transaction_date) > maxDays) continue;

    let viaInvoice = false;
    if (c.invoice_number) {
      const inv = normalize(c.invoice_number).replace(/\s+/g, "");
      if (inv.length >= 4 && descNoSpace.includes(inv)) viaInvoice = true;
    }

    let viaVendor = false;
    // For split candidates the line description (e.g. "Diemut Winterauer") is the strongest
    // signal — combine vendor + extra_text tokens.
    const vendorTokens = tokensOf([c.vendor, c.extra_text].filter(Boolean).join(" "));
    if (vendorTokens.length > 0 && vendorTokens.some((t) => descNorm.includes(t))) {
      // For split lines we accept any token hit (single name often suffices); for whole
      // receipts we keep the stricter "every token" rule.
      if (c.split_line_id) {
        viaVendor = true;
      } else {
        const allTokens = tokensOf(c.vendor);
        if (allTokens.length > 0 && allTokens.every((t) => descNorm.includes(t))) {
          viaVendor = true;
        }
      }
    }

    if (viaInvoice || viaVendor) matches.push({ c, viaInvoice, viaVendor });
  }

  if (matches.length === 0) return null;
  const invMatches = matches.filter((m) => m.viaInvoice);
  if (invMatches.length === 1) return invMatches[0].c;
  if (invMatches.length > 1) return null;
  if (matches.length === 1) return matches[0].c;
  return null;
}

function findExactMatch(
  tx: { transaction_date: string | null; amount: number },
  pool: Candidate[],
  used: Set<string>,
  maxDays: number,
): Candidate | null {
  if (!tx.transaction_date) return null;
  const txAmt = Math.abs(tx.amount);
  const candidates = pool.filter((c) => {
    if (used.has(c.key)) return false;
    if (c.amount_gross == null || !c.receipt_date) return false;
    if (Math.abs(Number(c.amount_gross) - txAmt) >= 0.02) return false;
    return daysBetween(c.receipt_date, tx.transaction_date!) <= maxDays;
  });
  if (candidates.length === 1) return candidates[0];
  return null;
}

async function buildCandidatePool(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<Candidate[]> {
  // Load all receipts that could still receive a payment match. A receipt is
  // eligible when (a) it has no bank_transaction_id yet, OR (b) it has split lines
  // (split lines are matched independently — parent receipts.bank_transaction_id
  // is not used for them).
  const { data: receipts } = await supabase
    .from("receipts")
    .select("id, amount_gross, receipt_date, vendor, invoice_number, bank_transaction_id")
    .eq("user_id", userId)
    .in("status", ["approved", "completed", "review"]);

  const all = receipts ?? [];
  if (all.length === 0) return [];

  const receiptIds = all.map((r: any) => r.id);

  // Load all split lines for these receipts
  const { data: splitLines } = await supabase
    .from("receipt_split_lines")
    .select("id, receipt_id, amount_gross, description")
    .in("receipt_id", receiptIds);

  const linesByReceipt = new Map<string, any[]>();
  for (const l of splitLines ?? []) {
    const arr = linesByReceipt.get(l.receipt_id) ?? [];
    arr.push(l);
    linesByReceipt.set(l.receipt_id, arr);
  }

  // Find split lines already consumed by a bank transaction
  const { data: matchedLines } = await supabase
    .from("bank_transactions")
    .select("receipt_split_line_id")
    .eq("user_id", userId)
    .not("receipt_split_line_id", "is", null);
  const usedLineIds = new Set<string>(
    (matchedLines ?? []).map((m: any) => m.receipt_split_line_id),
  );

  const pool: Candidate[] = [];
  for (const r of all as any[]) {
    const lines = linesByReceipt.get(r.id);
    if (lines && lines.length > 0) {
      // Split receipt → only the unmatched lines are candidates
      for (const l of lines) {
        if (usedLineIds.has(l.id)) continue;
        pool.push({
          key: `line:${l.id}`,
          receipt_id: r.id,
          split_line_id: l.id,
          amount_gross: l.amount_gross,
          receipt_date: r.receipt_date,
          vendor: r.vendor,
          invoice_number: r.invoice_number,
          extra_text: l.description,
        });
      }
    } else {
      // Whole receipt — only if not already matched
      if (r.bank_transaction_id) continue;
      pool.push({
        key: `receipt:${r.id}`,
        receipt_id: r.id,
        split_line_id: null,
        amount_gross: r.amount_gross,
        receipt_date: r.receipt_date,
        vendor: r.vendor,
        invoice_number: r.invoice_number,
        extra_text: null,
      });
    }
  }
  return pool;
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
        JSON.stringify({ matched_receipts: 0, matched_invoices: 0, high_confidence_matched: 0, group_matched: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let matchedReceipts = 0;
    let highConfidenceMatched = 0;
    let matchedInvoices = 0;
    let groupMatched = 0;

    const expenses = transactions.filter((t) => t.is_expense === true);
    const income = transactions.filter((t) => t.is_expense === false);

    // --- Match expenses against receipts (including split lines) ---
    if (expenses.length > 0) {
      const pool = await buildCandidatePool(supabase, user.id);
      const used = new Set<string>();

      const applyMatch = async (tx: any, c: Candidate) => {
        const txUpdate: Record<string, unknown> = {
          status: "matched",
          receipt_id: c.receipt_id,
          receipt_split_line_id: c.split_line_id,
        };
        const { error: e1 } = await supabase
          .from("bank_transactions")
          .update(txUpdate)
          .eq("id", tx.id);
        if (e1) return false;
        // Only set receipts.bank_transaction_id for whole-receipt matches
        if (!c.split_line_id) {
          const { error: e2 } = await supabase
            .from("receipts")
            .update({ bank_transaction_id: tx.id })
            .eq("id", c.receipt_id);
          if (e2) return false;
        }
        used.add(c.key);
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
            (tx as any).__matched = true;
          }
        }

        // Pass 2: pure exact amount, tighter window (±14 days), unambiguous only
        for (const tx of expenses) {
          if (!tx.amount) continue;
          if ((tx as any).__matched) continue;
          const m = findExactMatch(tx, pool, used, 14);
          if (m && await applyMatch(tx, m)) {
            (tx as any).__matched = true;
            matchedReceipts++;
          }
        }

        // Pass 3: group pass — several transactions with the same amount vs. equally
        // many receipts of one vendor (typical for PayPal-paid IONOS invoices).
        const openTxs = expenses.filter((t) => t.amount && !(t as any).__matched && t.transaction_date);
        const openCands = pool.filter((c) => !used.has(c.key) && c.receipt_date && c.amount_gross != null);
        const pairs = buildGroupPairs(
          openTxs.map((t: any) => ({ id: t.id, date: t.transaction_date, amount: Number(t.amount) })),
          openCands.map((c) => ({
            key: c.key,
            date: c.receipt_date!,
            amount: Number(c.amount_gross),
            vendorKey: (c.vendor ?? "").trim().toLowerCase(),
          })),
          14,
        );
        for (const p of pairs) {
          const c = pool.find((x) => x.key === p.key);
          const tx: any = openTxs.find((t: any) => t.id === p.txId);
          if (!c || !tx || used.has(c.key) || tx.__matched) continue;
          const descNorm = normalize(tx.description);
          const vt = tokensOf(c.vendor);
          const vendorInDesc = vt.length > 0 && vt.every((t) => descNorm.includes(t));
          if (!isProcessorTransaction(tx.description) && !vendorInDesc) continue;
          if (await applyMatch(tx, c)) {
            tx.__matched = true;
            groupMatched++;
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
        group_matched: groupMatched,
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
