import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
    // Verify admin
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

    if (!roleData) throw new Error("Forbidden");

    // Fetch profiles
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, plan, created_at, stripe_customer_id, subscription_status, subscription_end_date");

    const allProfiles = profiles || [];
    const totalUsers = allProfiles.length;

    // Plan distribution
    const planCounts: Record<string, number> = { free: 0, starter: 0, pro: 0, business: 0 };
    allProfiles.forEach(p => {
      const plan = p.plan || "free";
      planCounts[plan] = (planCounts[plan] || 0) + 1;
    });
    const planDistribution = Object.entries(planCounts).map(([name, count]) => ({ name, count }));

    // Registrations by month
    const regByMonth: Record<string, number> = {};
    allProfiles.forEach(p => {
      if (p.created_at) {
        const d = new Date(p.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        regByMonth[key] = (regByMonth[key] || 0) + 1;
      }
    });
    const registrationsByMonth = Object.entries(regByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, count]) => ({ month, count }));

    // Stripe metrics
    let mrr = 0;
    let payingUsers = 0;
    let trialUsers = 0;
    let churnedUsers = 0;

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey) {
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

        // Active subscriptions
        const activeSubs = await stripe.subscriptions.list({ status: "active", limit: 100 });
        payingUsers = activeSubs.data.length;
        activeSubs.data.forEach(sub => {
          sub.items.data.forEach(item => {
            if (item.price.recurring?.interval === "month") {
              mrr += (item.price.unit_amount || 0) / 100;
            } else if (item.price.recurring?.interval === "year") {
              mrr += (item.price.unit_amount || 0) / 100 / 12;
            }
          });
        });

        // Trialing
        const trialSubs = await stripe.subscriptions.list({ status: "trialing", limit: 100 });
        trialUsers = trialSubs.data.length;

        // Canceled
        const canceledSubs = await stripe.subscriptions.list({ status: "canceled", limit: 100 });
        churnedUsers = canceledSubs.data.length;
      } catch (stripeErr) {
        console.error("Stripe error:", stripeErr);
      }
    }

    const totalTrialAndPaid = trialUsers + payingUsers + churnedUsers;
    const trialToPaidRate = totalTrialAndPaid > 0 ? (payingUsers / totalTrialAndPaid) * 100 : 0;

    return new Response(JSON.stringify({
      totalUsers,
      payingUsers,
      mrr,
      trialUsers,
      churnedUsers,
      trialToPaidRate,
      planDistribution,
      registrationsByMonth,
    }), {
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
