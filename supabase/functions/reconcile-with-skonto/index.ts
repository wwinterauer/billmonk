import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildGroupPairs, isProcessorTransaction } from "../_shared/reconcileHelpers.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Mode = "preview" | "apply";

interface SkontoCandidate {
  transaction_id: string;
  receipt_id: string;
  split_line_id: string | null;
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

interface Candidate {
  key: string;
  receipt_id: string;
  split_line_id: string | null;
  amount_gross: number | null;
  receipt_date: string | null;
  vendor: string | null;
  invoice_number: string | null;
  extra_text: string | null;
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

async function buildCandidatePool(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  minDate: string,
  maxDate: string,
): Promise<Candidate[]> {
  const { data: receipts } = await supabase
    .from("receipts")
    .select("id, amount_gross, receipt_date, vendor, invoice_number, bank_transaction_id")
    .eq("user_id", userId)
    .in("status", ["approved", "completed", "review"])
    .gte("receipt_date", minDate)
    .lte("receipt_date", maxDate);

  const all = receipts ?? [];
  if (all.length === 0) return [];

  const receiptIds = all.map((r: any) => r.id);

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
    const acceptedPairs: { transaction_id: string; receipt_id: string; split_line_id?: string | null }[] =
      Array.isArray(body?.accepted_pairs) ? body.accepted_pairs : [];

    // --- APPLY mode: persist user-accepted skonto matches ---
    if (mode === "apply") {
      let applied = 0;
      for (const p of acceptedPairs) {
        if (!p?.transaction_id || !p?.receipt_id) continue;

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

        const isSplit = !!p.split_line_id;
        if (!isSplit && rcpt.bank_transaction_id) continue;

        // For split lines: ensure ownership of line + not already taken
        if (isSplit) {
          const { data: line } = await supabase
            .from("receipt_split_lines")
            .select("id, receipt_id, user_id")
            .eq("id", p.split_line_id!)
            .eq("user_id", user.id)
            .maybeSingle();
          if (!line || line.receipt_id !== p.receipt_id) continue;
          const { data: taken } = await supabase
            .from("bank_transactions")
            .select("id")
            .eq("receipt_split_line_id", p.split_line_id!)
            .maybeSingle();
          if (taken) continue;
        }

        const { error: e1 } = await supabase
          .from("bank_transactions")
          .update({
            status: "matched",
            receipt_id: p.receipt_id,
            receipt_split_line_id: p.split_line_id ?? null,
          })
          .eq("id", p.transaction_id);
        if (e1) continue;
        if (!isSplit) {
          const { error: e2 } = await supabase
            .from("receipts")
            .update({ bank_transaction_id: p.transaction_id })
            .eq("id", p.receipt_id);
          if (e2) continue;
        }
        applied++;
      }
      return new Response(JSON.stringify({ applied }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- PREVIEW mode ---
    const { data: txs } = await supabase
      .from("bank_transactions")
      .select("id, transaction_date, description, amount, is_expense, status")
      .eq("user_id", user.id)
      .eq("status", "unmatched")
      .eq("is_expense", true);

    if (!txs || txs.length === 0) {
      return new Response(
        JSON.stringify({ exact_applied: 0, high_confidence_applied: 0, skonto_candidates: [], scanned_transactions: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const datedTxs = txs.filter((t) => t.transaction_date);
    if (datedTxs.length === 0) {
      return new Response(
        JSON.stringify({ exact_applied: 0, high_confidence_applied: 0, skonto_candidates: [], scanned_transactions: txs.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const minDate = new Date(Math.min(...datedTxs.map((t) => new Date(t.transaction_date!).getTime())));
    const maxDate = new Date(Math.max(...datedTxs.map((t) => new Date(t.transaction_date!).getTime())));
    minDate.setDate(minDate.getDate() - 60);
    maxDate.setDate(maxDate.getDate() + 60);

    const pool = await buildCandidatePool(
      supabase,
      user.id,
      minDate.toISOString().slice(0, 10),
      maxDate.toISOString().slice(0, 10),
    );

    let exactApplied = 0;
    let highConfidenceApplied = 0;
    const skontoCandidates: SkontoCandidate[] = [];
    const usedKeys = new Set<string>();
    const matchedTxIds = new Set<string>();

    const applyMatch = async (txId: string, c: Candidate): Promise<boolean> => {
      const { error: e1 } = await supabase
        .from("bank_transactions")
        .update({
          status: "matched",
          receipt_id: c.receipt_id,
          receipt_split_line_id: c.split_line_id,
        })
        .eq("id", txId);
      if (e1) return false;
      if (!c.split_line_id) {
        const { error: e2 } = await supabase
          .from("receipts")
          .update({ bank_transaction_id: txId })
          .eq("id", c.receipt_id);
        if (e2) return false;
      }
      usedKeys.add(c.key);
      matchedTxIds.add(txId);
      return true;
    };

    // 4a) High-confidence: exact amount + invoice-nr/vendor signal, ±60 days
    for (const tx of datedTxs) {
      if (!tx.amount) continue;
      const txAmt = Math.abs(tx.amount);
      const descNorm = normalize(tx.description);
      const descNoSpace = descNorm.replace(/\s+/g, "");
      if (!descNorm) continue;

      type Scored = { c: Candidate; viaInvoice: boolean; viaVendor: boolean };
      const matches: Scored[] = [];
      for (const c of pool) {
        if (usedKeys.has(c.key)) continue;
        if (!c.receipt_date || c.amount_gross == null) continue;
        if (Math.abs(Number(c.amount_gross) - txAmt) >= 0.02) continue;
        if (daysBetween(c.receipt_date, tx.transaction_date!) > 60) continue;

        let viaInvoice = false;
        if (c.invoice_number) {
          const inv = normalize(c.invoice_number).replace(/\s+/g, "");
          if (inv.length >= 4 && descNoSpace.includes(inv)) viaInvoice = true;
        }
        let viaVendor = false;
        const lineTokens = tokensOf([c.vendor, c.extra_text].filter(Boolean).join(" "));
        if (c.split_line_id) {
          if (lineTokens.some((t) => descNorm.includes(t))) viaVendor = true;
        } else {
          const vt = tokensOf(c.vendor);
          if (vt.length > 0 && vt.every((t) => descNorm.includes(t))) viaVendor = true;
        }
        if (viaInvoice || viaVendor) matches.push({ c, viaInvoice, viaVendor });
      }

      let pick: Candidate | null = null;
      const inv = matches.filter((m) => m.viaInvoice);
      if (inv.length === 1) pick = inv[0].c;
      else if (inv.length === 0 && matches.length === 1) pick = matches[0].c;

      if (pick && await applyMatch(tx.id, pick)) {
        highConfidenceApplied++;
      }
    }

    // 4b) Exact-amount within ±14 days, unambiguous
    for (const tx of datedTxs) {
      if (!tx.amount) continue;
      if (matchedTxIds.has(tx.id)) continue;
      const txAmt = Math.abs(tx.amount);

      const candidates = pool.filter((c) => {
        if (usedKeys.has(c.key)) return false;
        if (!c.receipt_date || c.amount_gross == null) return false;
        if (Math.abs(Number(c.amount_gross) - txAmt) >= 0.02) return false;
        return daysBetween(c.receipt_date, tx.transaction_date!) <= 14;
      });
      if (candidates.length === 1) {
        if (await applyMatch(tx.id, candidates[0])) exactApplied++;
      }
    }

    // 4c) Group pass: several transactions with identical amount vs. equally many
    // receipts of one single vendor (e.g. PayPal payments for IONOS invoices).
    const openTxs = datedTxs.filter(
      (t) => t.amount && !matchedTxIds.has(t.id),
    );
    const openCands = pool.filter(
      (c) => !usedKeys.has(c.key) && c.receipt_date && c.amount_gross != null,
    );
    const groupPairs = buildGroupPairs(
      openTxs.map((t) => ({ id: t.id, date: t.transaction_date!, amount: Number(t.amount) })),
      openCands.map((c) => ({
        key: c.key,
        date: c.receipt_date!,
        amount: Number(c.amount_gross),
        vendorKey: (c.vendor ?? "").trim().toLowerCase(),
      })),
      14,
    );
    for (const p of groupPairs) {
      const c = pool.find((x) => x.key === p.key);
      if (!c || usedKeys.has(c.key) || matchedTxIds.has(p.txId)) continue;
      // Only auto-assign when the payee is a payment processor or no vendor hint conflicts
      const tx = openTxs.find((t) => t.id === p.txId);
      const descNorm = normalize(tx?.description);
      const vt = tokensOf(c.vendor);
      const vendorInDesc = vt.length > 0 && vt.every((t) => descNorm.includes(t));
      if (!isProcessorTransaction(tx?.description) && !vendorInDesc) continue;
      if (await applyMatch(p.txId, c)) groupApplied++;
    }



    // 5) Skonto pass: 1–5% deviation, vendor/invoice signal, ±30 days
    for (const tx of datedTxs) {
      if (!tx.amount) continue;
      if (matchedTxIds.has(tx.id)) continue;
      const txAmt = Math.abs(tx.amount);
      const descNorm = normalize(tx.description);
      if (!descNorm) continue;

      for (const c of pool) {
        if (usedKeys.has(c.key)) continue;
        if (!c.receipt_date || c.amount_gross == null) continue;
        if (daysBetween(c.receipt_date, tx.transaction_date!) > 30) continue;

        const receiptAmt = Number(c.amount_gross);
        if (receiptAmt <= 0) continue;
        if (txAmt >= receiptAmt) continue;

        const deviation = (receiptAmt - txAmt) / receiptAmt;
        const deviationPct = deviation * 100;
        if (deviationPct < 1 || deviationPct > 5) continue;

        const matchedVia: ("vendor" | "invoice_number")[] = [];
        const lineTokens = tokensOf([c.vendor, c.extra_text].filter(Boolean).join(" "));
        if (c.split_line_id) {
          if (lineTokens.some((t) => descNorm.includes(t))) matchedVia.push("vendor");
        } else {
          const vt = tokensOf(c.vendor);
          if (vt.length > 0 && vt.every((t) => descNorm.includes(t))) matchedVia.push("vendor");
        }
        if (c.invoice_number && c.invoice_number.length >= 4) {
          const inv = normalize(c.invoice_number).replace(/\s+/g, "");
          const descNoSpace = descNorm.replace(/\s+/g, "");
          if (inv && descNoSpace.includes(inv)) matchedVia.push("invoice_number");
        }
        if (matchedVia.length === 0) continue;

        skontoCandidates.push({
          transaction_id: tx.id,
          receipt_id: c.receipt_id,
          split_line_id: c.split_line_id,
          transaction_date: tx.transaction_date,
          transaction_amount: txAmt,
          transaction_description: tx.description,
          receipt_date: c.receipt_date,
          receipt_vendor: c.vendor,
          receipt_amount: receiptAmt,
          receipt_invoice_number: c.invoice_number,
          deviation_pct: Math.round(deviationPct * 100) / 100,
          skonto_amount: Math.round((receiptAmt - txAmt) * 100) / 100,
          matched_via: matchedVia,
        });
        break;
      }
    }

    return new Response(
      JSON.stringify({
        exact_applied: exactApplied,
        high_confidence_applied: highConfidenceApplied,
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
