import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

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
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found, keeping current plan");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    await supabaseAdmin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);

    // Check for active OR trialing subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 10,
    });

    // Find first active or trialing subscription
    const activeOrTrialing = subscriptions.data.find(
      (s) => s.status === "active" || s.status === "trialing"
    );

    if (!activeOrTrialing) {
      logStep("No active/trialing subscription, keeping current plan");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const subscription = activeOrTrialing;
    const productId = subscription.items.data[0].price.product as string;
    const plan = PRODUCT_TO_PLAN[productId] || "free";
    const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
    const subscriptionStatus = subscription.status; // 'active' or 'trialing'
    logStep("Subscription found", { productId, plan, subscriptionEnd, status: subscriptionStatus });

    // Fetch current profile to detect plan changes
    const { data: currentProfile } = await supabaseAdmin
      .from("profiles")
      .select("plan, subscription_status")
      .eq("id", user.id)
      .single();

    const oldPlan = currentProfile?.plan || "free";
    const oldStatus = currentProfile?.subscription_status;

    await supabaseAdmin.from("profiles").update({
      plan,
      stripe_product_id: productId,
      subscription_status: subscriptionStatus,
      subscription_end_date: subscriptionEnd,
    }).eq("id", user.id);

    // Send subscription-confirmed email when transitioning to active paid plan
    if (
      subscriptionStatus === "active" &&
      plan !== "free" &&
      (oldPlan === "free" || oldStatus === "trialing") &&
      oldStatus !== "active"
    ) {
      logStep("Sending subscription-confirmed email", { plan, email: user.email });
      try {
        await supabaseAdmin.functions.invoke("send-transactional-email", {
          body: {
            templateName: "subscription-confirmed",
            recipientEmail: user.email,
            idempotencyKey: `sub-confirmed-${user.id}-${subscription.id}`,
            templateData: {
              name: user.user_metadata?.first_name || undefined,
              plan: plan.charAt(0).toUpperCase() + plan.slice(1),
            },
          },
        });
      } catch (e) {
        logStep("Failed to send subscription-confirmed email", { error: String(e) });
      }
    }

    return new Response(JSON.stringify({
      subscribed: true,
      plan,
      product_id: productId,
      subscription_end: subscriptionEnd,
      subscription_status: subscriptionStatus,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: "Subscription check failed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
