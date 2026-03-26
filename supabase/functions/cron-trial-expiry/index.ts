import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    // Find users whose trial ends in exactly 3 days
    const now = new Date();
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    // Window: 3 days from now ± 12 hours (to handle cron timing)
    const windowStart = new Date(threeDaysFromNow);
    windowStart.setHours(windowStart.getHours() - 12);
    const windowEnd = new Date(threeDaysFromNow);
    windowEnd.setHours(windowEnd.getHours() + 12);

    const { data: trialingUsers, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, first_name, plan, subscription_end_date")
      .eq("subscription_status", "trialing")
      .gte("subscription_end_date", windowStart.toISOString())
      .lte("subscription_end_date", windowEnd.toISOString());

    if (error) {
      console.error("[CRON-TRIAL-EXPIRY] Query error:", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    console.log(`[CRON-TRIAL-EXPIRY] Found ${trialingUsers?.length || 0} users with expiring trials`);

    let sent = 0;
    for (const user of trialingUsers || []) {
      try {
        await supabaseAdmin.functions.invoke("send-transactional-email", {
          body: {
            templateName: "trial-expiry",
            recipientEmail: user.email,
            idempotencyKey: `trial-expiry-${user.id}-${user.subscription_end_date}`,
            templateData: {
              name: user.first_name || undefined,
              plan: user.plan ? user.plan.charAt(0).toUpperCase() + user.plan.slice(1) : undefined,
              daysLeft: 3,
            },
          },
        });
        sent++;
      } catch (e) {
        console.error(`[CRON-TRIAL-EXPIRY] Failed for ${user.email}:`, e);
      }
    }

    console.log(`[CRON-TRIAL-EXPIRY] Sent ${sent} trial expiry emails`);

    return new Response(JSON.stringify({ found: trialingUsers?.length || 0, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[CRON-TRIAL-EXPIRY] Error:", error);
    return new Response(JSON.stringify({ error: "Failed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
