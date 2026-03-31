import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
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

    // Get all unmatched transactions for this user
    const { data: transactions } = await supabase
      .from("bank_transactions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "unmatched");

    if (!transactions || transactions.length === 0) {
      return new Response(JSON.stringify({ matched_receipts: 0, matched_invoices: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let matchedReceipts = 0;
    let matchedInvoices = 0;

    // Split into expenses (match against receipts) and income (match against invoices)
    const expenses = transactions.filter((t) => t.is_expense === true);
    const income = transactions.filter((t) => t.is_expense === false);

    // --- Match expenses against receipts ---
    if (expenses.length > 0) {
      // Get unmatched receipts
      const { data: receipts } = await supabase
        .from("receipts")
        .select("id, amount_gross, receipt_date, vendor, invoice_number")
        .eq("user_id", user.id)
        .is("bank_transaction_id", null)
        .in("status", ["approved", "completed", "review"]);

      if (receipts && receipts.length > 0) {
        for (const tx of expenses) {
          if (!tx.amount) continue;

          // Find matching receipt: amount within 0.01€ tolerance, date within 5 days
          const match = receipts.find((r) => {
            if (!r.amount_gross) return false;
            const amountMatch = Math.abs(r.amount_gross - tx.amount!) < 0.02;
            if (!amountMatch) return false;

            // Date matching (optional but improves accuracy)
            if (r.receipt_date && tx.transaction_date) {
              const receiptDate = new Date(r.receipt_date);
              const txDate = new Date(tx.transaction_date);
              const daysDiff = Math.abs(
                (receiptDate.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24)
              );
              if (daysDiff > 5) return false;
            }

            return true;
          });

          if (match) {
            // Update transaction
            await supabase
              .from("bank_transactions")
              .update({ status: "matched", receipt_id: match.id })
              .eq("id", tx.id);

            // Update receipt
            await supabase
              .from("receipts")
              .update({ bank_transaction_id: tx.id })
              .eq("id", match.id);

            // Remove from pool so we don't double-match
            const idx = receipts.findIndex((r) => r.id === match.id);
            if (idx > -1) receipts.splice(idx, 1);

            matchedReceipts++;
          }
        }
      }
    }

    // --- Match income against invoices ---
    if (income.length > 0) {
      // Get unpaid sent/overdue invoices
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

          // Find matching invoice — check both full amount and skonto amount
          let matchedWithSkonto = false;
          const match = invoices.find((inv) => {
            if (!inv.total) return false;

            const fullAmountMatch = Math.abs(inv.total - tx.amount!) < 0.02;
            const skontoTotal = inv.discount_percent && inv.discount_percent > 0
              ? inv.total * (1 - inv.discount_percent / 100)
              : null;
            const skontoAmountMatch = skontoTotal !== null && Math.abs(skontoTotal - tx.amount!) < 0.02;

            if (!fullAmountMatch && !skontoAmountMatch) return false;

            // Bonus: check if invoice number or payment reference appears in description
            const hasRef =
              (inv.invoice_number && description.includes(inv.invoice_number.toLowerCase())) ||
              (inv.payment_reference && description.includes(inv.payment_reference.toLowerCase()));

            if (hasRef) {
              matchedWithSkonto = !fullAmountMatch && skontoAmountMatch;
              return true;
            }

            // Check for unique amount match (no other invoice with same total or skonto amount)
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
            // Update transaction
            await supabase
              .from("bank_transactions")
              .update({ status: "matched", invoice_id: match.id })
              .eq("id", tx.id);

            // Mark invoice as paid
            await supabase
              .from("invoices")
              .update({
                paid_at: new Date().toISOString(),
                status: "paid",
              })
              .eq("id", match.id);

            // Remove from pool
            const idx = invoices.findIndex((i) => i.id === match.id);
            if (idx > -1) invoices.splice(idx, 1);

            matchedInvoices++;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ matched_receipts: matchedReceipts, matched_invoices: matchedInvoices }),
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
