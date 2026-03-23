import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Unauthorized");

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) throw new Error("Forbidden: Admin role required");

    let body = null;
    try { body = await req.json(); } catch { /* no body */ }

    if (body?.action === "update_plan") {
      const { userId, plan } = body;
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ plan })
        .eq("id", userId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all profile fields
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, first_name, last_name, plan, created_at, monthly_receipt_count, stripe_customer_id, subscription_status, newsletter_opt_in, street, zip, city, country, phone, account_type, company_name, uid_number, onboarding_completed, subscription_end_date, stripe_product_id, avatar_url, receipt_credit, monthly_document_count, document_credit, admin_view_plan")
      .order("created_at", { ascending: false });

    if (profilesError) throw profilesError;

    // Aggregate receipt stats per user
    const { data: allReceipts } = await supabaseAdmin
      .from("receipts")
      .select("user_id, amount_gross");

    const receiptMap: Record<string, { count: number; total: number }> = {};
    if (allReceipts) {
      for (const r of allReceipts) {
        if (!receiptMap[r.user_id]) receiptMap[r.user_id] = { count: 0, total: 0 };
        receiptMap[r.user_id].count++;
        receiptMap[r.user_id].total += Number(r.amount_gross || 0);
      }
    }

    // Aggregate invoice stats
    const { data: allInvoices } = await supabaseAdmin
      .from("invoices")
      .select("user_id, total");

    const invoiceMap: Record<string, { count: number; total: number }> = {};
    if (allInvoices) {
      for (const inv of allInvoices) {
        if (!invoiceMap[inv.user_id]) invoiceMap[inv.user_id] = { count: 0, total: 0 };
        invoiceMap[inv.user_id].count++;
        invoiceMap[inv.user_id].total += Number(inv.total || 0);
      }
    }

    // Support ticket counts (open)
    const { data: openTickets } = await supabaseAdmin
      .from("support_tickets")
      .select("user_id")
      .eq("status", "open");

    const ticketMap: Record<string, number> = {};
    if (openTickets) {
      for (const t of openTickets) {
        ticketMap[t.user_id] = (ticketMap[t.user_id] || 0) + 1;
      }
    }

    // Fetch Stripe payment data for users with stripe_customer_id
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const stripeRevenueMap: Record<string, { total_paid: number; payment_count: number; last_payment_at: string | null }> = {};

    if (stripeKey) {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

      // Collect all stripe customer IDs mapped to user IDs
      const customerToUser: Record<string, string> = {};
      for (const p of (profiles || [])) {
        if (p.stripe_customer_id) {
          customerToUser[p.stripe_customer_id] = p.id;
        }
      }

      // Fetch all successful payments (invoices paid) from Stripe
      // We batch by iterating through Stripe invoices
      try {
        const stripeCustomerIds = Object.keys(customerToUser);
        
        // Process in parallel batches for each customer
        const batchSize = 10;
        for (let i = 0; i < stripeCustomerIds.length; i += batchSize) {
          const batch = stripeCustomerIds.slice(i, i + batchSize);
          await Promise.all(batch.map(async (customerId) => {
            try {
              const userId = customerToUser[customerId];
              const invoices = await stripe.invoices.list({
                customer: customerId,
                status: 'paid',
                limit: 100,
              });

              let totalPaid = 0;
              let paymentCount = 0;
              let lastPaymentAt: string | null = null;

              for (const inv of invoices.data) {
                totalPaid += (inv.amount_paid || 0) / 100; // Convert from cents to EUR
                paymentCount++;
                if (inv.status_transitions?.paid_at) {
                  const paidDate = new Date(inv.status_transitions.paid_at * 1000).toISOString();
                  if (!lastPaymentAt || paidDate > lastPaymentAt) {
                    lastPaymentAt = paidDate;
                  }
                }
              }

              stripeRevenueMap[userId] = { total_paid: totalPaid, payment_count: paymentCount, last_payment_at: lastPaymentAt };
            } catch {
              // Skip individual customer errors
            }
          }));
        }
      } catch {
        // Stripe fetch failed, continue without revenue data
      }
    }

    // Merge data
    const users = (profiles || []).map((p: any) => ({
      ...p,
      total_receipts: receiptMap[p.id]?.count || 0,
      total_receipt_amount: receiptMap[p.id]?.total || 0,
      total_invoices: invoiceMap[p.id]?.count || 0,
      total_invoice_amount: invoiceMap[p.id]?.total || 0,
      open_tickets: ticketMap[p.id] || 0,
      stripe_revenue: stripeRevenueMap[p.id]?.total_paid || 0,
      stripe_payment_count: stripeRevenueMap[p.id]?.payment_count || 0,
      stripe_last_payment_at: stripeRevenueMap[p.id]?.last_payment_at || null,
    }));

    return new Response(JSON.stringify({ users }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    const status = error.message?.includes("Unauthorized") ? 401 : error.message?.includes("Forbidden") ? 403 : 500;
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
