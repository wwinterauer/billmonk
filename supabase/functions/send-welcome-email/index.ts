import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    // Database webhook sends { type, table, record, ... }
    const record = payload.record;
    if (!record?.id || !record?.email) {
      console.log("[SEND-WELCOME-EMAIL] No valid record in payload, skipping");
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log(`[SEND-WELCOME-EMAIL] New profile: ${record.email}`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { error } = await supabaseAdmin.functions.invoke(
      "send-transactional-email",
      {
        body: {
          templateName: "welcome-email",
          recipientEmail: record.email,
          idempotencyKey: `welcome-${record.id}`,
          templateData: {
            name: record.first_name || undefined,
          },
        },
      }
    );

    if (error) {
      console.error("[SEND-WELCOME-EMAIL] Failed to invoke send-transactional-email:", error);
      return new Response(JSON.stringify({ error: "Failed to send" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    console.log(`[SEND-WELCOME-EMAIL] Welcome email enqueued for ${record.email}`);
    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("[SEND-WELCOME-EMAIL] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
