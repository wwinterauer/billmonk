import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Monthly prices in cents
const PLAN_PRICES: Record<string, number> = {
  starter: 299,
  pro: 799,
  business: 1599,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getUser(token);
    if (claimsErr || !claims.user) throw new Error("Unauthorized");

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", claims.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) throw new Error("Admin access required");

    const { ticketId, action } = await req.json();
    if (!ticketId || !action) throw new Error("Missing ticketId or action");

    // Get ticket
    const { data: ticket, error: ticketErr } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("id", ticketId)
      .single();
    if (ticketErr || !ticket) throw new Error("Ticket not found");
    if (ticket.reward_status) throw new Error("Reward already processed");

    if (action === "reject") {
      await supabase
        .from("support_tickets")
        .update({ reward_status: "rejected" })
        .eq("id", ticketId);
      return new Response(JSON.stringify({ success: true, action: "rejected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // action === "approve"
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, stripe_customer_id, email")
      .eq("id", ticket.user_id)
      .single();
    if (!profile) throw new Error("User profile not found");

    const plan = profile.plan || "free";
    const priceInCents = PLAN_PRICES[plan] || 0;
    let stripeApplied = false;

    if (priceInCents > 0 && profile.stripe_customer_id) {
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
        apiVersion: "2025-08-27.basil",
      });

      // Get current balance and subtract (negative = credit)
      const customer = await stripe.customers.retrieve(profile.stripe_customer_id) as Stripe.Customer;
      const currentBalance = customer.balance || 0;
      await stripe.customers.update(profile.stripe_customer_id, {
        balance: currentBalance - priceInCents,
      });
      stripeApplied = true;
    }

    await supabase
      .from("support_tickets")
      .update({
        reward_status: "approved",
        reward_applied_at: new Date().toISOString(),
      })
      .eq("id", ticketId);

    return new Response(
      JSON.stringify({
        success: true,
        action: "approved",
        stripeApplied,
        creditAmount: priceInCents,
        plan,
        message: stripeApplied
          ? `Gutschrift von ${(priceInCents / 100).toFixed(2)} € angewendet`
          : plan === "free"
          ? "Anerkannt (Free-Plan, keine Stripe-Gutschrift)"
          : "Anerkannt (kein Stripe-Kunde gefunden)",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
