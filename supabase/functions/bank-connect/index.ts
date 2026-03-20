import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EB_BASE = "https://api.enablebanking.com";

function base64url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlEncode(str: string): string {
  return base64url(new TextEncoder().encode(str));
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const lines = pem
    .replace(/-----BEGIN [\w\s]+-----/, "")
    .replace(/-----END [\w\s]+-----/, "")
    .replace(/\s/g, "");
  const binary = atob(lines);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buf[i] = binary.charCodeAt(i);
  }
  return buf.buffer;
}

async function generateJWT(): Promise<string> {
  const appId = Deno.env.get("ENABLE_BANKING_APP_ID");
  const privateKeyPem = Deno.env.get("ENABLE_BANKING_PRIVATE_KEY");
  if (!appId || !privateKeyPem) throw new Error("Enable Banking credentials not configured");

  const now = Math.floor(Date.now() / 1000);
  const header = base64urlEncode(JSON.stringify({ alg: "RS256", typ: "JWT", kid: appId }));
  const payload = base64urlEncode(JSON.stringify({
    iss: "enablebanking.com",
    aud: "api.enablebanking.com",
    iat: now,
    exp: now + 3600,
  }));

  const keyData = pemToArrayBuffer(privateKeyPem);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureData = new TextEncoder().encode(`${header}.${payload}`);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, signatureData);
  const sig = base64url(new Uint8Array(signature));

  return `${header}.${payload}.${sig}`;
}

async function ebHeaders(): Promise<Record<string, string>> {
  const jwt = await generateJWT();
  return {
    Authorization: `Bearer ${jwt}`,
    "Content-Type": "application/json",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Missing authorization header");
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // List ASPSPs (institutions/banks)
    if (action === "list-institutions") {
      const country = url.searchParams.get("country") || "AT";
      const headers = await ebHeaders();
      const res = await fetch(`${EB_BASE}/aspsps?country=${country}`, { headers });
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`ASPSP list error [${res.status}]: ${errBody}`);
      }
      const data = await res.json();
      // Map to simplified format for frontend
      const mapped = (data.aspsps || data || []).map((a: any) => ({
        id: `${a.name}__${a.country}`,
        name: a.name,
        country: a.country,
        logo: a.logo || "",
        countries: [a.country],
      }));
      return new Response(JSON.stringify(mapped), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Start authorization (create auth session)
    if (action === "create-requisition") {
      const body = await req.json();
      const { institution_id, redirect_url } = body;
      if (!institution_id || !redirect_url) {
        throw new Error("institution_id and redirect_url required");
      }

      // Parse institution_id back to name + country
      const [aspspName, aspspCountry] = institution_id.split("__");
      const validUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

      const headers = await ebHeaders();
      const res = await fetch(`${EB_BASE}/auth`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          access: { valid_until: validUntil },
          aspsp: { name: aspspName, country: aspspCountry || "AT" },
          state: crypto.randomUUID(),
          redirect_url,
          psu_type: "personal",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`Auth error [${res.status}]: ${JSON.stringify(data)}`);

      // Store pending connection
      await supabase.from("bank_connections_live").insert({
        user_id: user.id,
        provider: "enablebanking",
        institution_id: institution_id,
        institution_name: aspspName,
        status: "pending",
      });

      return new Response(JSON.stringify({ link: data.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Callback: exchange code for session
    if (action === "callback") {
      const body = await req.json();
      const { code } = body;
      if (!code) throw new Error("code required");

      const headers = await ebHeaders();
      const res = await fetch(`${EB_BASE}/sessions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`Session error [${res.status}]: ${JSON.stringify(data)}`);

      const sessionId = data.session_id;
      const accounts = data.accounts || [];

      // Update pending connection with session and first account
      const firstAccount = accounts[0];
      await supabase
        .from("bank_connections_live")
        .update({
          requisition_id: sessionId,
          account_id: firstAccount?.uid || null,
          iban: firstAccount?.iban || null,
          institution_name: firstAccount?.aspsp_name || null,
          status: "active",
        })
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);

      return new Response(JSON.stringify({ status: "active", accounts, session_id: sessionId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // List user's bank connections
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

      // Try to delete session on Enable Banking side
      const { data: conn } = await supabase
        .from("bank_connections_live")
        .select("requisition_id")
        .eq("id", connection_id)
        .eq("user_id", user.id)
        .single();

      if (conn?.requisition_id) {
        try {
          const headers = await ebHeaders();
          await fetch(`${EB_BASE}/sessions/${conn.requisition_id}`, {
            method: "DELETE",
            headers,
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
