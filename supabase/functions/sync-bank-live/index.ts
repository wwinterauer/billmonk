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

    const body = await req.json().catch(() => ({}));
    const connectionId = body.connection_id;

    let query = supabase
      .from("bank_connections_live")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (connectionId) {
      query = query.eq("id", connectionId);
    }

    const { data: connections } = await query;
    if (!connections || connections.length === 0) {
      return new Response(JSON.stringify({ message: "No active connections", synced: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = await generateJWT();
    const ebHeaders = {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    };

    let totalSynced = 0;

    for (const conn of connections) {
      if (!conn.account_id) continue;

      try {
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - 90);
        const dateFromStr = dateFrom.toISOString().split("T")[0];

        const res = await fetch(
          `${EB_BASE}/accounts/${conn.account_id}/transactions?date_from=${dateFromStr}`,
          { headers: ebHeaders }
        );

        if (!res.ok) {
          const errBody = await res.text();
          await supabase
            .from("bank_connections_live")
            .update({ sync_error: `Sync failed [${res.status}]: ${errBody}` })
            .eq("id", conn.id);
          continue;
        }

        const data = await res.json();
        const transactions = [...(data.transactions?.booked || [])];

        // Find or create bank account
        let bankAccountId: string | null = null;
        if (conn.iban) {
          const { data: bankAcc } = await supabase
            .from("bank_accounts")
            .select("id")
            .eq("user_id", user.id)
            .eq("iban", conn.iban)
            .maybeSingle();

          if (bankAcc) {
            bankAccountId = bankAcc.id;
          } else {
            const { data: newAcc } = await supabase
              .from("bank_accounts")
              .insert({
                user_id: user.id,
                iban: conn.iban,
                account_name: conn.institution_name || "Live-Konto",
                bank_name: conn.institution_name || "Enable Banking",
              })
              .select("id")
              .single();
            bankAccountId = newAcc?.id || null;
          }
        }

        for (const tx of transactions) {
          const externalId = tx.transaction_id || tx.entry_reference || `${tx.booking_date}_${tx.transaction_amount?.amount}`;
          const amount = parseFloat(tx.transaction_amount?.amount || "0");
          const isExpense = amount < 0;

          const descParts = [
            tx.remittance_information_unstructured,
            tx.creditor_name,
            tx.debtor_name,
          ].filter(Boolean);
          const description = descParts.join(" | ") || "Keine Beschreibung";

          const { error: insertError } = await supabase
            .from("bank_transactions")
            .upsert(
              {
                user_id: user.id,
                bank_account_id: bankAccountId,
                transaction_date: tx.booking_date || null,
                value_date: tx.value_date || null,
                description,
                amount: Math.abs(amount),
                is_expense: isExpense,
                status: "unmatched",
                source: "live",
                external_id: externalId,
                raw_data: tx,
              },
              { onConflict: "user_id,external_id", ignoreDuplicates: true }
            );

          if (!insertError) {
            totalSynced++;
          }
        }

        await supabase
          .from("bank_connections_live")
          .update({ last_sync_at: new Date().toISOString(), sync_error: null })
          .eq("id", conn.id);
      } catch (connError) {
        const msg = connError instanceof Error ? connError.message : "Unknown sync error";
        await supabase
          .from("bank_connections_live")
          .update({ sync_error: msg })
          .eq("id", conn.id);
      }
    }

    // Trigger auto-reconcile after sync
    try {
      await supabase.functions.invoke("auto-reconcile");
    } catch {
      // Best effort
    }

    return new Response(JSON.stringify({ synced: totalSynced }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("sync-bank-live error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
