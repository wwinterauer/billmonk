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

const fmtDate = (unixSec?: number | null): string | undefined => {
  if (!unixSec) return undefined;
  try {
    return new Date(unixSec * 1000).toLocaleDateString("de-DE", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  } catch { return undefined; }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    logStep("ERROR", { message: "Stripe env vars missing" });
    return new Response("Server misconfigured", { status: 500 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

  // helper: skip if email already sent for this idempotency key
  const alreadySent = async (key: string): Promise<boolean> => {
    const { data } = await supabaseAdmin
      .from("email_send_log")
      .select("id")
      .eq("message_id", key)
      .limit(1);
    return !!(data && data.length > 0);
  };

  // helper: get profile first_name by email
  const getName = async (email: string): Promise<string | undefined> => {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("first_name")
      .eq("email", email)
      .maybeSingle();
    return data?.first_name || undefined;
  };

  // helper: resolve customer email
  const getCustomerEmail = async (customerId: string): Promise<string | null> => {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (!customer || (customer as any).deleted) return null;
      return (customer as Stripe.Customer).email ?? null;
    } catch (e) {
      logStep("getCustomerEmail error", { customerId, error: String(e) });
      return null;
    }
  };

  const sendEmail = async (templateName: string, recipientEmail: string, idempotencyKey: string, templateData: Record<string, unknown>) => {
    if (await alreadySent(idempotencyKey)) {
      logStep("Email already sent, skipping", { templateName, idempotencyKey });
      return;
    }
    logStep("Sending email", { templateName, recipientEmail, idempotencyKey });
    await supabaseAdmin.functions.invoke("send-transactional-email", {
      body: { templateName, recipientEmail, idempotencyKey, templateData },
    });
  };

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    logStep("Event received", { type: event.type, id: event.id });

    // ============================================================
    // Subscription confirmed (checkout / new subscription)
    // ============================================================
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
        const customerId = typeof sub.customer === "string" ? sub.customer : (sub.customer as any)?.id;
        if (customerId) customerEmail = await getCustomerEmail(customerId);
      }

      if (!subscriptionId || !customerEmail) {
        logStep("Missing subscription or email", { subscriptionId, customerEmail });
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const idempotencyKey = `sub-confirmed-webhook-${event.id}`;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const productId = subscription.items.data[0]?.price?.product as string;
      const plan = PRODUCT_TO_PLAN[productId] || "Pro";
      const name = await getName(customerEmail);

      await sendEmail("subscription-confirmed", customerEmail, idempotencyKey, { name, plan });
    }

    // ============================================================
    // Subscription updated → plan-changed OR subscription-cancelled (cancel_at_period_end)
    // ============================================================
    else if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      const previousAttributes = (event.data as any).previous_attributes || {};
      const customerId = typeof sub.customer === "string" ? sub.customer : (sub.customer as any)?.id;
      const customerEmail = customerId ? await getCustomerEmail(customerId) : null;
      if (!customerEmail) {
        logStep("No customer email for subscription.updated");
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const name = await getName(customerEmail);

      // Cancellation scheduled (cancel_at_period_end flipped from false → true)
      if (sub.cancel_at_period_end === true && previousAttributes?.cancel_at_period_end === false) {
        const productId = sub.items.data[0]?.price?.product as string;
        const plan = PRODUCT_TO_PLAN[productId] || "Pro";
        const accessUntil = fmtDate((sub as any).current_period_end);
        await sendEmail(
          "subscription-cancelled",
          customerEmail,
          `sub-cancelled-${event.id}`,
          { name, plan, accessUntil, immediate: false },
        );
      }
      // Plan change (items changed AND new product differs from prev)
      else if (previousAttributes?.items) {
        const newProductId = sub.items.data[0]?.price?.product as string;
        const newPlan = PRODUCT_TO_PLAN[newProductId] || "Pro";
        // Try to read previous product from previous_attributes
        const prevItems = previousAttributes.items?.data?.[0];
        const prevProductId = prevItems?.price?.product as string | undefined;
        const oldPlan = prevProductId ? (PRODUCT_TO_PLAN[prevProductId] || undefined) : undefined;

        if (oldPlan !== newPlan) {
          const effectiveDate = fmtDate(Math.floor(Date.now() / 1000));
          await sendEmail(
            "plan-changed",
            customerEmail,
            `plan-changed-${event.id}`,
            { name, oldPlan, newPlan, effectiveDate },
          );
        } else {
          logStep("Items changed but same plan, skipping plan-changed mail");
        }
      } else {
        logStep("subscription.updated: no relevant change for emails");
      }
    }

    // ============================================================
    // Subscription deleted (immediate end)
    // ============================================================
    else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : (sub.customer as any)?.id;
      const customerEmail = customerId ? await getCustomerEmail(customerId) : null;
      if (customerEmail) {
        const name = await getName(customerEmail);
        const productId = sub.items.data[0]?.price?.product as string;
        const plan = PRODUCT_TO_PLAN[productId] || "Pro";
        await sendEmail(
          "subscription-cancelled",
          customerEmail,
          `sub-deleted-${event.id}`,
          { name, plan, immediate: true },
        );
      }
    }

    // ============================================================
    // Invoice payment failed
    // ============================================================
    else if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const customerEmail = invoice.customer_email
        ?? (typeof invoice.customer === "string" ? await getCustomerEmail(invoice.customer) : null);
      if (customerEmail) {
        const name = await getName(customerEmail);
        const amount = (invoice.amount_due / 100).toFixed(2).replace(".", ",");
        const currency = (invoice.currency || "eur").toUpperCase();
        const nextRetryDate = fmtDate((invoice as any).next_payment_attempt);
        await sendEmail(
          "payment-failed",
          customerEmail,
          `payment-failed-${event.id}`,
          { name, amount, currency, nextRetryDate },
        );
      }
    }

    // ============================================================
    // Payment method attached / default updated
    // ============================================================
    else if (event.type === "payment_method.attached") {
      const pm = event.data.object as Stripe.PaymentMethod;
      const customerId = typeof pm.customer === "string" ? pm.customer : (pm.customer as any)?.id;
      if (customerId) {
        const customerEmail = await getCustomerEmail(customerId);
        if (customerEmail) {
          const name = await getName(customerEmail);
          const brand = pm.card?.brand
            ? pm.card.brand.charAt(0).toUpperCase() + pm.card.brand.slice(1)
            : pm.type;
          const last4 = pm.card?.last4 || (pm as any).sepa_debit?.last4;
          await sendEmail(
            "payment-method-updated",
            customerEmail,
            `payment-method-${event.id}`,
            { name, brand, last4 },
          );
        }
      }
    }

    else if (event.type === "customer.updated") {
      const customer = event.data.object as Stripe.Customer;
      const previousAttributes = (event.data as any).previous_attributes || {};
      const defaultPmChanged = previousAttributes?.invoice_settings?.default_payment_method !== undefined
        || previousAttributes?.default_source !== undefined;
      if (defaultPmChanged && customer.email) {
        const name = await getName(customer.email);
        let brand: string | undefined;
        let last4: string | undefined;
        const defaultPmId = (customer.invoice_settings?.default_payment_method ?? customer.default_source) as string | null;
        if (defaultPmId && typeof defaultPmId === "string") {
          try {
            const pm = await stripe.paymentMethods.retrieve(defaultPmId);
            brand = pm.card?.brand
              ? pm.card.brand.charAt(0).toUpperCase() + pm.card.brand.slice(1)
              : pm.type;
            last4 = pm.card?.last4 || (pm as any).sepa_debit?.last4;
          } catch (e) {
            logStep("Could not retrieve PM details", { error: String(e) });
          }
        }
        await sendEmail(
          "payment-method-updated",
          customer.email,
          `customer-pm-updated-${event.id}`,
          { name, brand, last4 },
        );
      }
    }

    else {
      logStep("Unhandled event type, ignoring", { type: event.type });
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
