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

    const body = await req.json().catch(() => ({}));
    const connectionId = body.connection_id;

    // Get active connections to sync
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

    const gcToken = await getGCToken();
    const gcHeaders = {
      Authorization: `Bearer ${gcToken}`,
      "Content-Type": "application/json",
    };

    let totalSynced = 0;

    for (const conn of connections) {
      if (!conn.account_id) continue;

      try {
        // Fetch transactions from GoCardless (last 90 days)
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - 90);
        const dateFromStr = dateFrom.toISOString().split("T")[0];

        const res = await fetch(
          `${GC_BASE}/accounts/${conn.account_id}/transactions/?date_from=${dateFromStr}`,
          { headers: gcHeaders }
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
        const transactions = [
          ...(data.transactions?.booked || []),
        ];

        // Find existing bank account or create mapping
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
            // Auto-create bank account
            const { data: newAcc } = await supabase
              .from("bank_accounts")
              .insert({
                user_id: user.id,
                iban: conn.iban,
                account_name: conn.institution_name || "Live-Konto",
                bank_name: conn.institution_name || "GoCardless",
              })
              .select("id")
              .single();
            bankAccountId = newAcc?.id || null;
          }
        }

        for (const tx of transactions) {
          const externalId = tx.transactionId || tx.internalTransactionId || `${tx.bookingDate}_${tx.transactionAmount?.amount}`;
          const amount = parseFloat(tx.transactionAmount?.amount || "0");
          const isExpense = amount < 0;

          // Build description from available fields
          const descParts = [
            tx.remittanceInformationUnstructured,
            tx.creditorName,
            tx.debtorName,
          ].filter(Boolean);
          const description = descParts.join(" | ") || "Keine Beschreibung";

          // Upsert using external_id for deduplication
          const { error: insertError } = await supabase
            .from("bank_transactions")
            .upsert(
              {
                user_id: user.id,
                bank_account_id: bankAccountId,
                transaction_date: tx.bookingDate || null,
                value_date: tx.valueDate || null,
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

        // Update sync timestamp
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
