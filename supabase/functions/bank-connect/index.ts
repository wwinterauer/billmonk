import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GC_BASE = "https://bankaccountdata.gocardless.com/api/v2";

async function getGCToken(): Promise<string> {
  const secretId = Deno.env.get("GOCARDLESS_SECRET_ID");
  const secretKey = Deno.env.get("GOCARDLESS_SECRET_KEY");
  if (!secretId || !secretKey) throw new Error("GoCardless credentials not configured");

  const res = await fetch(`${GC_BASE}/token/new/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GoCardless token error [${res.status}]: ${body}`);
  }
  const data = await res.json();
  return data.access;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Missing authorization header");
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    const gcToken = await getGCToken();
    const gcHeaders = {
      Authorization: `Bearer ${gcToken}`,
      "Content-Type": "application/json",
    };

    // List institutions (banks) for a given country
    if (action === "list-institutions") {
      const country = url.searchParams.get("country") || "AT";
      const res = await fetch(
        `${GC_BASE}/institutions/?country=${country}`,
        { headers: gcHeaders }
      );
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a requisition (start bank authorization)
    if (action === "create-requisition") {
      const body = await req.json();
      const { institution_id, redirect_url } = body;
      if (!institution_id || !redirect_url) {
        throw new Error("institution_id and redirect_url required");
      }

      const res = await fetch(`${GC_BASE}/requisitions/`, {
        method: "POST",
        headers: gcHeaders,
        body: JSON.stringify({
          redirect: redirect_url,
          institution_id,
          user_language: "DE",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`Requisition error [${res.status}]: ${JSON.stringify(data)}`);

      // Store the requisition
      await supabase.from("bank_connections_live").insert({
        user_id: user.id,
        provider: "gocardless",
        institution_id,
        requisition_id: data.id,
        status: "pending",
      });

      return new Response(JSON.stringify({ link: data.link, requisition_id: data.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Callback: finalize the requisition and get accounts
    if (action === "callback") {
      const body = await req.json();
      const { requisition_id } = body;
      if (!requisition_id) throw new Error("requisition_id required");

      // Fetch requisition details
      const res = await fetch(`${GC_BASE}/requisitions/${requisition_id}/`, {
        headers: gcHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`Requisition fetch error [${res.status}]: ${JSON.stringify(data)}`);

      if (data.status !== "LN") {
        // Not yet linked
        return new Response(JSON.stringify({ status: data.status, message: "Not yet authorized" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get account details for each account
      const accounts = [];
      for (const accountId of data.accounts || []) {
        const accRes = await fetch(`${GC_BASE}/accounts/${accountId}/`, {
          headers: gcHeaders,
        });
        const accData = await accRes.json();

        const detailRes = await fetch(`${GC_BASE}/accounts/${accountId}/details/`, {
          headers: gcHeaders,
        });
        const detailData = await detailRes.json();

        accounts.push({
          account_id: accountId,
          iban: detailData?.account?.iban || accData?.iban || null,
          institution_id: data.institution_id,
        });

        // Upsert connection record
        await supabase
          .from("bank_connections_live")
          .update({
            account_id: accountId,
            iban: detailData?.account?.iban || accData?.iban || null,
            institution_name: data.institution_id,
            status: "active",
          })
          .eq("requisition_id", requisition_id)
          .eq("user_id", user.id);
      }

      return new Response(JSON.stringify({ status: "active", accounts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // List user's active bank connections
    if (action === "list-accounts") {
      const { data: connections } = await supabase
        .from("bank_connections_live")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      return new Response(JSON.stringify(connections || []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete a connection
    if (action === "delete-connection") {
      const body = await req.json();
      const { connection_id } = body;

      // Also delete the requisition on GoCardless side if possible
      const { data: conn } = await supabase
        .from("bank_connections_live")
        .select("requisition_id")
        .eq("id", connection_id)
        .eq("user_id", user.id)
        .single();

      if (conn?.requisition_id) {
        try {
          await fetch(`${GC_BASE}/requisitions/${conn.requisition_id}/`, {
            method: "DELETE",
            headers: gcHeaders,
          });
        } catch {
          // Best effort
        }
      }

      await supabase
        .from("bank_connections_live")
        .delete()
        .eq("id", connection_id)
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("bank-connect error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
