import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRODUCT_TO_PLAN: Record<string, string> = {
  "prod_UAKsQZUmnXhFJi": "Starter",
  "prod_UAKtEUTzqyQ44I": "Pro",
  "prod_UBNbFH4F60Dh7H": "Pro",
  "prod_UAKwFsOsukVbz4": "Business",
  "prod_UAKzP7PQ5abo5z": "Starter",
  "prod_UAL40QoQd3uz1M": "Pro",
  "prod_UALa7l2kwi1LnO": "Business",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey) {
    logStep("ERROR", { message: "STRIPE_SECRET_KEY not set" });
    return new Response("Server misconfigured", { status: 500 });
  }
  if (!webhookSecret) {
    logStep("ERROR", { message: "STRIPE_WEBHOOK_SECRET not set" });
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

  try {
    let event: Stripe.Event;
    const body = await req.text();

    if (webhookSecret) {
      const signature = req.headers.get("stripe-signature");
      if (!signature) {
        return new Response("Missing stripe-signature header", { status: 400 });
      }
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } else {
      // Fallback: parse without signature verification (dev mode)
      event = JSON.parse(body) as Stripe.Event;
    }

    logStep("Event received", { type: event.type, id: event.id });

    if (
      event.type === "checkout.session.completed" ||
      event.type === "customer.subscription.created"
    ) {
      let subscriptionId: string | null = null;
      let customerEmail: string | null = null;

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") {
          logStep("Skipping non-subscription checkout");
          return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        subscriptionId = typeof session.subscription === "string"
          ? session.subscription
          : (session.subscription as any)?.id ?? null;
        customerEmail = session.customer_details?.email ?? session.customer_email ?? null;
      } else {
        const sub = event.data.object as Stripe.Subscription;
        subscriptionId = sub.id;
        // Get email from customer
        const customerId = typeof sub.customer === "string" ? sub.customer : (sub.customer as any)?.id;
        if (customerId) {
          const customer = await stripe.customers.retrieve(customerId);
          if (!customer.deleted) {
            customerEmail = (customer as Stripe.Customer).email;
          }
        }
      }

      if (!subscriptionId || !customerEmail) {
        logStep("Missing subscription or email", { subscriptionId, customerEmail });
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Idempotency: use event ID to prevent double sending
      const idempotencyKey = `sub-confirmed-webhook-${event.id}`;

      // Check if already sent
      const { data: existingLog } = await supabaseAdmin
        .from("email_send_log")
        .select("id")
        .eq("message_id", idempotencyKey)
        .limit(1);

      if (existingLog && existingLog.length > 0) {
        logStep("Email already sent for this event", { eventId: event.id });
        return new Response(JSON.stringify({ received: true, skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get subscription details for plan name
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const productId = subscription.items.data[0]?.price?.product as string;
      const plan = PRODUCT_TO_PLAN[productId] || "Pro";

      // Get user name from profile
      let name: string | undefined;
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("first_name")
        .eq("email", customerEmail)
        .single();

      if (profile?.first_name) {
        name = profile.first_name;
      }

      logStep("Sending subscription-confirmed email", { email: customerEmail, plan, name });

      await supabaseAdmin.functions.invoke("send-transactional-email", {
        body: {
          templateName: "subscription-confirmed",
          recipientEmail: customerEmail,
          idempotencyKey,
          templateData: { name, plan },
        },
      });

      logStep("Email sent successfully");
    } else {
      logStep("Unhandled event type, ignoring");
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
