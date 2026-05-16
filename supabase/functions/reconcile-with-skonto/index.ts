import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Mode = "preview" | "apply";

interface SkontoCandidate {
  transaction_id: string;
  receipt_id: string;
  transaction_date: string | null;
  transaction_amount: number;
  transaction_description: string | null;
  receipt_date: string | null;
  receipt_vendor: string | null;
  receipt_amount: number;
  receipt_invoice_number: string | null;
  deviation_pct: number;
  skonto_amount: number;
  matched_via: ("vendor" | "invoice_number")[];
}

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    const body = await req.json().catch(() => ({}));
    const mode: Mode = body?.mode === "apply" ? "apply" : "preview";
    const acceptedPairs: { transaction_id: string; receipt_id: string }[] = Array.isArray(body?.accepted_pairs)
      ? body.accepted_pairs
      : [];

    // --- APPLY mode: just persist the user-accepted skonto matches ---
    if (mode === "apply") {
      let applied = 0;
      for (const p of acceptedPairs) {
        if (!p?.transaction_id || !p?.receipt_id) continue;

        // Verify ownership of both rows
        const { data: tx } = await supabase
          .from("bank_transactions")
          .select("id, user_id, status")
          .eq("id", p.transaction_id)
          .eq("user_id", user.id)
          .maybeSingle();
        const { data: rcpt } = await supabase
          .from("receipts")
          .select("id, user_id, bank_transaction_id")
          .eq("id", p.receipt_id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!tx || !rcpt) continue;
        if (tx.status === "matched") continue;
        if (rcpt.bank_transaction_id) continue;

        const { error: e1 } = await supabase
          .from("bank_transactions")
          .update({ status: "matched", receipt_id: p.receipt_id })
          .eq("id", p.transaction_id);
        if (e1) continue;
        const { error: e2 } = await supabase
          .from("receipts")
          .update({ bank_transaction_id: p.transaction_id })
          .eq("id", p.receipt_id);
        if (e2) continue;
        applied++;
      }
      return new Response(JSON.stringify({ applied }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- PREVIEW mode ---
    // 1) Load unmatched expense transactions
    const { data: txs } = await supabase
      .from("bank_transactions")
      .select("id, transaction_date, description, amount, is_expense, status")
      .eq("user_id", user.id)
      .eq("status", "unmatched")
      .eq("is_expense", true);

    if (!txs || txs.length === 0) {
      return new Response(
        JSON.stringify({ exact_applied: 0, skonto_candidates: [], scanned_transactions: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Compute date window with ±5 day buffer
    const datedTxs = txs.filter((t) => t.transaction_date);
    if (datedTxs.length === 0) {
      return new Response(
        JSON.stringify({ exact_applied: 0, skonto_candidates: [], scanned_transactions: txs.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const minDate = new Date(Math.min(...datedTxs.map((t) => new Date(t.transaction_date!).getTime())));
    const maxDate = new Date(Math.max(...datedTxs.map((t) => new Date(t.transaction_date!).getTime())));
    minDate.setDate(minDate.getDate() - 5);
    maxDate.setDate(maxDate.getDate() + 5);

    // 3) Load candidate receipts in that window, not yet linked
    const { data: receipts } = await supabase
      .from("receipts")
      .select("id, amount_gross, receipt_date, vendor, invoice_number")
      .eq("user_id", user.id)
      .is("bank_transaction_id", null)
      .in("status", ["approved", "completed", "review"])
      .gte("receipt_date", minDate.toISOString().slice(0, 10))
      .lte("receipt_date", maxDate.toISOString().slice(0, 10));

    const pool = (receipts || []).filter((r) => r.amount_gross != null);

    let exactApplied = 0;
    const skontoCandidates: SkontoCandidate[] = [];
    const usedReceiptIds = new Set<string>();

    // 4) First pass: exact matches (auto-apply)
    for (const tx of datedTxs) {
      if (!tx.amount) continue;
      const txAmt = Math.abs(tx.amount);
      const match = pool.find((r) => {
        if (usedReceiptIds.has(r.id)) return false;
        if (!r.receipt_date) return false;
        if (daysBetween(r.receipt_date, tx.transaction_date!) > 5) return false;
        return Math.abs(Number(r.amount_gross) - txAmt) < 0.02;
      });
      if (match) {
        const { error: e1 } = await supabase
          .from("bank_transactions")
          .update({ status: "matched", receipt_id: match.id })
          .eq("id", tx.id);
        if (e1) continue;
        const { error: e2 } = await supabase
          .from("receipts")
          .update({ bank_transaction_id: tx.id })
          .eq("id", match.id);
        if (e2) continue;
        usedReceiptIds.add(match.id);
        exactApplied++;
      }
    }

    // 5) Second pass: skonto candidates (1-5% deviation, vendor or invoice nr in description)
    for (const tx of datedTxs) {
      if (!tx.amount) continue;
      // Skip if already matched in pass 1
      const txAmt = Math.abs(tx.amount);
      const descNorm = normalize(tx.description);
      if (!descNorm) continue;

      for (const r of pool) {
        if (usedReceiptIds.has(r.id)) continue;
        if (!r.receipt_date) continue;
        if (daysBetween(r.receipt_date, tx.transaction_date!) > 5) continue;

        const receiptAmt = Number(r.amount_gross);
        if (receiptAmt <= 0) continue;
        // Bank amount must be lower than receipt (skonto deducted)
        if (txAmt >= receiptAmt) continue;

        const deviation = (receiptAmt - txAmt) / receiptAmt; // positive
        const deviationPct = deviation * 100;
        if (deviationPct < 1 || deviationPct > 5) continue;

        // Match signal: vendor token(s) or invoice number in description
        const matchedVia: ("vendor" | "invoice_number")[] = [];
        const vendorTokens = tokensOf(r.vendor);
        if (vendorTokens.some((t) => descNorm.includes(t))) {
          matchedVia.push("vendor");
        }
        if (r.invoice_number && r.invoice_number.length >= 4) {
          const inv = normalize(r.invoice_number).replace(/\s+/g, "");
          const descNoSpace = descNorm.replace(/\s+/g, "");
          if (inv && descNoSpace.includes(inv)) {
            matchedVia.push("invoice_number");
          }
        }
        if (matchedVia.length === 0) continue;

        skontoCandidates.push({
          transaction_id: tx.id,
          receipt_id: r.id,
          transaction_date: tx.transaction_date,
          transaction_amount: txAmt,
          transaction_description: tx.description,
          receipt_date: r.receipt_date,
          receipt_vendor: r.vendor,
          receipt_amount: receiptAmt,
          receipt_invoice_number: r.invoice_number,
          deviation_pct: Math.round(deviationPct * 100) / 100,
          skonto_amount: Math.round((receiptAmt - txAmt) * 100) / 100,
          matched_via: matchedVia,
        });
        // Don't break — keep multiple candidates so user can pick best; but to avoid
        // explosion we cap one receipt per transaction in the candidates list
        break;
      }
    }

    return new Response(
      JSON.stringify({
        exact_applied: exactApplied,
        skonto_candidates: skontoCandidates,
        scanned_transactions: txs.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("reconcile-with-skonto error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
