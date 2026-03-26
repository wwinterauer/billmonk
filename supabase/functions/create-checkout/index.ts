import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BETA_COUPON_ID = "BETA50";

const PLAN_ORDER: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  business: 3,
};

const PRODUCT_TO_PLAN: Record<string, string> = {
  "prod_UAKsQZUmnXhFJi": "starter",
  "prod_UAKtEUTzqyQ44I": "pro",
  "prod_UBNbFH4F60Dh7H": "pro",
  "prod_UAKwFsOsukVbz4": "business",
  "prod_UAKzP7PQ5abo5z": "starter",
  "prod_UAL40QoQd3uz1M": "pro",
  "prod_UALa7l2kwi1LnO": "business",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

async function ensureBetaCoupon(stripe: Stripe) {
  try {
    await stripe.coupons.retrieve(BETA_COUPON_ID);
  } catch {
    await stripe.coupons.create({
      id: BETA_COUPON_ID,
      percent_off: 50,
      duration: "repeating",
      duration_in_months: 12,
      name: "Beta-Rabatt 50%",
    });
    logStep("Beta coupon created");
  }
}

function getPlanFromPriceProduct(productId: string): string {
  return PRODUCT_TO_PLAN[productId] || "free";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseAdmin.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { priceId, targetPlan } = await req.json();
    if (!priceId) throw new Error("priceId is required");

    logStep("Checkout requested", { email: user.email, priceId, targetPlan });

    // Get user profile for trialed_plans
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plan, trialed_plans, subscription_status")
      .eq("id", user.id)
      .single();

    const trialedPlans: string[] = (profile?.trialed_plans as string[]) || [];
    const currentPlan = profile?.plan || "free";

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    let hasActiveSubscription = false;
    let currentProductId: string | null = null;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;

      // Check for active/trialing subscriptions
      const subs = await stripe.subscriptions.list({
        customer: customerId,
        limit: 10,
      });

      const activeSub = subs.data.find(
        (s) => s.status === "active" || s.status === "trialing"
      );

      if (activeSub) {
        hasActiveSubscription = true;
        currentProductId = activeSub.items.data[0].price.product as string;
      }
    }

    // Determine trial days
    let trialDays = 0;
    const resolvedTargetPlan = targetPlan || "starter";
    const targetPlanOrder = PLAN_ORDER[resolvedTargetPlan] ?? 0;

    if (!customerId) {
      // Brand new customer → 30 day trial
      trialDays = 30;
      logStep("New customer, 30-day trial");
    } else if (!hasActiveSubscription) {
      // Returning customer without active sub
      if (!trialedPlans.includes(resolvedTargetPlan) && targetPlanOrder > (PLAN_ORDER[currentPlan] ?? 0)) {
        trialDays = 7;
        logStep("Returning customer, 7-day upgrade trial", { resolvedTargetPlan });
      } else if (!trialedPlans.includes(resolvedTargetPlan)) {
        // Same or lower plan not yet trialed
        trialDays = 0;
        logStep("Plan already at same level or lower, no trial");
      } else {
        logStep("Plan already trialed, no trial");
      }
    } else {
      // Has active subscription — upgrade trial
      const currentSubPlan = currentProductId ? getPlanFromPriceProduct(currentProductId) : currentPlan;
      if (targetPlanOrder > (PLAN_ORDER[currentSubPlan] ?? 0) && !trialedPlans.includes(resolvedTargetPlan)) {
        trialDays = 7;
        logStep("Active subscriber upgrading, 7-day trial", { from: currentSubPlan, to: resolvedTargetPlan });
      } else {
        logStep("Not eligible for trial", { currentSubPlan, resolvedTargetPlan, trialedPlans });
      }
    }

    // Ensure beta coupon exists
    await ensureBetaCoupon(stripe);

    const origin = req.headers.get("origin") || "https://billmonk.ai";

    const trialConfig = trialDays > 0
      ? { subscription_data: { trial_period_days: trialDays } }
      : {};

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/settings?tab=subscription&checkout=success`,
      cancel_url: `${origin}/settings?tab=subscription&checkout=cancel`,
      discounts: [{ coupon: BETA_COUPON_ID }],
      payment_method_collection: 'always',
      ...trialConfig,
    });

    // Update trialed_plans array
    if (!trialedPlans.includes(resolvedTargetPlan)) {
      const updatedTrialedPlans = [...trialedPlans, resolvedTargetPlan];
      await supabaseAdmin
        .from("profiles")
        .update({ trialed_plans: updatedTrialedPlans })
        .eq("id", user.id);
      logStep("Updated trialed_plans", { updatedTrialedPlans });
    }

    return new Response(JSON.stringify({ url: session.url, trial_days: trialDays }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
