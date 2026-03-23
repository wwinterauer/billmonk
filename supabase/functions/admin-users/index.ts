import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

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
    const { data: receiptStats } = await supabaseAdmin
      .rpc("admin_receipt_stats_placeholder") // fallback to manual
      .maybeSingle();
    // Since no RPC exists, query receipts grouped manually
    // We'll do a simpler approach: fetch counts per user
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

    // Merge data
    const users = (profiles || []).map((p: any) => ({
      ...p,
      total_receipts: receiptMap[p.id]?.count || 0,
      total_receipt_amount: receiptMap[p.id]?.total || 0,
      total_invoices: invoiceMap[p.id]?.count || 0,
      total_invoice_amount: invoiceMap[p.id]?.total || 0,
      open_tickets: ticketMap[p.id] || 0,
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
