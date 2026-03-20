import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TRIAL_DAYS = 30;
const BETA_COUPON_ID = "BETA50";

// Ensure the beta coupon exists in Stripe (idempotent)
async function ensureBetaCoupon(stripe: Stripe) {
  try {
    await stripe.coupons.retrieve(BETA_COUPON_ID);
  } catch {
    // Coupon doesn't exist, create it
    await stripe.coupons.create({
      id: BETA_COUPON_ID,
      percent_off: 50,
      duration: "repeating",
      duration_in_months: 12,
      name: "Beta-Rabatt 50%",
    });
    console.log("[CREATE-CHECKOUT] Beta coupon created");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { priceId } = await req.json();
    if (!priceId) throw new Error("priceId is required");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    let hasHadSubscription = false;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      // Check if customer ever had a subscription (no trial for returning customers)
      const subs = await stripe.subscriptions.list({
        customer: customerId,
        limit: 1,
      });
      hasHadSubscription = subs.data.length > 0;
    }

    // Ensure beta coupon exists
    await ensureBetaCoupon(stripe);

    const origin = req.headers.get("origin") || "https://receipt-ai-pal.lovable.app";

    // Only offer trial to new customers who never had a subscription
    const trialConfig = !hasHadSubscription
      ? { subscription_data: { trial_period_days: TRIAL_DAYS } }
      : {};

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/settings?tab=subscription&checkout=success`,
      cancel_url: `${origin}/settings?tab=subscription&checkout=cancel`,
      // Apply beta coupon automatically instead of allow_promotion_codes
      discounts: [{ coupon: BETA_COUPON_ID }],
      payment_method_collection: 'always',
      ...trialConfig,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
